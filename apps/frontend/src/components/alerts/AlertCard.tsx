'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, DotsThree, Package, X } from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ActionSheet, { type SheetAction } from '@/components/ui/ActionSheet';
import { formatDateTime, capitalize } from '@/lib/utils';
import type { Alert } from '@/types';

/** Everyday names; "overdue receivable" is accounting jargon. */
const TYPE_LABELS: Partial<Record<Alert['type'], string>> = {
  overdue_receivable: 'Customer owes you',
  bill_due: 'Bill due',
  low_stock: 'Low stock',
  duplicate: 'Recorded twice?',
};

interface AlertCardProps {
  alert: Alert;
  /** Show whether it's active, acknowledged…; only useful when the list mixes them. */
  showStatus?: boolean;
  onAcknowledge: () => Promise<unknown>;
  onDismiss: () => Promise<unknown>;
}

export default function AlertCard({ alert, showStatus, onAcknowledge, onDismiss }: AlertCardProps) {
  const [loading, setLoading] = useState<'ack' | 'dismiss' | null>(null);
  const [menu, setMenu] = useState(false);
  const stockLink = alert.type === 'low_stock' && alert.status !== 'resolved';

  async function run(kind: 'ack' | 'dismiss') {
    setLoading(kind);
    try { await (kind === 'ack' ? onAcknowledge() : onDismiss()); } finally { setLoading(null); }
  }

  const actions: SheetAction[] = [
    { label: 'Acknowledge', description: 'Keep it, but take it off the active list', icon: Check, onSelect: () => run('ack') },
    { label: 'Dismiss', description: "It isn't a problem", icon: X, onSelect: () => run('dismiss') },
    ...(stockLink ? [{ label: 'Go to stock', icon: Package, href: '/stock' }] : []),
  ];

  return (
    <div className="glass-card rounded-2xl p-4 transition-all hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {showStatus && <Badge>{capitalize(alert.status)}</Badge>}
            <Badge>{TYPE_LABELS[alert.type] ?? capitalize(alert.type)}</Badge>
          </div>
          <p className="text-[15px] leading-relaxed text-white/80 sm:text-sm">{alert.message}</p>
          {stockLink && (
            <Link href="/stock" className="mt-1.5 hidden text-[13px] text-white/55 underline-offset-2 hover:text-white/85 hover:underline sm:inline-block">
              Go to stock
            </Link>
          )}
          <p className="mt-1.5 text-xs text-white/35">{formatDateTime(alert.createdAt)}</p>
        </div>
        {alert.status === 'active' && (
          <>
            {/* Wider screens: the two actions, named. */}
            <div className="hidden shrink-0 gap-2 sm:flex">
              <Button size="sm" variant="secondary" onClick={() => run('ack')} loading={loading === 'ack'}>
                <Check size={12} /> Acknowledge
              </Button>
              <Button size="sm" variant="ghost" aria-label="Dismiss" onClick={() => run('dismiss')} loading={loading === 'dismiss'}>
                <X size={12} />
              </Button>
            </div>
            {/* Phones: one button; the actions open in a list with what each one does. */}
            <button
              type="button"
              aria-label="Alert actions"
              onClick={() => setMenu(true)}
              disabled={loading !== null}
              className="-mr-1.5 -mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 transition active:bg-white/[0.1] disabled:opacity-40 sm:hidden"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <DotsThree size={22} weight="bold" />}
            </button>
          </>
        )}
      </div>
      <ActionSheet open={menu} onClose={() => setMenu(false)} title={TYPE_LABELS[alert.type] ?? 'Alert'} actions={actions} />
    </div>
  );
}
