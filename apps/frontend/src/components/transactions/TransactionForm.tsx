'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from '@phosphor-icons/react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import type { TransactionItemInput } from '@/types';
import { cn, typeLabel, todayInLagos } from '@/lib/utils';
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
  costKind:     z.enum(['stock', 'running']).optional(),
});

// Everyday running costs, one tap each. Anything else can be typed.
export const RUNNING_COST_CATEGORIES = ['Salaries', 'Rent', 'Electricity', 'Fuel & generator', 'Transport', 'Phone & data', 'Repairs'];

type FormValues = z.infer<typeof schema>;
type ItemRow = { productId: string; quantity: string };

interface TransactionFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues & { items?: TransactionItemInput[] }) => Promise<void>;
  onCancel: () => void;
}

export default function TransactionForm({ defaultValues, onSubmit, onCancel }: TransactionFormProps) {
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Most entries are for today, so the date starts there.
    defaultValues: { currency: 'NGN', status: 'pending', date: todayInLagos(), ...defaultValues },
  });

  // Products sold (off the shelf) or bought (onto it). Optional: a sale can be recorded without them.
  const shopId = useShopsStore((s) => s.activeShop()?.id) ?? '';
  const { data: products = [] } = useProducts(shopId);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [itemError, setItemError] = useState('');
  const [kindError, setKindError] = useState('');
  const type = watch('type');
  const costKind = watch('costKind');
  const category = watch('category');
  const isSale = type === 'sale' || type === 'receivable';
  const isDebt = type === 'receivable' || type === 'payable';
  // A cash sale or expense has no due date; drop one left over from switching the type.
  useEffect(() => { if (!isDebt) setValue('dueDate', undefined); }, [isDebt, setValue]);

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
    // Profit depends on it: goods to resell come back as sales, rent doesn't.
    const kind = isSale ? undefined : filled.length ? 'stock' : values.costKind;
    if (!isSale && !kind) {
      setKindError('Choose running the business or stock to resell.');
      return;
    }
    await onSubmit({
      ...values,
      costKind: kind,
      items: filled.length ? filled.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) })) : undefined,
    });
  }

  const boughtStock = !isSale && rows.some((r) => r.productId);

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {/* One field per row on a phone; two short ones side by side on wider screens. */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Select id="type" label="Type" error={errors.type?.message} {...register('type')}>
          {['sale', 'expense', 'receivable', 'payable'].map((t) => (
            <option key={t} value={t} className="bg-ink-900">{typeLabel(t)}</option>
          ))}
        </Select>
        <Input id="amount" label="Amount" type="number" inputMode="decimal" step="0.01" error={errors.amount?.message} {...register('amount')} />
      </div>

      {products.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">
            {isSale ? 'Products sold (optional)' : 'Stock bought (optional)'}
          </p>
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label="Product" value={row.productId}
                  onChange={(e) => applyRows(rows.map((r, j) => (j === i ? { ...r, productId: e.target.value } : r)))}
                >
                  <option value="" className="bg-ink-900">Choose a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} className="bg-ink-900">{p.name} · {formatQuantity(p.quantity)} left</option>
                  ))}
                </Select>
              </div>
              <input
                aria-label="How many" type="number" inputMode="decimal" min="0" step="any" placeholder="Qty" value={row.quantity}
                onChange={(e) => applyRows(rows.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
                className="glass-input min-h-[2.75rem] w-20 rounded-xl px-3 py-2.5 text-right text-base tabular-nums sm:text-sm"
              />
              <button
                type="button" aria-label="Remove line" onClick={() => applyRows(rows.filter((_, j) => j !== i))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white/80 active:bg-white/[0.1]"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button" onClick={() => setRows([...rows, { productId: '', quantity: '' }])}
            className="flex min-h-[2.75rem] items-center gap-1.5 text-[14px] text-white/60 transition hover:text-white/90 active:text-white"
          >
            <Plus size={14} /> Add a product
          </button>
          {itemError && <p className="text-xs text-white/60" role="alert">{itemError}</p>}
        </div>
      )}

      {!isSale && (
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/40">Kind of spending</legend>
          {boughtStock ? (
            <p className="text-[14px] text-white/60">Stock to resell: the products above go on your shelf.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kind of spending">
              {([['running', 'Running the business', 'Rent, salaries, fuel…'], ['stock', 'Stock to resell', 'Goods you’ll sell']] as const).map(([value, label, note]) => (
                <button
                  key={value} type="button" role="radio" aria-checked={costKind === value}
                  onClick={() => { setValue('costKind', value); setKindError(''); }}
                  className={cn(
                    'min-h-[3.5rem] rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition active:scale-[0.98]',
                    costKind === value ? 'bg-white/[0.12] text-white ring-white/25' : 'text-white/60 ring-white/[0.1] hover:bg-white/[0.05] hover:text-white/85',
                  )}
                >
                  <span className="block text-[14px] font-medium leading-tight">{label}</span>
                  <span className="mt-0.5 block text-[12px] text-white/40">{note}</span>
                </button>
              ))}
            </div>
          )}
          {kindError && !boughtStock && <p className="text-xs text-white/60" role="alert">{kindError}</p>}
        </fieldset>
      )}

      <Input id="description"  label={isSale ? 'What was sold' : 'What you paid for'} error={errors.description?.message} {...register('description')} />
      <Input id="counterparty" label={isSale ? 'Customer (optional)' : 'Paid to (optional)'} error={errors.counterparty?.message} {...register('counterparty')} />
      <div className="space-y-2">
        <Input id="category" label="Category (optional)" error={errors.category?.message} {...register('category')} />
        {!isSale && costKind === 'running' && !boughtStock && (
          <div className="flex flex-wrap gap-1.5" aria-label="Common running costs">
            {RUNNING_COST_CATEGORIES.map((c) => (
              <button
                key={c} type="button" onClick={() => setValue('category', c)}
                className={cn(
                  'h-8 rounded-full px-3 text-[13px] ring-1 ring-inset transition',
                  category === c ? 'bg-white/[0.14] text-white ring-white/25' : 'text-white/55 ring-white/[0.1] hover:text-white/85',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Input id="date" label="Date" type="date" error={errors.date?.message} {...register('date')} />
        {/* Only credit sales and bills have a date they're due. */}
        {isDebt && <Input id="dueDate" label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />}
      </div>

      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="lg" loading={isSubmitting}>Save</Button>
      </FormActions>
    </form>
  );
}
