'use client';
import { useState, type FormEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import ProductForm from '@/components/stock/ProductForm';
import { useAdjustStock, useMovements, useProducts, useRemoveProduct, useUndoMovement, useUpdateProduct } from '@/hooks/useStock';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { isDemoShop } from '@/lib/demo';
import { useShopsStore } from '@/store/shops';
import { errorMessage } from '@/lib/errors';
import { formatQuantity, pluralUnit, quantityText } from '@/lib/quantity';
import { cn, formatCurrency, formatDate, todayInLagos } from '@/lib/utils';
import type { Product, StockMovement } from '@/types';

type Mode = 'view' | 'add' | 'remove' | 'edit';

const REMOVE_REASONS = ['Damaged', 'Expired', 'Used in the shop', 'Given away', 'Other'];

/** What happened, in words: "Sold", "Shelf count: 18 counted, 2 missing"… */
function describe(m: StockMovement, unit: string): string {
  switch (m.kind) {
    case 'opening': return 'Starting stock';
    case 'restock': return m.transactionId ? 'Bought' : 'Stock added';
    case 'sale': return 'Sold';
    case 'count': {
      const d = Math.round(m.change * 100) / 100;
      const result = d === 0 ? 'matched' : d < 0 ? `${quantityText(-d, unit)} missing` : `${quantityText(d, unit)} more than recorded`;
      return `Shelf count: ${formatQuantity(m.counted ?? 0)} counted, ${result}`;
    }
    case 'adjustment': return m.note ? (m.change < 0 ? `Removed: ${m.note}` : `Added: ${m.note}`) : (m.change < 0 ? 'Removed' : 'Added');
  }
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3.5 py-2">
      <span className="text-[13px] text-white/45">{label}</span>
      <span className={cn('text-right text-[14px] tabular-nums', strong ? 'font-semibold text-white/95' : 'text-white/75')}>{value}</span>
    </div>
  );
}

function AddStockForm({ shopId, product, onDone }: { shopId: string; product: Product; onDone: () => void }) {
  const adjust = useAdjustStock(shopId);
  const createTx = useCreateTransaction(shopId);
  const currency = useShopsStore((s) => s.activeShop()?.currency) ?? 'NGN';
  const today = todayInLagos();
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState('');
  // Money can only be recorded against real records; demo mode just moves the stock.
  const canRecordCost = !isDemoShop(shopId);

  // Suggest what it cost from the cost price, once a quantity is typed.
  const suggested = product.costPrice !== null && Number(qty) > 0 ? Math.round(Number(qty) * product.costPrice * 100) / 100 : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const quantity = Number(qty);
    const amount = paid.trim() === '' ? null : Number(paid);
    if (!(quantity > 0)) return setError('Enter how many came in.');
    if (date > today) return setError('The date can’t be in the future.');
    if (amount !== null && !(amount > 0)) return setError('Enter what you paid, or leave it empty.');
    try {
      if (amount !== null) {
        // A purchase: the cost goes into the books and the stock onto the shelf, together.
        await createTx.mutateAsync({
          type: onCredit ? 'payable' : 'expense', amount, currency, status: onCredit ? 'pending' : 'settled',
          description: `${quantityText(quantity, product.unit)} of ${product.name}`, category: 'Stock',
          counterparty: supplier.trim() || undefined, date, items: [{ productId: product.id, quantity }],
        });
      } else {
        await adjust.mutateAsync({ productId: product.id, kind: 'restock', change: quantity, occurredOn: date });
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add the stock. Check your connection and try again."));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
        <Input id="add-qty" label={`How many ${pluralUnit(product.unit)}`} type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => { setQty(e.target.value); setError(''); }} />
        <Input id="add-date" label="Date" type="date" max={today} value={date} onChange={(e) => { setDate(e.target.value); setError(''); }} />
      </div>
      {canRecordCost && (
        <>
          <Input
            id="add-paid" label="What you paid (optional)" type="number" inputMode="decimal" min="0" step="0.01"
            placeholder={suggested !== null ? String(suggested) : ''} value={paid} onChange={(e) => { setPaid(e.target.value); setError(''); }}
            hint={paid.trim() ? 'Recorded as an expense too, so your profit is right.' : 'Fill this in to record the cost as an expense as well.'}
          />
          {paid.trim() !== '' && (
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
              <Select id="add-credit" label="Paid" value={onCredit ? 'credit' : 'now'} onChange={(e) => setOnCredit(e.target.value === 'credit')}>
                <option value="now" className="bg-ink-900">Paid now</option>
                <option value="credit" className="bg-ink-900">On credit</option>
              </Select>
              <Input id="add-supplier" label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          )}
        </>
      )}
      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="lg" loading={adjust.isPending || createTx.isPending}>Add stock</Button>
      </FormActions>
    </form>
  );
}

function RemoveStockForm({ shopId, product, onDone }: { shopId: string; product: Product; onDone: () => void }) {
  const adjust = useAdjustStock(shopId);
  const today = todayInLagos();
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(REMOVE_REASONS[0]!);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const quantity = Number(qty);
    if (!(quantity > 0)) return setError('Enter how many to remove.');
    try {
      await adjust.mutateAsync({
        productId: product.id, kind: 'adjustment', change: -quantity, occurredOn: today,
        note: reason === 'Other' ? note.trim() || 'Other' : reason,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't remove the stock. Check your connection and try again."));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-[13px] text-white/45">For stock that left the shelf without being sold. Sales take stock off by themselves.</p>
      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
        <Input id="remove-qty" label={`How many ${pluralUnit(product.unit)}`} type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => { setQty(e.target.value); setError(''); }} />
        <Select id="remove-reason" label="Why" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REMOVE_REASONS.map((r) => <option key={r} value={r} className="bg-ink-900">{r}</option>)}
        </Select>
      </div>
      {reason === 'Other' && <Input id="remove-note" label="What happened" value={note} onChange={(e) => setNote(e.target.value)} />}
      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="lg" loading={adjust.isPending}>Remove stock</Button>
      </FormActions>
    </form>
  );
}

