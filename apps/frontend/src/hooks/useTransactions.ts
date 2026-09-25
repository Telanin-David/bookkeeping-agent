'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import { DEMO_TRANSACTIONS, findDemoTransaction, isDemoShop } from '@/lib/demo';
import type { PaginatedResponse, Transaction } from '@/types';

function demoPage(params?: Parameters<typeof transactionsApi.list>[1]): PaginatedResponse<Transaction> {
  const data = DEMO_TRANSACTIONS.filter((t) =>
    (!params?.type || t.type === params.type) && (!params?.status || t.status === params.status));
  return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
}

export function useTransactions(shopId: string, params?: Parameters<typeof transactionsApi.list>[1]) {
  return useQuery({
    queryKey: ['transactions', shopId, params],
    queryFn: () => isDemoShop(shopId)
      ? Promise.resolve(demoPage(params))
      : transactionsApi.list(shopId, params).then((r) => r.data),
    enabled: !!shopId,
  });
}

export function useTransaction(shopId: string, txId: string) {
  return useQuery({
    queryKey: ['transaction', shopId, txId],
    queryFn: () => isDemoShop(shopId)
      ? Promise.resolve(findDemoTransaction(txId))
      : transactionsApi.get(shopId, txId).then((r) => r.data),
    enabled: !!shopId && !!txId,
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
