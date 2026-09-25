'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { shopsApi } from '@/lib/api';
import { saveBranding } from '@/lib/branding';
import { DEMO_SHOP_ID, DEMO_USER_ID } from '@/lib/demo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import LogoField from '@/components/branding/LogoField';
import type { Shop } from '@/types';

const SHOP_TYPES: { value: Shop['type']; label: string }[] = [
  { value: 'retail',    label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'food',      label: 'Food' },
  { value: 'services',  label: 'Services' },
  { value: 'other',     label: 'Other' },
];

const primaryBtn =
  'flex h-12 w-full items-center justify-center rounded-full bg-white/90 text-[15px] font-semibold text-ink-950 transition hover:bg-white active:scale-[0.99] disabled:opacity-40';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const { shops, setShops, setActiveShop } = useShopsStore();
  const isDemo = user?.id === DEMO_USER_ID;

  const [step, setStep]         = useState<1 | 2>(1);
  const [shop, setShop]         = useState<Shop | null>(null);
  const [name, setName]         = useState(isDemo ? 'My Demo Shop' : '');
  const [type, setType]         = useState<Shop['type']>('retail');
  const [location, setLocation] = useState(isDemo ? 'Lagos' : '');
  const [logo, setLogo]         = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  async function createShop(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Enter your shop name.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { name: name.trim(), type, location: location.trim() || undefined, currency: 'NGN' };
      const created: Shop = isDemo
        ? { id: DEMO_SHOP_ID, ownerId: DEMO_USER_ID, isActive: true, ...body }
        : (await shopsApi.create(body)).data;
      const nextShops = [...shops.filter((s) => s.id !== created.id), created];
      setShops(nextShops);
      // The dashboard layout redirects here while its cached shop list is empty — update
      // that cache too, or it bounces the owner straight back after onboarding.
      qc.setQueryData<Shop[]>(['shops'], nextShops);
      setActiveShop(created.id);
      setShop(created);
      setStep(2);
    } catch {
      setError("Couldn't create your shop. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    if (!shop) return;
    if (logo) {
      setSaving(true);
      setError('');
      try {
        await saveBranding(shop, 'logo', logo);
      } catch {
        setSaving(false);
        setError("Couldn't save your logo. Try again, or skip and add it later.");
        return;
      }
    }
    router.replace('/chat');
  }

  if (!isAuthenticated) return null;

  return (
    <main className="flex min-h-screen justify-center bg-ink-950 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-md flex-col">

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {[1, 2].map((n) => (
              <span key={n} className={cn('h-1 flex-1 rounded-full transition-colors', n <= step ? 'bg-white/80' : 'bg-white/[0.12]')} />
            ))}
          </div>
          <span className="text-[13px] tabular-nums text-white/40">Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <form onSubmit={createShop} className="mt-10 flex flex-1 flex-col">
            <h1 className="text-[30px] font-bold leading-tight text-white/95">Set up your shop</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/50">This is the name your customers will see on receipts.</p>

            <label className="mt-8 text-[13px] font-medium text-white/55" htmlFor="shop-name">Shop name</label>
            <input
              id="shop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amara Provisions"
              autoComplete="organization"
              className="glass-input mt-2 h-12 rounded-2xl px-4 text-base text-white/90 placeholder:text-white/30 focus:outline-none"
            />

            <p className="mt-6 text-[13px] font-medium text-white/55">What do you sell?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHOP_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  aria-pressed={type === t.value}
                  className={cn(
                    'h-10 rounded-full px-4 text-[14px] font-medium ring-1 ring-inset transition',
                    type === t.value
                      ? 'bg-white/[0.14] text-white ring-white/30'
                      : 'bg-white/[0.04] text-white/55 ring-white/[0.08] hover:text-white/85',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="mt-6 text-[13px] font-medium text-white/55" htmlFor="shop-location">
              Location <span className="text-white/30">(optional)</span>
            </label>
            <input
              id="shop-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Yaba, Lagos"
              className="glass-input mt-2 h-12 rounded-2xl px-4 text-base text-white/90 placeholder:text-white/30 focus:outline-none"
            />

            {error && <p className="mt-4 text-[14px] text-white/60">{error}</p>}

            <div className="mt-auto pt-10">
              <button type="submit" disabled={saving} className={primaryBtn}>
                {saving ? 'Creating…' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-10 flex flex-1 flex-col">
            <h1 className="text-[30px] font-bold leading-tight text-white/95">Add your logo</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/50">
              It prints at the top of every receipt and invoice. You can change it any time from Receipt branding.
            </p>

            <div className="mt-8">
              <LogoField value={logo} onChange={setLogo} />
            </div>

            {/* Live preview of the receipt header */}
            <p className="mt-8 text-[13px] font-medium text-white/55">Preview</p>
            <div className="mt-2 rounded-2xl bg-[#fbfbfa] px-6 pb-6 pt-7 text-center">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="mx-auto mb-3 max-h-16 max-w-[180px] object-contain" />
              )}
              <p className="font-display text-[20px] font-bold tracking-[-0.03em] text-black">{shop?.name}</p>
              <p className="mt-1 text-[12px] capitalize text-black/45">{[shop?.location, shop?.type].filter(Boolean).join(' · ')}</p>
              <div className="mt-4 border-t border-dashed border-black/20" />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/70">Receipt</p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/35">
              Receipts print in black and white, so your logo is shown the way it will print. A dark logo on a white or clear background works best.
            </p>

            {error && <p className="mt-4 text-[14px] text-white/60">{error}</p>}

            <div className="mt-auto space-y-2 pt-10">
              <button onClick={finish} disabled={!logo || saving} className={primaryBtn}>
                {saving ? 'Saving…' : 'Save and continue'}
              </button>
              <button
                onClick={() => router.replace('/chat')}
                disabled={saving}
                className="flex h-12 w-full items-center justify-center rounded-full text-[15px] text-white/55 transition hover:text-white/85"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
