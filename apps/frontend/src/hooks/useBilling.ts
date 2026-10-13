'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { BillingInfo, PlanFeatures } from '@/types';

/** The signed-in owner's plan: what it includes, what's on offer, recent payments. */
export function useBilling() {
  const signedIn = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({ queryKey: ['billing'], queryFn: billingApi.me, enabled: signedIn, staleTime: 60_000 });
}

/**
 * Whether the owner's plan includes a feature. While the plan is still loading (or payments
 * are off) everything counts as included, so nothing flashes "locked" on screen; the server
 * has the final say either way.
 */
export function useFeature(feature: Exclude<keyof PlanFeatures, 'maxShops'>): boolean {
  const { data } = useBilling();
  return data ? data.features[feature] : true;
}

export function useRefreshBilling() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['billing'] });
}

export const isPaying = (b?: BillingInfo) => !!b && ['monthly', 'yearly', 'weekly', 'day'].includes(b.plan);
