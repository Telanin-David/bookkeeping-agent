'use client';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { alertsApi } from '@/lib/api';
import { useAlertsStore } from '@/store/alerts';
import Button from '@/components/ui/Button';
import { formatDateTime, capitalize } from '@/lib/utils';
import type { Alert } from '@/types';

interface AlertCardProps {
  alert: Alert;
  onUpdate: (updated: Alert) => void;
}

export default function AlertCard({ alert, onUpdate }: AlertCardProps) {
  const [loading, setLoading] = useState<'ack' | 'dismiss' | null>(null);
  const decrement = useAlertsStore((s) => s.decrement);

  async function handleAck() {
    setLoading('ack');
    try { const { data } = await alertsApi.acknowledge(alert.id); onUpdate(data); decrement(); }
    finally { setLoading(null); }
  }

  async function handleDismiss() {
    setLoading('dismiss');
    try { const { data } = await alertsApi.dismiss(alert.id); onUpdate(data); decrement(); }
    finally { setLoading(null); }
  }

  return (
    <div className="glass-card rounded-2xl p-4 transition hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/35">
              {capitalize(alert.status)}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-white/35">
              {capitalize(alert.type.replace(/_/g, ' '))}
            </span>
          </div>
          <p className="text-sm text-white/75 leading-relaxed">{alert.message}</p>
          <p className="mt-1.5 text-xs text-white/25">{formatDateTime(alert.createdAt)}</p>
        </div>
        {alert.status === 'active' && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="secondary" onClick={handleAck} loading={loading === 'ack'}>
              <Check size={11} />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} loading={loading === 'dismiss'}>
              <X size={11} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
