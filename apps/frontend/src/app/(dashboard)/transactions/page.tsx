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
import IconButton from '@/components/ui/IconButton';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Plus } from '@phosphor-icons/react';
import type { Transaction, TransactionType, TransactionStatus } from '@/types';
import type { NewTransactionBody } from '@/lib/api';

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

  async function handleCreate(values: NewTransactionBody) {
    await createTx.mutateAsync(values);
    setShowForm(false);
  }

  return (
    <PageWrapper
      title="Transactions"
      actions={(
        <>
          <Button className="hidden sm:inline-flex" onClick={() => setShowForm(true)}>+ Add transaction</Button>
          <IconButton className="sm:hidden" aria-label="Add a transaction" onClick={() => setShowForm(true)}><Plus size={20} weight="bold" /></IconButton>
        </>
      )}
    >
      <div className="space-y-4">
        <TransactionFilters value={filters} onChange={setFilters} />
        {isLoading ? (
          <ListSkeleton />
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
