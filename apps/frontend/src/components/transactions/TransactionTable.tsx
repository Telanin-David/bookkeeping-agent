'use client';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate, capitalize } from '@/lib/utils';

interface TransactionTableProps {
  data: Transaction[];
  onRowClick?: (tx: Transaction) => void;
}

export default function TransactionTable({ data, onRowClick }: TransactionTableProps) {
  return (
    <Table
      columns={[
        { key: 'date',         header: 'Date',         render: (r) => formatDate(r.date) },
        { key: 'description',  header: 'Description' },
        { key: 'type',         header: 'Type',         render: (r) => <Badge>{capitalize(r.type)}</Badge> },
        { key: 'category',     header: 'Category',     render: (r) => r.category ?? '—' },
        { key: 'counterparty', header: 'Counterparty', render: (r) => r.counterparty ?? '—' },
        { key: 'amount',       header: 'Amount',       render: (r) => formatCurrency(r.amount, r.currency), className: 'text-right font-mono' },
        { key: 'status',       header: 'Status',       render: (r) => <Badge>{capitalize(r.status)}</Badge> },
      ]}
      data={data as unknown as Record<string, unknown>[]}
      keyExtractor={(r) => (r as unknown as Transaction).id}
      onRowClick={(r) => onRowClick?.(r as unknown as Transaction)}
      emptyMessage="No transactions yet"
    />
  );
}
