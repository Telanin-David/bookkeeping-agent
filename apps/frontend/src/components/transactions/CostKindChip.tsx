'use client';
import { useState } from 'react';
import { CaretDown, Package, Storefront } from '@phosphor-icons/react';
import ActionSheet from '@/components/ui/ActionSheet';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useShopsStore } from '@/store/shops';
import { errorMessage } from '@/lib/errors';
import type { Transaction } from '@/types';

export const costKindLabel = (kind: Transaction['costKind']) => (kind === 'stock' ? 'Stock' : 'Running cost');

/**
 * What money spent was for, on an expense or bill. Tapping it switches between a running
 * cost and stock to resell: the one thing profit depends on that the owner most often needs
 * to correct (say, when the assistant guessed).
 */
export default function CostKindChip({ tx }: { tx: Transaction }) {
  const shopId = useShopsStore((s) => s.activeShop()?.id) ?? '';
  const update = useUpdateTransaction(shopId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  if (tx.type !== 'expense' && tx.type !== 'payable') return null;

  async function choose(costKind: 'running' | 'stock') {
    if (costKind === tx.costKind) return;
    setError('');
    try {
      await update.mutateAsync({ id: tx.id, costKind });
    } catch (err) {
      setError(errorMessage(err, "Couldn't change it. Try again."));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        disabled={update.isPending}
        aria-label={`${costKindLabel(tx.costKind)}. Change the kind of spending`}
        className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] text-white/55 ring-1 ring-inset ring-white/[0.1] transition hover:text-white/85 active:bg-white/[0.08] disabled:opacity-50"
      >
        {costKindLabel(tx.costKind)}
        <CaretDown size={10} weight="bold" />
      </button>
      {error && <p className="text-[12px] text-white/60" role="alert">{error}</p>}
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Kind of spending"
        actions={[
          { label: 'Running the business', description: 'Rent, salaries, fuel, electricity…', icon: Storefront, selected: tx.costKind !== 'stock', onSelect: () => choose('running') },
          { label: 'Stock to resell', description: 'Goods you’ll sell. Not a cost until they’re sold, when you track stock', icon: Package, selected: tx.costKind === 'stock', onSelect: () => choose('stock') },
        ]}
      />
    </>
  );
}
