'use client';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { stockApi, type ProductFields } from '@/lib/api';
import { demoStock, isDemoShop } from '@/lib/demo';

// Any stock change can raise or resolve a low-stock alert, so alerts are refreshed too.
function refreshStock(qc: QueryClient, shopId: string) {
  qc.invalidateQueries({ queryKey: ['products', shopId] });
  qc.invalidateQueries({ queryKey: ['movements', shopId] });
  qc.invalidateQueries({ queryKey: ['alerts'] });
}

export function useProducts(shopId: string) {
  return useQuery({
    queryKey: ['products', shopId],
    queryFn: () => (isDemoShop(shopId) ? Promise.resolve(demoStock.list()) : stockApi.listProducts(shopId)),
    enabled: !!shopId,
  });
}

export function useMovements(shopId: string, productId: string | null) {
  return useQuery({
    queryKey: ['movements', shopId, productId],
    queryFn: () => (isDemoShop(shopId) ? Promise.resolve(demoStock.movements(productId!)) : stockApi.listMovements(shopId, productId!)),
    enabled: !!shopId && !!productId,
  });
}

/** Wraps a demo-mode call so it fails like a request would, instead of throwing synchronously. */
const demo = <T,>(fn: () => T): Promise<T> => Promise.resolve().then(fn);

export function useCreateProduct(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductFields & { openingQuantity?: number }) =>
      isDemoShop(shopId) ? demo(() => demoStock.create(body)) : stockApi.createProduct(shopId, body),
    onSuccess: () => refreshStock(qc, shopId),
  });
}

export function useUpdateProduct(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ProductFields> & { id: string }) =>
      isDemoShop(shopId) ? demo(() => demoStock.update(id, body)) : stockApi.updateProduct(shopId, id, body),
    onSuccess: () => refreshStock(qc, shopId),
  });
}

export function useRemoveProduct(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (isDemoShop(shopId) ? demo(() => demoStock.remove(id)) : stockApi.removeProduct(shopId, id).then(() => undefined)),
    onSuccess: () => refreshStock(qc, shopId),
  });
}

export function useAdjustStock(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, ...body }: { productId: string; kind: 'restock' | 'adjustment'; change: number; occurredOn?: string; note?: string }) =>
      isDemoShop(shopId) ? demo(() => demoStock.adjust(productId, body)) : stockApi.adjust(shopId, productId, body),
    onSuccess: () => refreshStock(qc, shopId),
  });
}

export function useUndoMovement(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) => (isDemoShop(shopId) ? demo(() => demoStock.undo(movementId)) : stockApi.undoMovement(shopId, movementId)),
    onSuccess: () => refreshStock(qc, shopId),
  });
}

export function useShelfCount(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { productId: string; counted: number }[]) =>
      isDemoShop(shopId) ? demo(() => demoStock.count(items)) : stockApi.count(shopId, { items }),
    onSuccess: () => refreshStock(qc, shopId),
  });
}
