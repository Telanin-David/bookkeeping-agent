'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { Transaction } from '@/types';

const schema = z.object({
  type:         z.enum(['income', 'expense', 'receivable', 'payable', 'transfer']),
  amount:       z.coerce.number().positive(),
  description:  z.string().min(1),
  date:         z.string().min(1),
  category:     z.string().optional(),
  counterparty: z.string().optional(),
  dueDate:      z.string().optional(),
  status:       z.enum(['pending', 'completed', 'overdue', 'cancelled']).default('pending'),
  currency:     z.string().default('NGN'),
});

type FormValues = z.infer<typeof schema>;

interface TransactionFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
}

export default function TransactionForm({ defaultValues, onSubmit, onCancel }: TransactionFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'NGN', status: 'pending', ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Type</label>
          <select {...register('type')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {['income', 'expense', 'receivable', 'payable', 'transfer'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-red-600">{errors.type.message}</p>}
        </div>

        <Input id="amount"  label="Amount"      type="number" step="0.01" error={errors.amount?.message}      {...register('amount')} />
      </div>

      <Input id="description"  label="Description"   error={errors.description?.message}  {...register('description')} />
      <Input id="category"     label="Category"      error={errors.category?.message}     {...register('category')} />
      <Input id="counterparty" label="Counterparty"  error={errors.counterparty?.message} {...register('counterparty')} />

      <div className="grid grid-cols-2 gap-4">
        <Input id="date"    label="Date"     type="date" error={errors.date?.message}    {...register('date')} />
        <Input id="dueDate" label="Due Date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Save</Button>
      </div>
    </form>
  );
}
