'use client';
import type { TransactionType, TransactionStatus } from '@/types';

interface Filters {
  type?: TransactionType;
  status?: TransactionStatus;
  from?: string;
  to?: string;
}

interface TransactionFiltersProps {
  value: Filters;
  onChange: (f: Filters) => void;
}

const TYPES: TransactionType[] = ['income', 'expense', 'receivable', 'payable', 'transfer'];
const STATUSES: TransactionStatus[] = ['pending', 'completed', 'overdue', 'cancelled'];

export default function TransactionFilters({ value, onChange }: TransactionFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={value.type ?? ''}
        onChange={(e) => onChange({ ...value, type: (e.target.value as TransactionType) || undefined })}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="">All types</option>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <select
        value={value.status ?? ''}
        onChange={(e) => onChange({ ...value, status: (e.target.value as TransactionStatus) || undefined })}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <input
        type="date"
        value={value.from ?? ''}
        onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        placeholder="From"
      />
      <input
        type="date"
        value={value.to ?? ''}
        onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        placeholder="To"
      />
    </div>
  );
}
