'use client';
import { useQuery } from '@tanstack/react-query';
import { TrendUp, TrendDown, Bell } from '@phosphor-icons/react';
import { transactionsApi, alertsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import { useShops } from '@/hooks/useShops';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  useShops();
  const activeShop = useShopsStore((s) => s.activeShop());

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', activeShop?.id, 'recent'],
    queryFn: () => transactionsApi.list(activeShop!.id, { limit: 5 }).then((r) => r.data),
    enabled: !!activeShop,
  });

  const { data: alertData } = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: () => alertsApi.list({ status: 'active', limit: 3 }).then((r) => r.data),
  });

  const income  = txData?.data.filter((t) => t.type === 'sale').reduce((s, t) => s + t.amount, 0) ?? 0;
  const expense = txData?.data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0;

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
              <div>
                <p className="text-sm font-medium text-white/80">{tx.description}</p>
                <p className="text-xs text-white/30">{tx.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{tx.type}</Badge>
                <span className="text-sm font-medium tabular-nums text-white/70">
                  {tx.type === 'expense' ? '−' : '+'}{formatCurrency(tx.amount, tx.currency)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </PageWrapper>
  );
}
