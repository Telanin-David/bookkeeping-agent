'use client';
import { useState } from 'react';
import { useShopsStore } from '@/store/shops';
import { useTransactions, useCreateTransaction } from '@/hooks/useTransactions';
import PageWrapper from '@/components/layout/PageWrapper';
import TransactionTable from '@/components/transactions/TransactionTable';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionForm from '@/components/transactions/TransactionForm';
import PaymentModal from '@/components/transactions/PaymentModal';
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
  // A payment towards a debt is recorded against that debt — never as a new sale,
  // which would count the same income twice.
  const [paying, setPaying] = useState<Transaction | null>(null);

  async function handleCreate(values: Omit<Transaction, 'id' | 'shopId' | 'userId' | 'aiCategorized' | 'amountPaid' | 'balance' | 'createdAt' | 'updatedAt'>) {
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
          <TransactionTable data={data?.data ?? []} onRecordPayment={setPaying} />
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New transaction">
        <TransactionForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      </Modal>

      <PaymentModal shopId={activeShop?.id ?? ''} tx={paying} onClose={() => setPaying(null)} />
    </PageWrapper>
  );
}
