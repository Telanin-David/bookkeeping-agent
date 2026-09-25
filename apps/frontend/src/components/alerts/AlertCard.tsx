'use client';
import { useState } from 'react';
import { Check, X } from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDateTime, capitalize } from '@/lib/utils';
import type { Alert } from '@/types';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: () => Promise<unknown>;
  onDismiss: () => Promise<unknown>;
}

export default function AlertCard({ alert, onAcknowledge, onDismiss }: AlertCardProps) {
  const [loading, setLoading] = useState<'ack' | 'dismiss' | null>(null);

  async function handleAck() {
    setLoading('ack');
    try { await onAcknowledge(); } finally { setLoading(null); }
  }

  async function handleDismiss() {
    setLoading('dismiss');
    try { await onDismiss(); } finally { setLoading(null); }
  }

  return (
    <div className="glass-card rounded-2xl p-4 transition-all hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge>{capitalize(alert.status)}</Badge>
            <Badge>{capitalize(alert.type.replace(/_/g, ' '))}</Badge>
          </div>
          <p className="text-sm text-white/75 leading-relaxed">{alert.message}</p>
          <p className="mt-1.5 text-xs text-white/30">{formatDateTime(alert.createdAt)}</p>
        </div>
        {alert.status === 'active' && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={handleAck} loading={loading === 'ack'}>
              <Check size={12} />
              <span className="hidden sm:inline">Acknowledge</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} loading={loading === 'dismiss'}>
              <X size={12} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
