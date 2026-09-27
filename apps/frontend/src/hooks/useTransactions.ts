'use client';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import {
  DEMO_TRANSACTIONS, findDemoTransaction, isDemoShop, updateDemoTransaction,
  listDemoPayments, recordDemoPayment, removeDemoPayment,
} from '@/lib/demo';
import type { PaginatedResponse, Transaction } from '@/types';

function demoPage(params?: Parameters<typeof transactionsApi.list>[1]): PaginatedResponse<Transaction> {
  const matching = DEMO_TRANSACTIONS.filter((t) =>
    (!params?.type || t.type === params.type) && (!params?.status || t.status === params.status));
  const data = params?.limit ? matching.slice(0, params.limit) : matching;
  return { data, total: matching.length, page: 1, limit: data.length, totalPages: 1 };
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', shopId] });
      qc.invalidateQueries({ queryKey: ['profit', shopId] });
      qc.invalidateQueries({ queryKey: ['staff', shopId] });
      // A sale or purchase with products moves stock, which can raise or clear a low-stock alert.
      qc.invalidateQueries({ queryKey: ['products', shopId] });
      qc.invalidateQueries({ queryKey: ['movements', shopId] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useUpdateTransaction(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Transaction> & { id: string }) => isDemoShop(shopId)
      ? Promise.resolve(updateDemoTransaction(id, body))
      : transactionsApi.update(shopId, id, body).then((r) => r.data),
    onSuccess: (tx) => {
      qc.invalidateQueries({ queryKey: ['transactions', shopId] });
      qc.invalidateQueries({ queryKey: ['profit', shopId] });
      qc.invalidateQueries({ queryKey: ['staff', shopId] });
      qc.invalidateQueries({ queryKey: ['transaction', shopId, tx.id] });
    },
  });
}

export function useDeleteTransaction(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txId: string) => transactionsApi.delete(shopId, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', shopId] });
      qc.invalidateQueries({ queryKey: ['profit', shopId] });
      qc.invalidateQueries({ queryKey: ['staff', shopId] });
      qc.invalidateQueries({ queryKey: ['products', shopId] });
      qc.invalidateQueries({ queryKey: ['movements', shopId] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

// ── Payments towards a debt ──────────────────────────────────

export function usePayments(shopId: string, txId: string | null) {
  return useQuery({
    queryKey: ['payments', shopId, txId],
    queryFn: () => isDemoShop(shopId)
      ? Promise.resolve(listDemoPayments(txId!))
      : transactionsApi.listPayments(shopId, txId!),
    enabled: !!shopId && !!txId,
  });
}

/** After a payment changes, the debt's status and balance change everywhere it's shown. */
function refreshDebt(qc: QueryClient, shopId: string, txId: string) {
  qc.invalidateQueries({ queryKey: ['transactions', shopId] });
  qc.invalidateQueries({ queryKey: ['profit', shopId] });
  qc.invalidateQueries({ queryKey: ['staff', shopId] });
  qc.invalidateQueries({ queryKey: ['transaction', shopId, txId] });
  qc.invalidateQueries({ queryKey: ['payments', shopId, txId] });
}

export function useRecordPayment(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, amount, paidOn }: { txId: string; amount?: number; paidOn: string }) => isDemoShop(shopId)
      ? Promise.resolve().then(() => recordDemoPayment(txId, amount, paidOn))
      : transactionsApi.recordPayment(shopId, txId, { amount, paidOn }).then((r) => r.transaction),
    onSuccess: (tx) => refreshDebt(qc, shopId, tx.id),
  });
}

export function useRemovePayment(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, paymentId }: { txId: string; paymentId: string }) => isDemoShop(shopId)
      ? Promise.resolve(removeDemoPayment(txId, paymentId))
      : transactionsApi.removePayment(shopId, txId, paymentId),
    onSuccess: (tx) => refreshDebt(qc, shopId, tx.id),
  });
}
