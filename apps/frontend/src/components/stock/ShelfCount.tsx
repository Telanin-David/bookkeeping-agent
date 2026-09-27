'use client';
import { useState, type FormEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useShelfCount } from '@/hooks/useStock';
import { errorMessage } from '@/lib/errors';
import { formatQuantity, pluralUnit, quantityText } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import type { CountLine, Product } from '@/types';

function result(line: CountLine): { text: string; missing: boolean } {
  const d = Math.round(line.difference * 100) / 100;
  if (d === 0) return { text: 'Matches the records', missing: false };
  return d < 0
    ? { text: `${quantityText(-d, line.product.unit)} missing`, missing: true }
    : { text: `${quantityText(d, line.product.unit)} more than recorded`, missing: false };
}

function CountForm({ shopId, products, onClose }: { shopId: string; products: Product[]; onClose: () => void }) {
  const count = useShelfCount(shopId);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [results, setResults] = useState<CountLine[] | null>(null);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const items = products
      .filter((p) => (counted[p.id] ?? '').trim() !== '')
      .map((p) => ({ productId: p.id, counted: Number(counted[p.id]) }));
    if (items.length === 0) return setError('Type in what you counted for at least one product.');
    if (items.some((i) => !Number.isFinite(i.counted) || i.counted < 0)) return setError('Counts must be numbers of 0 or more.');
    try {
      setResults(await count.mutateAsync(items));
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the count. Check your connection and try again."));
    }
  }

  if (results) {
    const missing = results.filter((l) => result(l).missing).length;
    return (
      <div className="space-y-4">
        <p className="text-[14px] text-white/80">
          {missing === 0
            ? 'Everything you counted is accounted for.'
            : results.length === 1
              ? `${results[0]!.product.name} has stock missing.`
              : `${missing} of ${results.length} products have stock missing.`}
        </p>
        <ul className="divide-y divide-white/[0.06] rounded-xl ring-1 ring-inset ring-white/[0.06]">
          {results.map((line) => {
            const r = result(line);
            return (
              <li key={line.product.id} className="px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] text-white/85">{line.product.name}</span>
                  <span className={cn('text-right text-[13px]', r.missing ? 'font-semibold text-white' : 'text-white/55')}>{r.text}</span>
                </div>
                <p className="text-[12px] text-white/35">
                  Counted {quantityText(line.counted, line.product.unit)} · records said {formatQuantity(line.expected)}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-[12px] text-white/35">Your stock now matches what you counted.</p>
        <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-[13px] text-white/50">
        Count what is actually on the shelf and type it in. Skip anything you didn&apos;t count. The app then shows what&apos;s missing.
      </p>
      <ul className="max-h-[50vh] divide-y divide-white/[0.06] overflow-y-auto rounded-xl ring-1 ring-inset ring-white/[0.06]">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3.5 py-2">
            <label htmlFor={`count-${p.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-white/85">{p.name}</span>
              <span className="text-[12px] text-white/35">{pluralUnit(p.unit)}</span>
            </label>
            <input
              id={`count-${p.id}`} type="number" inputMode="decimal" min="0" step="any" placeholder="—"
              value={counted[p.id] ?? ''} onChange={(e) => { setCounted((c) => ({ ...c, [p.id]: e.target.value })); setError(''); }}
              className="glass-input w-24 rounded-xl px-3 py-2 text-right text-sm tabular-nums"
            />
          </li>
        ))}
      </ul>
      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={count.isPending}>Save count</Button>
      </div>
    </form>
  );
}

export default function ShelfCount({ shopId, products, open, onClose }: { shopId: string; products: Product[]; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Count the shelf">
      {open && <CountForm shopId={shopId} products={products} onClose={onClose} />}
    </Modal>
  );
}
