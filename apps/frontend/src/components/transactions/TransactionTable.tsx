'use client';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate, typeLabel, cn } from '@/lib/utils';

interface TransactionTableProps {
  data: Transaction[];
  onRowClick?: (tx: Transaction) => void;
  /** Opens the payment screen for a credit sale or bill on credit. */
  onRecordPayment?: (tx: Transaction) => void;
}

const isDebt = (tx: Transaction) => tx.type === 'receivable' || tx.type === 'payable';

const isPartPaid = (tx: Transaction) => isDebt(tx) && tx.amountPaid > 0 && tx.balance > 0;

/** Plain words for the status: a settled debt or cash sale is "Paid". */
export function statusLabel(tx: Transaction): string {
  if (tx.status === 'settled') return 'Paid';
  if (tx.status === 'overdue') return 'Overdue';
  if (isPartPaid(tx)) return 'Part-paid';
  return isDebt(tx) ? 'Unpaid' : 'Pending';
}

/** "₦5,000.00 paid · ₦15,000.00 left" for a debt that has been paid in part. */
function PaidSoFar({ tx }: { tx: Transaction }) {
  if (!isPartPaid(tx)) return null;
  return (
    <p className="text-[12px] tabular-nums text-white/45">
      {formatCurrency(tx.amountPaid, tx.currency)} paid · {formatCurrency(tx.balance, tx.currency)} left
    </p>
  );
}

function PaymentButton({ tx, onRecordPayment }: { tx: Transaction } & Pick<TransactionTableProps, 'onRecordPayment'>) {
  if (!onRecordPayment || !isDebt(tx)) return null;
  // A paid debt keeps a quieter button so a mistaken payment can still be undone.
  const paid = tx.balance <= 0;
  if (paid && tx.amountPaid <= 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRecordPayment(tx); }}
      className={cn(
        'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition',
        paid
          ? 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
          : 'bg-white/[0.08] text-white/85 ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.14]',
      )}
    >
      {paid ? 'Payments' : 'Record payment'}
    </button>
  );
}

export default function TransactionTable({ data, onRowClick, onRecordPayment }: TransactionTableProps) {
  return (
    <>
      {/* Phones: one card per transaction, so the amount, status and "Record payment" are
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
              <div className="flex min-w-0 flex-col items-start gap-1">
                <Badge>{statusLabel(tx)}</Badge>
                <PaidSoFar tx={tx} />
              </div>
              <PaymentButton tx={tx} onRecordPayment={onRecordPayment} />
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
                <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                  <div className="flex flex-col items-start gap-1">
                    <Badge>{statusLabel(r)}</Badge>
                    <PaidSoFar tx={r} />
                  </div>
                  <PaymentButton tx={r} onRecordPayment={onRecordPayment} />
                </div>
              ),
            },
            { key: 'type',         header: 'Type',         render: (r) => <Badge>{typeLabel(r.type)}</Badge> },
            { key: 'category',     header: 'Category',     render: (r) => r.category ?? '—' },
            { key: 'counterparty', header: 'Customer or supplier', render: (r) => r.counterparty ?? '—' },
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
