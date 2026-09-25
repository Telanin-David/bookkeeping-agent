'use client';
import Link from 'next/link';
import { Printer, Receipt as ReceiptIcon } from '@phosphor-icons/react';
import { useShopsStore } from '@/store/shops';
import { useTransaction } from '@/hooks/useTransactions';
import { formatCurrency } from '@/lib/utils';
import { receiptNumber, receiptStatus } from './Receipt';

const shortDate = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ReceiptCard({ transactionId }: { transactionId: string }) {
  const shop = useShopsStore((s) => s.activeShop());
  const { data: tx, isError } = useTransaction(shop?.id ?? '', transactionId);
  if (isError) return null;
  // Same height as the loaded card, so the chat's scroll-to-bottom lands below it.
  if (!tx) return <div className="mt-3 h-[117px] max-w-sm rounded-2xl glass-card" />;

  return (
    <div className="mt-3 max-w-sm overflow-hidden rounded-2xl glass-card">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/[0.08]">
          <ReceiptIcon size={19} className="text-white/70" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-white/90">{tx.counterparty ?? 'Walk-in customer'}</p>
          <p className="truncate text-[13px] text-white/40">{receiptNumber(tx)} · {shortDate.format(new Date(tx.createdAt))}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-semibold tabular-nums text-white/90">{formatCurrency(tx.amount, tx.currency)}</p>
          <p className="text-[12px] text-white/40">{receiptStatus(tx)}</p>
        </div>
      </div>
      <Link
        href={`/receipts/${tx.id}`}
        className="flex h-11 items-center justify-center gap-2 border-t border-white/[0.07] text-[14px] font-medium text-white/75 transition hover:bg-white/[0.05] hover:text-white"
      >
        <Printer size={17} />
        View &amp; print
      </Link>
    </div>
  );
}
