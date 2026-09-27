'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAlerts, useAlertAction } from '@/hooks/useAlerts';
import PageWrapper from '@/components/layout/PageWrapper';
import AlertCard from '@/components/alerts/AlertCard';
import Spinner from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { AlertStatus } from '@/types';

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('active');
  const { data, isLoading } = useAlerts(statusFilter);
  const { apply } = useAlertAction();

  return (
    <PageWrapper
      title="Alerts"
      actions={<Link href="/settings/alerts" className="rounded-xl px-3 py-2 text-[14px] text-white/60 transition hover:bg-white/[0.06] hover:text-white/90">Email settings</Link>}
    >
      <div className="mb-5 inline-flex max-w-full overflow-x-auto rounded-full glass p-1" role="tablist">
        {(['active', 'acknowledged', 'dismissed', 'resolved', ''] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'h-9 shrink-0 rounded-full px-3 text-[13px] font-medium transition sm:px-4 sm:text-[14px]',
              statusFilter === s ? 'bg-white/[0.12] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]' : 'text-white/50 hover:text-white/80',
            )}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[14px] text-white/40"><Spinner className="h-4 w-4 text-white/20" /> Loading…</div>
      ) : (
        <div className="space-y-3">
          {data?.data.length === 0 && <p className="text-[14px] text-white/35">No alerts.</p>}
          {data?.data.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onAcknowledge={() => apply(alert, 'ack')} onDismiss={() => apply(alert, 'dismiss')} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
