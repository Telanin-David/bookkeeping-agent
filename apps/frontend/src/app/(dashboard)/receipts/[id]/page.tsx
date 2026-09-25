'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { useShopsStore } from '@/store/shops';
import { useTransaction } from '@/hooks/useTransactions';
import Receipt from '@/components/receipts/Receipt';
import Spinner from '@/components/ui/Spinner';

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const shop = useShopsStore((s) => s.activeShop());
  const { data: tx, isLoading, isError } = useTransaction(shop?.id ?? '', params.id);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto print:overflow-visible">
      <div className="mx-auto flex w-full max-w-[360px] items-center justify-between px-4 pb-4 pt-4 md:pt-8 print:hidden">
        <button
          onClick={() => router.back()}
          className="flex h-10 items-center gap-2 rounded-full px-3 text-[15px] text-white/60 transition hover:bg-white/[0.06] hover:text-white/90"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <button
          onClick={() => window.print()}
          disabled={!tx}
          className="flex h-10 items-center gap-2 rounded-full bg-white/90 px-5 text-[15px] font-medium text-ink-950 transition hover:bg-white active:scale-[0.97] disabled:opacity-40"
        >
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="px-4 pb-10 print:p-0">
        {isLoading && <div className="flex justify-center py-16"><Spinner className="h-5 w-5 text-white/25" /></div>}
        {isError && <p className="py-16 text-center text-[15px] text-white/45">This transaction couldn&apos;t be found.</p>}
        {tx && shop && <Receipt tx={tx} shop={shop} />}
      </div>
    </div>
  );
}
