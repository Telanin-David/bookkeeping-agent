'use client';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate, typeLabel, cn } from '@/lib/utils';

interface TransactionTableProps {
  data: Transaction[];
  onRowClick?: (tx: Transaction) => void;
  /** Shown for unpaid receivables/payables. The row id is passed while its request runs. */
  onMarkPaid?: (tx: Transaction) => void;
  markingPaidId?: string | null;
}

const isDebt = (tx: Transaction) => tx.type === 'receivable' || tx.type === 'payable';

/** Plain words for the status: a settled debt or cash sale is "Paid". */
export function statusLabel(tx: Transaction): string {
  if (tx.status === 'settled') return 'Paid';
  if (tx.status === 'overdue') return 'Overdue';
  return isDebt(tx) ? 'Unpaid' : 'Pending';
}

function MarkPaidButton({ tx, onMarkPaid, markingPaidId }: { tx: Transaction } & Pick<TransactionTableProps, 'onMarkPaid' | 'markingPaidId'>) {
  if (!onMarkPaid || !isDebt(tx) || tx.status === 'settled') return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onMarkPaid(tx); }}
      disabled={markingPaidId === tx.id}
      className="h-8 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-white/85 ring-1 ring-inset ring-white/[0.1] transition hover:bg-white/[0.14] disabled:opacity-50"
    >
      {markingPaidId === tx.id ? 'Saving…' : 'Mark paid'}
    </button>
  );
}

export default function TransactionTable({ data, onRowClick, onMarkPaid, markingPaidId }: TransactionTableProps) {
  return (
    <>
      {/* Phones: one card per transaction, so the amount, status and "Mark paid" are
          always on screen — a wide table would hide them off the right edge. */}
      <ul className="space-y-2 md:hidden">
        {data.length === 0 && <li className="glass-card rounded-2xl py-10 text-center text-sm text-white/30">No transactions yet</li>}
        {data.map((tx) => (
          <li
            key={tx.id}
            onClick={() => onRowClick?.(tx)}
            className={cn('glass-card rounded-2xl px-4 py-3.5', onRowClick && 'cursor-pointer')}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-[15px] leading-snug text-white/90">{tx.description ?? '—'}</p>
              <p className="shrink-0 whitespace-nowrap text-[15px] font-medium tabular-nums text-white/90">{formatCurrency(tx.amount, tx.currency)}</p>
            </div>
            <p className="mt-1 truncate text-[13px] text-white/45">
              {[formatDate(tx.date), tx.counterparty, typeLabel(tx.type)].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <Badge>{statusLabel(tx)}</Badge>
              <MarkPaidButton tx={tx} onMarkPaid={onMarkPaid} markingPaidId={markingPaidId} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table<Transaction>
          columns={[
            { key: 'date',         header: 'Date',         render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
            { key: 'description',  header: 'Description',  render: (r) => r.description ?? '—' },
            { key: 'amount',       header: 'Amount',       render: (r) => formatCurrency(r.amount, r.currency), className: 'text-right font-mono whitespace-nowrap' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Badge>{statusLabel(r)}</Badge>
                  <MarkPaidButton tx={r} onMarkPaid={onMarkPaid} markingPaidId={markingPaidId} />
                </div>
              ),
            },
            { key: 'type',         header: 'Type',         render: (r) => <Badge>{typeLabel(r.type)}</Badge> },
            { key: 'category',     header: 'Category',     render: (r) => r.category ?? '—' },
            { key: 'counterparty', header: 'Counterparty', render: (r) => r.counterparty ?? '—' },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
          onRowClick={onRowClick}
          emptyMessage="No transactions yet"
        />
      </div>
    </>
  );
}
