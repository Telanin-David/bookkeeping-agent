'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAlerts, useAlertAction } from '@/hooks/useAlerts';
import PageWrapper from '@/components/layout/PageWrapper';
import AlertCard from '@/components/alerts/AlertCard';
import ActionSheet from '@/components/ui/ActionSheet';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { CaretDown, GearSix } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { AlertStatus } from '@/types';

const FILTERS = ['active', 'acknowledged', 'dismissed', 'resolved', ''] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  active: 'Active', acknowledged: 'Acknowledged', dismissed: 'Dismissed', resolved: 'Resolved', '': 'All',
};
const FILTER_HINTS: Record<(typeof FILTERS)[number], string> = {
  active: 'Still needs your attention',
  acknowledged: "You've seen it",
  dismissed: "You said it wasn't a problem",
  resolved: 'Sorted itself out, e.g. the debt was paid',
  '': 'Everything',
};

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('active');
  const { data, isLoading } = useAlerts(statusFilter);
  const { apply } = useAlertAction();
  const [picking, setPicking] = useState(false);

  return (
    <PageWrapper
      title="Alerts"
      actions={(
        <>
          <Link href="/settings/alerts" className="hidden rounded-xl px-3 py-2 text-[14px] text-white/60 transition hover:bg-white/[0.06] hover:text-white/90 sm:block">Email settings</Link>
          <Link href="/settings/alerts" aria-label="Alert email settings" className="flex h-11 w-11 items-center justify-center rounded-full glass-elevated text-white/80 transition active:scale-[0.94] sm:hidden">
            <GearSix size={20} />
          </Link>
        </>
      )}
    >
      {/* Phones: one button showing the current choice; the choices open in a list. */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="mb-4 flex h-10 items-center gap-2 rounded-full glass px-4 text-[14px] text-white/60 transition active:scale-[0.97] sm:hidden"
      >
        Showing <span className="font-medium text-white/90">{FILTER_LABELS[statusFilter]}</span>
        <CaretDown size={14} weight="bold" className="text-white/50" />
      </button>
      <ActionSheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Show alerts"
        actions={FILTERS.map((f) => ({ label: FILTER_LABELS[f], description: FILTER_HINTS[f], selected: statusFilter === f, onSelect: () => setStatusFilter(f) }))}
      />

      {/* Wider screens: tabs. */}
      <div className="mb-5 hidden max-w-full overflow-x-auto rounded-full glass p-1 sm:inline-flex" role="tablist">
        {FILTERS.map((s) => (
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
            {FILTER_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-3">
          {data?.data.length === 0 && (
            <p className="glass-card rounded-2xl px-5 py-8 text-center text-[14px] text-white/40">
              {statusFilter === 'active' ? 'Nothing needs your attention.' : 'No alerts here.'}
            </p>
          )}
          {data?.data.map((alert) => (
            <AlertCard key={alert.id} alert={alert} showStatus={statusFilter === ''} onAcknowledge={() => apply(alert, 'ack')} onDismiss={() => apply(alert, 'dismiss')} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