function ProductDetails({ shopId, productId, onClose }: { shopId: string; productId: string; onClose: () => void }) {
  // Read from the list so figures follow every change.
  const { data: products = [] } = useProducts(shopId);
  const product = products.find((p) => p.id === productId);
  const { data: movements = [] } = useMovements(shopId, productId);
  const update = useUpdateProduct(shopId);
  const removeProduct = useRemoveProduct(shopId);
  const undo = useUndoMovement(shopId);
  const [mode, setMode] = useState<Mode>('view');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');

  if (!product) return <p className="text-[14px] text-white/45">This product is no longer on your stock list.</p>;

  async function undoMovement(id: string) {
    setError('');
    try { await undo.mutateAsync(id); } catch (err) { setError(errorMessage(err, "Couldn't undo that. Try again.")); }
  }

  async function remove() {
    setError('');
    try { await removeProduct.mutateAsync(product!.id); onClose(); } catch (err) { setError(errorMessage(err, "Couldn't remove the product. Try again.")); }
  }

  if (mode === 'edit') {
    return (
      <div className="space-y-4">
        <ProductForm product={product} onCancel={() => setMode('view')} onSubmit={async (values) => { await update.mutateAsync({ id: product.id, ...values }); setMode('view'); }} />
        <div className="border-t border-white/[0.06] pt-4">
          {confirmRemove ? (
            <div className="space-y-2">
              <p className="text-[13px] text-white/60">Take {product.name} off your stock list? Past sales and reports keep it.</p>
              <FormActions>
                <Button variant="ghost" size="lg" onClick={() => setConfirmRemove(false)}>Keep it</Button>
                <Button variant="danger" size="lg" onClick={remove} loading={removeProduct.isPending}>Yes, remove it</Button>
              </FormActions>
            </div>
          ) : (
            <Button variant="danger" size="lg" className="w-full sm:w-auto" onClick={() => setConfirmRemove(true)}>Remove product</Button>
          )}
          {error && <p className="mt-2 text-[13px] text-white/70" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  const out = product.quantity <= 0;
  return (
    <div className="space-y-4">
      <div className="divide-y divide-white/[0.06] rounded-xl bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]">
        <Figure label="On the shelf" value={quantityText(product.quantity, product.unit)} strong />
        <Figure label="Warn me at" value={product.lowStockLevel !== null ? formatQuantity(product.lowStockLevel) : 'No warning'} />
        {product.sellingPrice !== null && <Figure label="Selling price" value={formatCurrency(product.sellingPrice)} />}
        {product.costPrice !== null && <Figure label="Cost price" value={formatCurrency(product.costPrice)} />}
        <Figure label="Last counted" value={product.lastCountedOn ? formatDate(product.lastCountedOn) : 'Not yet'} />
      </div>
      {product.isLow && (
        <p className="text-[13px] text-white/70">{out ? 'Out of stock' : 'Running low'} — time to restock.</p>
      )}
      {product.quantity < 0 && (
        <p className="text-[13px] text-white/50">The records show fewer than none: more was sold than was recorded coming in. Count the shelf to set it right.</p>
      )}

      {mode === 'add' && <AddStockForm shopId={shopId} product={product} onDone={() => setMode('view')} />}
      {mode === 'remove' && <RemoveStockForm shopId={shopId} product={product} onDone={() => setMode('view')} />}
      {mode === 'view' && (
        // One under the other on a phone, in a row on wider screens.
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button size="lg" onClick={() => setMode('add')}>Add stock</Button>
          <Button size="lg" variant="secondary" onClick={() => setMode('remove')}>Remove stock</Button>
          <Button size="lg" variant="ghost" onClick={() => setMode('edit')}>Edit product</Button>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/40">History</p>
        {movements.length === 0 ? (
          <p className="text-[13px] text-white/35">Nothing yet.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-white/[0.06] overflow-y-auto rounded-xl ring-1 ring-inset ring-white/[0.06]">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white/80">{describe(m, product.unit)}</p>
                  <p className="text-[12px] text-white/35">{formatDate(m.occurredOn)}</p>
                </div>
                <span className="text-[13px] tabular-nums text-white/75">
                  {m.change > 0 ? '+' : m.change < 0 ? '−' : ''}{formatQuantity(Math.abs(m.change))}
                </span>
                {/* Stock from a sale or purchase changes with that transaction, not here. */}
                {!m.transactionId && m.kind !== 'sale' && (
                  <button
                    type="button" onClick={() => undoMovement(m.id)} disabled={undo.isPending}
                    className="text-[12px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline disabled:opacity-40"
                  >
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-[13px] text-white/70" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default function ProductModal({ shopId, product, onClose }: { shopId: string; product: Product | null; onClose: () => void }) {
  return (
    <Modal open={!!product} onClose={onClose} title={product?.name ?? ''}>
      {product && <ProductDetails key={product.id} shopId={shopId} productId={product.id} onClose={onClose} />}
    </Modal>
  );
}
