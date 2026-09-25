'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import type { Transaction } from '@/types';

export function useTransactions(shopId: string, params?: Parameters<typeof transactionsApi.list>[1]) {
  return useQuery({
    queryKey: ['transactions', shopId, params],
    queryFn: () => transactionsApi.list(shopId, params).then((r) => r.data),
    enabled: !!shopId,
  });
}

export function useCreateTransaction(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof transactionsApi.create>[1]) =>
      transactionsApi.create(shopId, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', shopId] }),
  });
}

export function useUpdateTransaction(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Transaction> & { id: string }) =>
      transactionsApi.update(shopId, id, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', shopId] }),
  });
}

export function useDeleteTransaction(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txId: string) => transactionsApi.delete(shopId, txId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', shopId] }),
  });
}
