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
    { label: 'Recent Income',   value: formatCurrency(income),                Icon: TrendingUp,   accent: 'text-emerald-400' },
    { label: 'Recent Expenses', value: formatCurrency(expense),               Icon: TrendingDown, accent: 'text-red-400' },
    { label: 'Active Alerts',   value: String(alertData?.total ?? 0),         Icon: Bell,         accent: 'text-amber-400' },
  ];

  return (
    <PageWrapper title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {stats.map(({ label, value, Icon, accent }) => (
          <div key={label} className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</p>
              <Icon size={15} className={accent} />
            </div>
            <p className={`text-2xl font-bold ${accent}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <p className="text-sm font-semibold text-white/80">Recent transactions</p>
        </div>

        {txLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-white/30">
            <Spinner className="h-4 w-4 text-amber-400/50" /> Loading…
          </div>
        ) : txData?.data.length === 0 ? (
          <p className="px-5 py-8 text-sm text-white/30">No transactions yet.</p>
        ) : (
          txData?.data.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5 last:border-0 hover:bg-white/[0.02] transition-colors">
              <div>
                <p className="text-sm font-medium text-white/85">{tx.description}</p>
                <p className="text-xs text-white/30">{tx.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge color={tx.type === 'income' ? 'green' : tx.type === 'expense' ? 'red' : 'blue'}>
                  {tx.type}
                </Badge>
                <span className={`text-sm font-semibold tabular-nums ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(tx.amount, tx.currency)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </PageWrapper>
  );
}
