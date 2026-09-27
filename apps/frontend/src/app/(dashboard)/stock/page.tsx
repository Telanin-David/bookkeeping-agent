'use client';
import { useState } from 'react';
import { useShopsStore } from '@/store/shops';
import { useCreateProduct, useProducts } from '@/hooks/useStock';
import PageWrapper from '@/components/layout/PageWrapper';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import ProductForm from '@/components/stock/ProductForm';
import ProductModal from '@/components/stock/ProductModal';
import ShelfCount from '@/components/stock/ShelfCount';
import { quantityText } from '@/lib/quantity';
import { cn, formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';

const lowLabel = (p: Product) => (p.quantity <= 0 ? 'Out of stock' : 'Running low');

export default function StockPage() {
  const shop = useShopsStore((s) => s.activeShop());
  const shopId = shop?.id ?? '';
  const { data: products = [], isLoading } = useProducts(shopId);
  const create = useCreateProduct(shopId);
  const [adding, setAdding] = useState(false);
  const [counting, setCounting] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const low = products.filter((p) => p.isLow);
  const shown = lowOnly ? low : products;

  return (
    <PageWrapper
      title="Stock"
      actions={(
        <div className="flex gap-2">
          {products.length > 0 && <Button variant="secondary" onClick={() => setCounting(true)}>Count shelf</Button>}
          <Button onClick={() => setAdding(true)}>+ Add product</Button>
        </div>
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-white/30"><Spinner className="h-4 w-4 text-white/20" /> Loading…</div>
      ) : products.length === 0 ? (
        <div className="glass-card max-w-lg rounded-2xl p-6">
          <p className="text-[15px] text-white/85">Keep track of what&apos;s on your shelves</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/50">
            Add the things you sell and how many you have. Sales recorded with a product take it off the shelf,
            you&apos;ll be warned when something runs low, and a shelf count shows if anything has gone missing.
          </p>
          <Button className="mt-4" onClick={() => setAdding(true)}>Add your first product</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-white/55">
              {products.length} {products.length === 1 ? 'product' : 'products'}
              {low.length > 0 && <> · <span className="font-medium text-white/85">{low.length} running low</span></>}
            </p>
            <div className="inline-flex rounded-full glass p-1" role="tablist">
              {[false, true].map((v) => (
                <button
                  key={String(v)} role="tab" aria-selected={lowOnly === v} onClick={() => setLowOnly(v)}
                  className={cn('h-8 rounded-full px-3.5 text-[13px] font-medium transition', lowOnly === v ? 'bg-white/[0.12] text-white' : 'text-white/50 hover:text-white/80')}
                >
                  {v ? 'Running low' : 'All'}
                </button>
              ))}
            </div>
          </div>

          <ul className="glass-card divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
            {shown.length === 0 && <li className="px-5 py-8 text-center text-[14px] text-white/35">Nothing is running low.</li>}
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelected(p)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.03] sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-white/90">{p.name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-white/40">
                      {p.sellingPrice !== null ? `${formatCurrency(p.sellingPrice)} each` : 'No selling price'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('text-[15px] font-medium tabular-nums', p.isLow ? 'text-white' : 'text-white/80')}>
                      {quantityText(p.quantity, p.unit)}
                    </span>
                    {p.isLow && <Badge className="border-white/20 bg-white/[0.12] text-white/85">{lowLabel(p)}</Badge>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a product">
        {adding && <ProductForm onCancel={() => setAdding(false)} onSubmit={async (values) => { await create.mutateAsync(values); setAdding(false); }} />}
      </Modal>
      <ProductModal shopId={shopId} product={selected} onClose={() => setSelected(null)} />
      <ShelfCount shopId={shopId} products={products} open={counting} onClose={() => setCounting(false)} />
    </PageWrapper>
  );
}
