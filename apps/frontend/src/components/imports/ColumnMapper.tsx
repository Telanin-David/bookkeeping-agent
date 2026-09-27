'use client';
import { useState, type FormEvent } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import { cn } from '@/lib/utils';
import type { ImportField, ImportMapping, ImportPreview } from '@/types';

interface ColumnMapperProps {
  preview: ImportPreview;
  initial: ImportMapping;
  loading: boolean;
  error: string;
  onSubmit: (mapping: ImportMapping) => void;
  onCancel: () => void;
}

const FIELDS: { field: ImportField; label: string; hint?: string }[] = [
  { field: 'date', label: 'Date', hint: 'Needed' },
  { field: 'amount', label: 'Amount', hint: 'Or Money in / Money out below' },
  { field: 'description', label: 'What was sold or bought' },
  { field: 'type', label: 'Type', hint: 'sale, expense, credit sale or bill' },
  { field: 'counterparty', label: 'Customer or supplier' },
  { field: 'category', label: 'Category' },
  { field: 'dueDate', label: 'Due date', hint: 'Credit sales and bills' },
  { field: 'paid', label: 'Paid?', hint: 'yes, no, or amount paid' },
  { field: 'moneyIn', label: 'Money in', hint: 'Bank-style sheets' },
  { field: 'moneyOut', label: 'Money out', hint: 'Bank-style sheets' },
];

const ROW_KINDS: { value: NonNullable<ImportMapping['defaultType']>; label: string }[] = [
  { value: 'sale', label: 'All sales' },
  { value: 'expense', label: 'All expenses' },
  { value: 'receivable', label: 'All credit sales (customers owe me)' },
  { value: 'payable', label: 'All bills (I owe suppliers)' },
  { value: 'sign', label: 'Positive is money in, negative is money out' },
];

// Same dropdown look as the rest of the app: our own arrow, with room around it.
const selectCls = 'glass-input min-h-[2.75rem] w-full cursor-pointer appearance-none rounded-xl bg-transparent py-2.5 pl-3.5 pr-10 text-base sm:text-sm';
const caret = <CaretDown size={15} weight="bold" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45" aria-hidden />;

export default function ColumnMapper({ preview, initial, loading, error, onSubmit, onCancel }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ImportMapping>(initial);
  const set = (field: ImportField, value: string) => setMapping((m) => ({ ...m, [field]: value || undefined }));
  // Without a Type column or Money in/out columns, the owner says what every row is.
  const needsKind = !mapping.type && !mapping.moneyIn && !mapping.moneyOut;

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ ...mapping, defaultType: needsKind ? mapping.defaultType ?? 'sale' : undefined });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="glass-card overflow-hidden rounded-2xl">
        <p className="border-b border-white/[0.06] px-4 py-3 text-[13px] text-white/55">
          <span className="text-white/85">{preview.filename}</span> · {preview.totalRows} {preview.totalRows === 1 ? 'row' : 'rows'}
          {preview.truncated && ' (only the first 5,000 are read)'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr>{preview.headers.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium text-white/60">{h}</th>)}</tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, i) => (
                <tr key={i} className="border-t border-white/[0.04]">
                  {preview.headers.map((_, j) => <td key={j} className="max-w-[160px] truncate whitespace-nowrap px-3 py-1.5 text-white/45">{row[j]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card space-y-3 rounded-2xl p-4">
        <p className="text-[14px] text-white/80">Which column has what? We filled in our best guess.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ field, label, hint }) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-white/40">
                {label}{hint && <span className="ml-1 normal-case tracking-normal text-white/25">· {hint}</span>}
              </span>
              <span className="relative">
                <select
                  aria-label={label}
                  value={mapping[field] ?? ''}
                  onChange={(e) => set(field, e.target.value)}
                  className={cn(selectCls, mapping[field] ? 'text-white/90' : 'text-white/35')}
                >
                  <option value="" className="bg-ink-900">Not in my file</option>
                  {preview.headers.map((h) => <option key={h} value={h} className="bg-ink-900">{h}</option>)}
                </select>
                {caret}
              </span>
            </label>
          ))}
        </div>

        {needsKind && (
          <label className="flex flex-col gap-1 border-t border-white/[0.06] pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">What are the rows?</span>
            <span className="relative">
              <select
                aria-label="What are the rows?"
                value={mapping.defaultType ?? 'sale'}
                onChange={(e) => setMapping((m) => ({ ...m, defaultType: e.target.value as ImportMapping['defaultType'] }))}
                className={selectCls}
              >
                {ROW_KINDS.map((k) => <option key={k.value} value={k.value} className="bg-ink-900">{k.label}</option>)}
              </select>
              {caret}
            </span>
          </label>
        )}
      </div>

      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>Start again</Button>
        <Button type="submit" size="lg" loading={loading}>Check the rows</Button>
      </FormActions>
    </form>
  );
}
