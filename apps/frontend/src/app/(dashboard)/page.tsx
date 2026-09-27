'use client';
import { TrendUp, TrendDown, Bell } from '@phosphor-icons/react';
import { useShopsStore } from '@/store/shops';
import { useShops } from '@/hooks/useShops';
import { useTransactions } from '@/hooks/useTransactions';
import { useAlerts } from '@/hooks/useAlerts';
import { useProducts } from '@/hooks/useStock';
import Link from 'next/link';
import { quantityText } from '@/lib/quantity';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate, typeLabel } from '@/lib/utils';

export default function DashboardPage() {
  useShops();
  const activeShop = useShopsStore((s) => s.activeShop());

  const { data: txData, isLoading: txLoading } = useTransactions(activeShop?.id ?? '', { limit: 5 });
  const { data: alertData } = useAlerts('active');
  const { data: products = [] } = useProducts(activeShop?.id ?? '');
  const low = products.filter((p) => p.isLow);

  // Accrual, like the reports: a credit sale is income and a bill on credit is a cost when recorded.
  const isCost  = (type: string) => type === 'expense' || type === 'payable';
  const income  = txData?.data.filter((t) => !isCost(t.type)).reduce((s, t) => s + t.amount, 0) ?? 0;
  const expense = txData?.data.filter((t) => isCost(t.type)).reduce((s, t) => s + t.amount, 0) ?? 0;

  const stats = [
    { label: 'Recent Income',   value: formatCurrency(income),          Icon: TrendUp },
    { label: 'Recent Expenses', value: formatCurrency(expense),          Icon: TrendDown },
    { label: 'Active Alerts',   value: String(alertData?.total ?? 0),   Icon: Bell },
  ];

  return (
    <PageWrapper title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
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
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-white/30">
            <Spinner className="h-4 w-4 text-white/20" /> Loading…
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
