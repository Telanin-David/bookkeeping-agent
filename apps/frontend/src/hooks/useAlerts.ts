'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { DEMO_ALERTS, isDemoShop, setDemoAlertStatus } from '@/lib/demo';
import { useShopsStore } from '@/store/shops';
import { useAuthStore } from '@/store/auth';
import type { Alert, AlertStatus, PaginatedResponse } from '@/types';

function demoPage(status: AlertStatus | ''): PaginatedResponse<Alert> {
  const data = DEMO_ALERTS.filter((a) => !status || a.status === status);
  return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
}

export function useAlerts(status: AlertStatus | '') {
  const shop = useShopsStore((s) => s.activeShop());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDemo = isDemoShop(shop?.id);

  return useQuery({
    queryKey: ['alerts', status, isDemo],
    queryFn: () => isDemo
      ? Promise.resolve(demoPage(status))
      : alertsApi.list({ status: status || undefined, limit: 50 }).then((r) => r.data),
    enabled: isAuthenticated,
  });
}

export function useAlertAction() {
  const qc = useQueryClient();
  const shop = useShopsStore((s) => s.activeShop());
  const isDemo = isDemoShop(shop?.id);

  async function apply(alert: Alert, action: 'ack' | 'dismiss'): Promise<Alert> {
    const newStatus: AlertStatus = action === 'ack' ? 'acknowledged' : 'dismissed';
    const updated = isDemo
      ? setDemoAlertStatus(alert.id, newStatus)
      : (await (action === 'ack' ? alertsApi.acknowledge(alert.id) : alertsApi.dismiss(alert.id))).data;

    qc.invalidateQueries({ queryKey: ['alerts'] });
    return updated;
  }

  return { apply };
}
