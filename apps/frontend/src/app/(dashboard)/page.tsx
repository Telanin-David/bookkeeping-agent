'use client';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, alertsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import { useShops } from '@/hooks/useShops';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  useShops(); // loads shops + sets activeShopId
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

  return (
    <PageWrapper title="Dashboard">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Recent Income',   value: formatCurrency(income),  color: 'text-green-600' },
          { label: 'Recent Expenses', value: formatCurrency(expense), color: 'text-red-600' },
          { label: 'Active Alerts',   value: String(alertData?.total ?? 0), color: 'text-yellow-600' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {txLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner className="h-4 w-4" /> Loading transactions…</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <p className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-700">Recent transactions</p>
          {txData?.data.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-400">No transactions yet. Add your first one in Transactions.</p>
          )}
          {txData?.data.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-gray-50 px-5 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{tx.description}</p>
                <p className="text-xs text-gray-400">{tx.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={tx.type === 'income' ? 'green' : tx.type === 'expense' ? 'red' : 'blue'}>
                  {tx.type}
                </Badge>
                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(tx.amount, tx.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
