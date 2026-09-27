'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { TransactionItemInput } from '@/types';
import { typeLabel } from '@/lib/utils';
import { useProducts } from '@/hooks/useStock';
import { useShopsStore } from '@/store/shops';
import { formatQuantity, quantityText } from '@/lib/quantity';

// Blank optional inputs submit as '' — send them as absent instead, since the API
// rejects an empty dueDate and would store empty strings for category/counterparty.
const optionalText = z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined));

const schema = z.object({
  type:         z.enum(['sale', 'expense', 'receivable', 'payable']),
  amount:       z.coerce.number().positive(),
  description:  z.string().min(1),
  date:         z.string().min(1),
  category:     optionalText,
  counterparty: optionalText,
  dueDate:      optionalText,
  status:       z.enum(['pending', 'settled', 'overdue']).default('pending'),
  currency:     z.string().default('NGN'),
});

type FormValues = z.infer<typeof schema>;
type ItemRow = { productId: string; quantity: string };

interface TransactionFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues & { items?: TransactionItemInput[] }) => Promise<void>;
  onCancel: () => void;
}

const selectCls = 'glass-input w-full rounded-xl px-3.5 py-2.5 text-sm bg-transparent';

export default function TransactionForm({ defaultValues, onSubmit, onCancel }: TransactionFormProps) {
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'NGN', status: 'pending', ...defaultValues },
  });

  // Products sold (off the shelf) or bought (onto it). Optional: a sale can be recorded without them.
  const shopId = useShopsStore((s) => s.activeShop()?.id) ?? '';
  const { data: products = [] } = useProducts(shopId);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [itemError, setItemError] = useState('');
  const type = watch('type');
  const isSale = type === 'sale' || type === 'receivable';

  // Fill in the amount and description from the product lines, unless the owner typed their own.
  const [autoAmount, setAutoAmount] = useState<string | null>(null);
  const [autoDescription, setAutoDescription] = useState<string | null>(null);
  function applyRows(next: ItemRow[]) {
    setRows(next);
    setItemError('');
    const lines = next
      .map((r) => ({ product: products.find((p) => p.id === r.productId), qty: Number(r.quantity) }))
      .filter((l) => l.product && l.qty > 0);
    const price = (l: (typeof lines)[number]) => (isSale ? l.product!.sellingPrice : l.product!.costPrice);
    if (lines.length && lines.every((l) => price(l) !== null)) {
      const total = String(Math.round(lines.reduce((s, l) => s + l.qty * price(l)!, 0) * 100) / 100);
      const current = String(getValues('amount') ?? '');
      if (!current || current === autoAmount) { setValue('amount', total as unknown as number); setAutoAmount(total); }
    }
    if (lines.length) {
      const text = lines.map((l) => `${quantityText(l.qty, l.product!.unit)} of ${l.product!.name}`).join(', ');
      const current = getValues('description') ?? '';
      if (!current || current === autoDescription) { setValue('description', text); setAutoDescription(text); }
    }
  }

  async function submit(values: FormValues) {
    const filled = rows.filter((r) => r.productId || r.quantity.trim());
    if (filled.some((r) => !r.productId || !(Number(r.quantity) > 0))) {
      setItemError('Pick a product and how many for each line, or remove the line.');
      return;
    }
    await onSubmit({ ...values, items: filled.length ? filled.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) })) : undefined });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-white/40">Type</label>
          <select {...register('type')} className={selectCls}>
            {['sale', 'expense', 'receivable', 'payable'].map((t) => (
              <option key={t} value={t} className="bg-ink-900">{typeLabel(t)}</option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-white/45">{errors.type.message}</p>}
        </div>
        <Input id="amount" label="Amount" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
      </div>

      {products.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">
            {isSale ? 'Products sold (optional)' : 'Stock bought (optional)'}
          </p>
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                aria-label="Product" value={row.productId}
                onChange={(e) => applyRows(rows.map((r, j) => (j === i ? { ...r, productId: e.target.value } : r)))}
                className={`${selectCls} min-w-0 flex-1`}
              >
                <option value="" className="bg-ink-900">Choose a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id} className="bg-ink-900">{p.name} · {formatQuantity(p.quantity)} left</option>
                ))}
              </select>
              <input
                aria-label="How many" type="number" inputMode="decimal" min="0" step="any" placeholder="Qty" value={row.quantity}
                onChange={(e) => applyRows(rows.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
                className="glass-input w-20 rounded-xl px-3 py-2.5 text-right text-sm tabular-nums"
              />
              <button
                type="button" aria-label="Remove line" onClick={() => applyRows(rows.filter((_, j) => j !== i))}
                className="h-9 w-9 shrink-0 rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white/75"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button" onClick={() => setRows([...rows, { productId: '', quantity: '' }])}
            className="text-[13px] text-white/55 underline-offset-2 hover:text-white/85 hover:underline"
          >
            + Add a product
          </button>
          {itemError && <p className="text-xs text-white/60" role="alert">{itemError}</p>}
        </div>
      )}

      <Input id="description"  label="Description"   error={errors.description?.message}  {...register('description')} />
      <Input id="category"     label="Category"      error={errors.category?.message}     {...register('category')} />
      <Input id="counterparty" label="Counterparty"  error={errors.counterparty?.message} {...register('counterparty')} />

      <div className="grid grid-cols-2 gap-3">
        <Input id="date"    label="Date"     type="date" error={errors.date?.message}    {...register('date')} />
        <Input id="dueDate" label="Due Date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Save</Button>
      </div>
    </form>
  );
}
