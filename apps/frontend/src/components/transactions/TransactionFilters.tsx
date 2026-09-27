'use client';
import { useState } from 'react';
import { Funnel } from '@phosphor-icons/react';
import type { TransactionType, TransactionStatus } from '@/types';
import { typeLabel, formatShortDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

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
// Same words the transaction list shows.
const STATUS_LABELS: Record<TransactionStatus, string> = { pending: 'Unpaid', settled: 'Paid', overdue: 'Overdue' };

function rangeText({ from, to }: Filters): string | undefined {
  if (from && to) return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  if (from) return `From ${formatShortDate(from)}`;
  if (to) return `Until ${formatShortDate(to)}`;
  return undefined;
}

/** The four filters as fields; `idPrefix` keeps ids unique between the phone and wide layouts. */
function Fields({ value, onChange, idPrefix }: TransactionFiltersProps & { idPrefix: string }) {
  return (
    <>
      <Select id={`${idPrefix}-type`} label="Type" value={value.type ?? ''} onChange={(e) => onChange({ ...value, type: (e.target.value as TransactionType) || undefined })}>
        <option value="" className="bg-ink-900">All types</option>
        {TYPES.map((t) => <option key={t} value={t} className="bg-ink-900">{typeLabel(t)}</option>)}
      </Select>
      <Select id={`${idPrefix}-status`} label="Status" value={value.status ?? ''} onChange={(e) => onChange({ ...value, status: (e.target.value as TransactionStatus) || undefined })}>
        <option value="" className="bg-ink-900">Paid or not</option>
        {STATUSES.map((s) => <option key={s} value={s} className="bg-ink-900">{STATUS_LABELS[s]}</option>)}
      </Select>
      <Input id={`${idPrefix}-from`} label="From" type="date" value={value.from ?? ''} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} />
      <Input id={`${idPrefix}-to`} label="To" type="date" value={value.to ?? ''} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} />
    </>
  );
}

export default function TransactionFilters({ value, onChange }: TransactionFiltersProps) {
  const [open, setOpen] = useState(false);
  // On a phone, choices wait in the panel until "Show results".
  const [draft, setDraft] = useState<Filters>(value);
  const active = [value.type && typeLabel(value.type), value.status && STATUS_LABELS[value.status], rangeText(value)].filter(Boolean);

  return (
    <>
      {/* Phones: one button; the filters open in a panel, one under the other. */}
      <div className="flex min-h-10 items-center gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => { setDraft(value); setOpen(true); }}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full glass px-4 text-[14px] font-medium text-white/80 transition active:scale-[0.97]"
        >
          <Funnel size={16} weight={active.length ? 'fill' : 'regular'} />
          Filter
          {active.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.14] px-1.5 text-[11px] tabular-nums text-white/85">{active.length}</span>
          )}
        </button>
        {active.length > 0 && (
          <>
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/50">{active.join(' · ')}</p>
            <button type="button" onClick={() => onChange({})} className="shrink-0 px-1 text-[13px] text-white/60 underline-offset-2 active:text-white">Clear</button>
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Filter transactions">
        <div className="space-y-4">
          <Fields value={draft} onChange={setDraft} idPrefix="sheet" />
          <div className="flex flex-col gap-2 pt-2">
            <Button size="lg" onClick={() => { onChange(draft); setOpen(false); }}>Show results</Button>
            <Button size="lg" variant="ghost" onClick={() => { setDraft({}); onChange({}); setOpen(false); }}>Clear filters</Button>
          </div>
        </div>
      </Modal>

      {/* Wider screens: all four in a row. */}
      <div className="hidden grid-cols-4 gap-3 sm:grid lg:max-w-3xl">
        <Fields value={value} onChange={onChange} idPrefix="bar" />
      </div>
    </>
  );
}
