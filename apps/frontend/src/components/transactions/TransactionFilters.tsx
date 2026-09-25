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

const TYPES: TransactionType[] = ['sale', 'expense', 'receivable', 'payable'];
const STATUSES: TransactionStatus[] = ['pending', 'settled', 'overdue'];

const selectCls = 'glass-input rounded-xl px-3 py-2 text-sm bg-transparent cursor-pointer';

export default function TransactionFilters({ value, onChange }: TransactionFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={value.type ?? ''}
        onChange={(e) => onChange({ ...value, type: (e.target.value as TransactionType) || undefined })}
        className={selectCls}
      >
        <option value="" className="bg-ink-900">All types</option>
        {TYPES.map((t) => <option key={t} value={t} className="bg-ink-900 capitalize">{t}</option>)}
      </select>

      <select
        value={value.status ?? ''}
        onChange={(e) => onChange({ ...value, status: (e.target.value as TransactionStatus) || undefined })}
        className={selectCls}
      >
        <option value="" className="bg-ink-900">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s} className="bg-ink-900 capitalize">{s}</option>)}
      </select>

      <input
        type="date"
        value={value.from ?? ''}
        onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        className={selectCls}
      />
      <input
        type="date"
        value={value.to ?? ''}
        onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        className={selectCls}
      />
    </div>
  );
}
