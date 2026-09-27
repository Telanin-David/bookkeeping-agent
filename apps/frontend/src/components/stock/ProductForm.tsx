'use client';
import { useState, type FormEvent } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import { errorMessage } from '@/lib/errors';
import type { Product } from '@/types';
import type { ProductFields } from '@/lib/api';

interface ProductFormProps {
  /** Editing an existing product; omit to add a new one. */
  product?: Product;
  onSubmit: (values: ProductFields & { openingQuantity?: number }) => Promise<unknown>;
  onCancel: () => void;
}

const toText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
/** '' → null (cleared), otherwise the number; NaN for anything unreadable. */
const toNumber = (s: string) => (s.trim() === '' ? null : Number(s));

export default function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [name, setName]         = useState(product?.name ?? '');
  const [unit, setUnit]         = useState(product?.unit ?? '');
  const [opening, setOpening]   = useState('');
  const [low, setLow]           = useState(toText(product?.lowStockLevel));
  const [cost, setCost]         = useState(toText(product?.costPrice));
  const [price, setPrice]       = useState(toText(product?.sellingPrice));
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const values = { opening: toNumber(opening), low: toNumber(low), cost: toNumber(cost), price: toNumber(price) };
    if (!name.trim()) return setError('Enter the product’s name.');
    if (Object.values(values).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      return setError('Quantities and prices must be numbers of 0 or more.');
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        unit: unit.trim() || undefined,
        lowStockLevel: values.low,
        costPrice: values.cost,
        sellingPrice: values.price,
        ...(product ? {} : { openingQuantity: values.opening ?? undefined }),
      });
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the product. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      <Input id="product-name" label="Name" placeholder="e.g. Rice (50kg)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
        <Input id="product-unit" label="Sold by the" placeholder="bag" value={unit} onChange={(e) => setUnit(e.target.value)} hint="bag, carton, piece, litre…" />
        {product ? (
          <Input id="product-low" label="Warn me at" type="number" inputMode="decimal" min="0" step="any" value={low} onChange={(e) => setLow(e.target.value)} hint="Leave empty for no warning" />
        ) : (
          <Input id="product-opening" label="On the shelf now" type="number" inputMode="decimal" min="0" step="any" value={opening} onChange={(e) => setOpening(e.target.value)} />
        )}
      </div>
      {!product && (
        <Input id="product-low" label="Warn me when it gets down to" type="number" inputMode="decimal" min="0" step="any" value={low} onChange={(e) => setLow(e.target.value)} hint="Leave empty for no warning" />
      )}
      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
        <Input id="product-cost" label="Cost price" type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} hint="What you pay for one" />
        <Input id="product-price" label="Selling price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} hint="What you sell one for" />
      </div>
      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="lg" loading={saving}>{product ? 'Save changes' : 'Add product'}</Button>
      </FormActions>
    </form>
  );
}
