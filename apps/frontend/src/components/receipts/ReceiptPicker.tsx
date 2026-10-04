'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CaretRight, MagnifyingGlass, Printer, Stamp } from '@phosphor-icons/react';
import { useShopsStore } from '@/store/shops';
import { useTransactions } from '@/hooks/useTransactions';
import Spinner from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import { receiptStatus } from './Receipt';

const shortDate = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ReceiptPicker() {
  const shop = useShopsStore((s) => s.activeShop());
  const { data, isLoading } = useTransactions(shop?.id ?? '', { limit: 100 });
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.data ?? [])
      .filter((t) => t.type === 'sale' || t.type === 'receivable')
      .filter((t) => !q || `${t.counterparty ?? ''} ${t.description}`.toLowerCase().includes(q))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [data, query]);

  return (
    <div className="space-y-4">
      {shop && !shop.logoUrl && (
        <Link
          href="/shops/branding"
          className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-[14px] text-white/60 ring-1 ring-inset ring-white/[0.07] transition hover:bg-white/[0.07] hover:text-white/85"
        >
          <Stamp size={18} className="shrink-0 text-white/50" />
          <span className="flex-1">Add your logo so it prints on every receipt</span>
          <CaretRight size={14} className="shrink-0 text-white/30" />
        </Link>
      )}
      <div className="relative">
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer or item"
          className="glass-input h-12 w-full rounded-2xl pl-11 pr-4 text-base text-white/85 placeholder:text-white/30 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner className="h-5 w-5 text-white/25" /></div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-white/35">
          {query ? 'No sales match your search.' : 'No sales yet. Receipts appear here once you log a sale.'}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl glass-card divide-y divide-white/[0.06]">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white/90">{t.counterparty ?? 'Walk-in customer'}</p>
                <p className="mt-0.5 truncate text-[13px] text-white/40">{t.description} · {shortDate.format(new Date(t.createdAt))}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[15px] tabular-nums text-white/85">{formatCurrency(t.amount, t.currency)}</p>
                <p className="mt-0.5 text-[12px] text-white/35">{receiptStatus(t)}</p>
              </div>
              <Link
                href={`/receipts/${t.id}`}
                className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/70 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.12] hover:text-white"
                aria-label={`Receipt for ${t.counterparty ?? 'walk-in customer'}`}
              >
                <Printer size={19} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
