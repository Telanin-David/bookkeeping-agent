'use client';
import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import { profitApi, staffApi } from '@/lib/api';
import { isDemoShop } from '@/lib/demo';
import type { StaffFields } from '@/types';

export function useProfit(shopId: string, month?: string) {
  return useQuery({
    queryKey: ['profit', shopId, month ?? 'current'],
    queryFn: () => profitApi.get(shopId, month),
    enabled: !!shopId && !isDemoShop(shopId),
    // Stepping between months keeps the last one on screen instead of flashing empty.
    placeholderData: keepPreviousData,
  });
}

export function useStaff(shopId: string) {
  return useQuery({
    queryKey: ['staff', shopId],
    queryFn: () => staffApi.list(shopId),
    enabled: !!shopId && !isDemoShop(shopId),
  });
}

// Staff changes and salary payments move profit, the transaction list and pay-day reminders.
function refresh(qc: QueryClient, shopId: string) {
  qc.invalidateQueries({ queryKey: ['staff', shopId] });
  qc.invalidateQueries({ queryKey: ['profit', shopId] });
  qc.invalidateQueries({ queryKey: ['transactions', shopId] });
  qc.invalidateQueries({ queryKey: ['alerts'] });
}

export function useSaveStaff(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: StaffFields & { id?: string }) =>
      id ? staffApi.update(shopId, id, body) : staffApi.create(shopId, body),
    onSuccess: () => refresh(qc, shopId),
  });
}

export function useRemoveStaff(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffApi.remove(shopId, id).then(() => undefined),
    onSuccess: () => refresh(qc, shopId),
  });
}

export function usePaySalaries(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { date?: string; payments: { staffId: string; amount: number }[] }) => staffApi.pay(shopId, body),
    onSuccess: () => refresh(qc, shopId),
  });
}
