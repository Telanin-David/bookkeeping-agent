'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { useAlertsStore } from '@/store/alerts';
import PageWrapper from '@/components/layout/PageWrapper';
import AlertCard from '@/components/alerts/AlertCard';
import Spinner from '@/components/ui/Spinner';
import type { Alert } from '@/types';

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'acknowledged' | 'dismissed' | ''>('active');
  const setActiveCount = useAlertsStore((s) => s.setActiveCount);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts', statusFilter],
    queryFn: async () => {
      const res = await alertsApi.list({ status: statusFilter || undefined, limit: 50 });
      if (!statusFilter || statusFilter === 'active') setActiveCount(res.data.total);
      return res.data;
    },
  });

  function handleUpdate(updated: Alert) {
    refetch();
  }

  return (
    <PageWrapper title="Alerts">
      <div className="mb-4 flex gap-2">
        {(['active', 'acknowledged', 'dismissed', ''] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Spinner className="h-4 w-4" /> Loading…</div>
      ) : (
        <div className="space-y-3">
          {data?.data.length === 0 && <p className="text-sm text-gray-400">No alerts.</p>}
          {data?.data.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
