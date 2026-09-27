'use client';
import { TrendUp, TrendDown, Bell, ChartLineUp, CaretRight } from '@phosphor-icons/react';
import { useShopsStore } from '@/store/shops';
import { useShops } from '@/hooks/useShops';
import { useTransactions } from '@/hooks/useTransactions';
import { useAlerts } from '@/hooks/useAlerts';
import { useProducts } from '@/hooks/useStock';
import { useProfit } from '@/hooks/useProfit';
import { isDemoShop } from '@/lib/demo';
import Link from 'next/link';
import { quantityText } from '@/lib/quantity';
import PageWrapper from '@/components/layout/PageWrapper';
import { Skeleton } from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate, formatWhole, typeLabel } from '@/lib/utils';

export default function DashboardPage() {
  useShops();
  const activeShop = useShopsStore((s) => s.activeShop());

  const { data: txData, isLoading: txLoading } = useTransactions(activeShop?.id ?? '', { limit: 5 });
  const { data: alertData } = useAlerts('active');
  const { data: products = [] } = useProducts(activeShop?.id ?? '');
  const low = products.filter((p) => p.isLow);
  const { data: profit, isLoading: profitLoading } = useProfit(activeShop?.id ?? '');
  const demo = isDemoShop(activeShop?.id);

  // Accrual, like the reports: a credit sale is income and a bill on credit is a cost when recorded.
  const isCost  = (type: string) => type === 'expense' || type === 'payable';
  const income  = txData?.data.filter((t) => !isCost(t.type)).reduce((s, t) => s + t.amount, 0) ?? 0;
  const expense = txData?.data.filter((t) => isCost(t.type)).reduce((s, t) => s + t.amount, 0) ?? 0;

  // The demo shop has no server records to work profit out from, so it keeps the simple sums.
  const stats = demo ? [
    { label: 'Recent Income',   value: formatCurrency(income),          Icon: TrendUp },
    { label: 'Recent Expenses', value: formatCurrency(expense),          Icon: TrendDown },
    { label: 'Active Alerts',   value: String(alertData?.total ?? 0),   Icon: Bell },
  ] : [
    { label: 'Sales this month', value: profit ? formatWhole(profit.sales, activeShop?.currency) : '—', Icon: TrendUp },
    { label: 'Active Alerts',    value: String(alertData?.total ?? 0), Icon: Bell },
  ];
  const headline = profit?.insights.find((i) => i.kind !== 'empty');

  return (
    <PageWrapper title="Dashboard">
      {/* How the month is going, in one card: the Profit page has the rest. */}
      {!demo && (
        <Link href="/profit" className="glass-card group mb-4 block rounded-2xl p-5 transition hover:bg-white/[0.06]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-white/35">{profit && profit.profit < 0 ? 'Loss' : 'Profit'} this month</p>
            <ChartLineUp size={17} className="text-white/30" />
          </div>
          {profitLoading || !profit ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <>
              <p className="text-2xl font-bold tabular-nums text-white/85">{profit.profit < 0 && '−'}{formatWhole(Math.abs(profit.profit), activeShop?.currency)}</p>
              <p className="mt-1.5 flex items-center justify-between gap-3 text-[14px] text-white/50 sm:text-[13px]">
                <span>{headline?.text ?? 'Nothing recorded this month yet.'}</span>
                <CaretRight size={14} className="shrink-0 text-white/30 transition group-hover:text-white/60" />
              </p>
            </>
          )}
        </Link>
      )}

      {/* Stat cards */}
      <div className={`mb-6 grid grid-cols-1 gap-4 ${demo ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-white/35">{label}</p>
              <Icon size={17} className="text-white/30" />
            </div>
            <p className="text-2xl font-bold text-white/85">{value}</p>
          </div>
        ))}
      </div>

      {/* What needs restocking */}
      {low.length > 0 && (
        <div className="glass-card mb-6 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <p className="text-sm font-semibold text-white/75">Running low</p>
            <Link href="/stock" className="text-[13px] text-white/45 hover:text-white/80">See stock</Link>
          </div>
          {low.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3 last:border-0">
              <p className="min-w-0 truncate text-sm text-white/80">{p.name}</p>
              <span className="shrink-0 text-sm tabular-nums text-white/70">
                {p.quantity <= 0 ? 'Out of stock' : `${quantityText(p.quantity, p.unit)} left`}
              </span>
            </div>
          ))}
          {low.length > 5 && <p className="px-5 py-2.5 text-[13px] text-white/40">and {low.length - 5} more</p>}
        </div>
      )}

      {/* Recent transactions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <p className="text-sm font-semibold text-white/75">Recent transactions</p>
        </div>

        {txLoading ? (
          <div className="space-y-4 px-5 py-4" role="status" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        ) : txData?.data.length === 0 ? (
          <p className="px-5 py-8 text-sm text-white/30">No transactions yet.</p>
        ) : (
          txData?.data.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5 last:border-0 hover:bg-white/[0.02] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">{tx.description}</p>
                <p className="text-xs text-white/30">{formatDate(tx.date)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge>{typeLabel(tx.type)}</Badge>
                <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white/70">
                  {isCost(tx.type) ? '−' : '+'}{formatCurrency(tx.amount, tx.currency)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </PageWrapper>
  );
}
