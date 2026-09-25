'use client';
import { useState } from 'react';
import { alertsApi } from '@/lib/api';
import { useAlertsStore } from '@/store/alerts';
import Badge from '@/components/ui/Badge';
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
    try {
      const { data } = await alertsApi.acknowledge(alert.id);
      onUpdate(data);
      decrement();
    } finally { setLoading(null); }
  }

  async function handleDismiss() {
    setLoading('dismiss');
    try {
      const { data } = await alertsApi.dismiss(alert.id);
      onUpdate(data);
      decrement();
    } finally { setLoading(null); }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge color={alert.status === 'active' ? 'red' : 'gray'}>{capitalize(alert.status)}</Badge>
            <Badge color="blue">{capitalize(alert.type)}</Badge>
          </div>
          <p className="text-sm text-gray-800">{alert.message}</p>
          <p className="mt-1 text-xs text-gray-400">{formatDateTime(alert.createdAt)}</p>
        </div>
        {alert.status === 'active' && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleAck} loading={loading === 'ack'}>
              Acknowledge
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} loading={loading === 'dismiss'}>
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
