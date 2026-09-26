'use client';
import { useState } from 'react';
import { useShopsStore } from '@/store/shops';
import { useTransactions, useCreateTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import PageWrapper from '@/components/layout/PageWrapper';
import TransactionTable from '@/components/transactions/TransactionTable';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionForm from '@/components/transactions/TransactionForm';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import type { Transaction, TransactionType, TransactionStatus } from '@/types';

interface Filters {
  type?: TransactionType;
  status?: TransactionStatus;
  from?: string;
  to?: string;
}

export default function TransactionsPage() {
  const activeShop = useShopsStore((s) => s.activeShop());
  const [filters, setFilters] = useState<Filters>({});
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useTransactions(activeShop?.id ?? '', filters);
  const createTx = useCreateTransaction(activeShop?.id ?? '');
  const updateTx = useUpdateTransaction(activeShop?.id ?? '');
  const [markError, setMarkError] = useState('');

  // A paid debt is marked settled — never recorded again as a new sale, which would
  // count the same income twice.
  async function markPaid(tx: Transaction) {
    setMarkError('');
    try {
      await updateTx.mutateAsync({ id: tx.id, status: 'settled' });
    } catch {
      setMarkError("Couldn't mark that as paid. Check your connection and try again.");
    }
  }

  async function handleCreate(values: Omit<Transaction, 'id' | 'shopId' | 'userId' | 'aiCategorized' | 'createdAt' | 'updatedAt'>) {
    await createTx.mutateAsync(values);
    setShowForm(false);
  }

  return (
    <PageWrapper
      title="Transactions"
      actions={<Button onClick={() => setShowForm(true)}>+ Add transaction</Button>}
    >
      <div className="space-y-4">
        <TransactionFilters value={filters} onChange={setFilters} />
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/30"><Spinner className="h-4 w-4 text-white/20" /> Loading…</div>
        ) : (
          <>
            {markError && <p className="text-[13px] text-white/60">{markError}</p>}
            <TransactionTable
              data={data?.data ?? []}
              onMarkPaid={markPaid}
              markingPaidId={updateTx.isPending ? updateTx.variables?.id ?? null : null}
            />
          </>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New transaction">
        <TransactionForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      </Modal>
    </PageWrapper>
  );
}
