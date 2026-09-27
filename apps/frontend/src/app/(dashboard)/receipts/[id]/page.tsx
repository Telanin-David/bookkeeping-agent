'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, ShareNetwork } from '@phosphor-icons/react';
import { reportsApi, downloadName, blobErrorMessage } from '@/lib/api';
import { isDemoShop } from '@/lib/demo';
import { shareOrDownload } from '@/lib/share';
import { useShopsStore } from '@/store/shops';
import { useTransaction } from '@/hooks/useTransactions';
import Receipt from '@/components/receipts/Receipt';
import Spinner from '@/components/ui/Spinner';

export default function ReceiptPage() {
  const router = useRouter();
  // Next.js 16 hands page props' params over as a promise; the hook reads the address directly.
  const { id } = useParams<{ id: string }>();
  const shop = useShopsStore((s) => s.activeShop());
  const { data: tx, isLoading, isError } = useTransaction(shop?.id ?? '', id);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  // The PDF is made by the server; demo mode has none, so it keeps Print only.
  const canShare = !!tx && !!shop && !isDemoShop(shop.id);

  async function sharePdf() {
    if (!tx || !shop) return;
    setSharing(true);
    setShareError('');
    try {
      const res = await reportsApi.generate('receipt', { shopId: shop.id, transactionId: tx.id });
      const kind = tx.type === 'receivable' ? 'Invoice' : 'Receipt';
      await shareOrDownload(res.data, downloadName(res.headers, 'receipt.pdf'), `${kind} from ${shop.name}`);
    } catch (err) {
      setShareError(await blobErrorMessage(err, "Couldn't make the PDF. Check your connection and try again."));
    } finally {
      setSharing(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {canShare && (
            <button
              onClick={sharePdf}
              disabled={sharing}
              className="flex h-10 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[15px] font-medium text-white/85 ring-1 ring-inset ring-white/[0.1] transition hover:bg-white/[0.14] active:scale-[0.97] disabled:opacity-50"
            >
              <ShareNetwork size={18} />
              {sharing ? 'Preparing…' : 'Share PDF'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            disabled={!tx}
            className="flex h-10 items-center gap-2 rounded-full bg-white/90 px-5 text-[15px] font-medium text-ink-950 transition hover:bg-white active:scale-[0.97] disabled:opacity-40"
          >
            <Printer size={18} />
            Print
          </button>
        </div>
      </div>
      {shareError && <p className="mx-auto w-full max-w-[360px] px-4 pb-3 text-[13px] text-white/60 print:hidden">{shareError}</p>}

      <div className="px-4 pb-10 print:p-0">
        {isLoading && <div className="flex justify-center py-16"><Spinner className="h-5 w-5 text-white/25" /></div>}
        {isError && <p className="py-16 text-center text-[15px] text-white/45">This transaction couldn&apos;t be found.</p>}
        {tx && shop && <Receipt tx={tx} shop={shop} />}
      </div>
    </div>
  );
}
