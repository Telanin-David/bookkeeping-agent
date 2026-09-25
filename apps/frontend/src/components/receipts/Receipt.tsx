import type { Shop, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';

export function receiptNumber(tx: Transaction) {
  const prefix = tx.type === 'receivable' ? 'INV' : 'RCT';
  return `${prefix}-${tx.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`;
}

export function receiptStatus(tx: Transaction) {
  if (tx.status === 'cancelled') return 'Void';
  if (tx.status === 'overdue') return 'Overdue';
  if (tx.type === 'receivable' || tx.status === 'pending') return 'Balance due';
  return 'Paid';
}

const dateFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true });

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-black/50">{label}</span>
      <span className={strong ? 'text-right text-[13px] font-semibold text-black' : 'text-right text-[13px] text-black/85'}>{value}</span>
    </div>
  );
}

const Rule = () => <div className="my-4 border-t border-dashed border-black/20" />;

export default function Receipt({ tx, shop }: { tx: Transaction; shop: Shop }) {
  const isInvoice = tx.type === 'receivable';
  const loggedAt = new Date(tx.createdAt);

  return (
    <article className="receipt-paper mx-auto w-full max-w-[360px] rounded-2xl bg-[#fbfbfa] px-7 pb-8 pt-9 text-black shadow-[0_24px_80px_rgba(0,0,0,0.55)] print:max-w-[80mm] print:rounded-none print:bg-white print:px-0 print:pt-0 print:shadow-none">
      <header className="text-center">
        {shop.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logoUrl} alt="" className="mx-auto mb-3 max-h-16 max-w-[180px] object-contain" />
        )}
        <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.03em] text-black">{shop.name}</h2>
        <p className="mt-1 text-[12px] capitalize text-black/45">
          {[shop.location, shop.type].filter(Boolean).join(' · ')}
        </p>
      </header>

      <Rule />

      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black">{isInvoice ? 'Invoice' : 'Receipt'}</span>
        <span className="text-[12px] font-medium tabular-nums tracking-wide text-black/70">{receiptNumber(tx)}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        <Row label="Date" value={dateFmt.format(new Date(tx.date))} />
        <Row label="Time" value={timeFmt.format(loggedAt)} />
        <Row label="Customer" value={tx.counterparty ?? 'Walk-in customer'} />
        {isInvoice && tx.dueDate && <Row label="Due" value={dateFmt.format(new Date(tx.dueDate))} />}
      </div>

      <Rule />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-snug text-black">{tx.description}</p>
          {tx.category && <p className="mt-0.5 text-[12px] text-black/45">{tx.category}</p>}
        </div>
        <span className="shrink-0 text-[14px] tabular-nums text-black">{formatCurrency(tx.amount, tx.currency)}</span>
      </div>

      <Rule />

      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-black">Total</span>
        <span className="text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-black">{formatCurrency(tx.amount, tx.currency)}</span>
      </div>
      <div className="mt-2">
        <Row label="Status" value={receiptStatus(tx)} strong />
      </div>

      {isInvoice && (
        <div className="mt-8">
          <div className="flex h-14 items-end">
            {shop.signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.signatureUrl} alt="" className="max-h-14 max-w-[160px] object-contain" />
            )}
          </div>
          <div className="w-44 border-t border-black/40" />
          <p className="mt-1.5 text-[11px] text-black/45">Authorised signature</p>
        </div>
      )}

      <Rule />

      <footer className="text-center">
        <p className="text-[13px] text-black/70">Thank you for your patronage.</p>
        <p className="mt-1 text-[11px] text-black/35">Issued {dateFmt.format(new Date())} · Bookkeeping AI</p>
      </footer>
    </article>
  );
}
