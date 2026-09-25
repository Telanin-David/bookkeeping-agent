'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { Transaction } from '@/types';

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

interface TransactionFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
}

const selectCls = 'glass-input w-full rounded-xl px-3.5 py-2.5 text-sm bg-transparent';

export default function TransactionForm({ defaultValues, onSubmit, onCancel }: TransactionFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'NGN', status: 'pending', ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-white/40">Type</label>
          <select {...register('type')} className={selectCls}>
            {['sale', 'expense', 'receivable', 'payable'].map((t) => (
              <option key={t} value={t} className="bg-ink-900 capitalize">{t}</option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-white/45">{errors.type.message}</p>}
        </div>
        <Input id="amount" label="Amount" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
      </div>

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
