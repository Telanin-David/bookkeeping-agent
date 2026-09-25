'use client';
import { useMemo, useState } from 'react';
import { saveBranding } from '@/lib/branding';
import type { BrandingKind } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import PageWrapper from '@/components/layout/PageWrapper';
import LogoField from '@/components/branding/LogoField';
import SignaturePad from '@/components/branding/SignaturePad';
import Receipt from '@/components/receipts/Receipt';
import type { Transaction } from '@/types';

export default function BrandingPage() {
  const shop = useShopsStore((s) => s.activeShop());
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving]   = useState<BrandingKind | null>(null);
  const [error, setError]     = useState('');

  // An invoice shows both the logo and the signature, so it previews everything at once.
  const sample = useMemo<Transaction | null>(() => {
    if (!shop) return null;
    const now = new Date().toISOString();
    return {
      id: 'sample-00a1b2', shopId: shop.id, userId: '', type: 'receivable', status: 'pending',
      amount: 25000, currency: shop.currency, description: 'Sample item', category: 'Preview',
      counterparty: 'Customer name', date: now, createdAt: now, updatedAt: now,
      dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString(), aiCategorized: false,
    };
  }, [shop]);

  async function update(kind: BrandingKind, dataUrl: string | null) {
    if (!shop) return;
    setSaving(kind);
    setError('');
    try {
      await saveBranding(shop, kind, dataUrl);
      if (kind === 'signature') setDrawing(false);
    } catch {
      setError(`Couldn't save your ${kind}. Check your connection and try again.`);
    } finally {
      setSaving(null);
    }
  }

  if (!shop || !sample) {
    return <PageWrapper title="Receipt branding"><p className="text-[15px] text-white/40">Create a shop first.</p></PageWrapper>;
  }

  return (
    <PageWrapper title="Receipt branding">
      <div className="grid max-w-5xl gap-10 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-10">
          <section>
            <h2 className="text-[17px] font-semibold text-white/90">Logo</h2>
            <p className="mt-1 text-[14px] text-white/45">Printed at the top of every receipt and invoice.</p>
            <div className="mt-4">
              <LogoField value={shop.logoUrl ?? null} onChange={(url) => update('logo', url)} />
            </div>
            {saving === 'logo' && <p className="mt-2 text-[13px] text-white/40">Saving…</p>}
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-white/90">Signature</h2>
            <p className="mt-1 text-[14px] text-white/45">
              Printed on invoices for credit sales only, not on cash receipts, so fewer copies of your signature go around.
            </p>
            <div className="mt-4">
              {drawing ? (
                <SignaturePad onSave={(url) => update('signature', url)} onCancel={() => setDrawing(false)} />
              ) : shop.signatureUrl ? (
                <div className="flex items-center gap-4 rounded-2xl glass-card p-4">
                  <div className="flex h-20 w-40 shrink-0 items-center justify-center rounded-xl bg-[#fbfbfa] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shop.signatureUrl} alt="Your signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 sm:max-w-[220px]">
                    <button
                      onClick={() => setDrawing(true)}
                      className="h-10 rounded-full bg-white/[0.08] px-4 text-[14px] font-medium text-white/85 ring-1 ring-inset ring-white/[0.10] transition hover:bg-white/[0.12]"
                    >
                      Redraw
                    </button>
                    <button
                      onClick={() => update('signature', null)}
                      className="h-10 rounded-full px-4 text-[14px] text-white/45 transition hover:bg-white/[0.05] hover:text-white/75"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setDrawing(true)}
                  className="h-11 rounded-full bg-white/[0.08] px-5 text-[14px] font-medium text-white/85 ring-1 ring-inset ring-white/[0.10] transition hover:bg-white/[0.12]"
                >
                  Add signature
                </button>
              )}
            </div>
            {saving === 'signature' && <p className="mt-2 text-[13px] text-white/40">Saving…</p>}
          </section>

          {error && <p className="text-[14px] text-white/60">{error}</p>}
        </div>

        <aside>
          <p className="mb-3 text-[13px] font-medium text-white/55">Preview · invoice</p>
          <Receipt tx={sample} shop={shop} />
        </aside>
      </div>
    </PageWrapper>
  );
}
