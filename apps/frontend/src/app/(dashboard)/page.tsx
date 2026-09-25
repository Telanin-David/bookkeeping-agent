'use client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Bell } from 'lucide-react';
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

  const income  = txData?.data.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0;
  const expense = txData?.data.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0;

  const stats = [
    { label: 'Recent Income',   value: formatCurrency(income),              Icon: TrendingUp },
    { label: 'Recent Expenses', value: formatCurrency(expense),             Icon: TrendingDown },
    { label: 'Active Alerts',   value: String(alertData?.total ?? 0),       Icon: Bell },
  ];

  return (
    <PageWrapper title="Dashboard">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/35">{label}</p>
              <Icon size={14} className="text-white/25" strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-semibold text-white/85 tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-3.5">
          <p className="text-sm font-medium text-white/70">Recent transactions</p>
        </div>

        {txLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-white/30">
            <Spinner className="h-4 w-4" /> Loading…
          </div>
        ) : txData?.data.length === 0 ? (
          <p className="px-5 py-8 text-sm text-white/25">No transactions yet.</p>
        ) : (
          txData?.data.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5 last:border-0 hover:bg-white/[0.02] transition-colors">
              <div>
                <p className="text-sm font-medium text-white/80">{tx.description}</p>
                <p className="text-xs text-white/30 mt-0.5">{tx.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{tx.type}</Badge>
                <span className="text-sm font-medium tabular-nums text-white/75">
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
