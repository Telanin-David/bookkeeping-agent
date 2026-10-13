'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Lightning, WarningCircle } from '@phosphor-icons/react';
import PageWrapper from '@/components/layout/PageWrapper';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { billingApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useBilling } from '@/hooks/useBilling';
import { cn } from '@/lib/utils';
import type { BillingInfo, PaidPlanId, PaymentRecord, PlanOffer } from '@/types';

// Dates the owner reads are Lagos dates, whatever the phone is set to.
const dayFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
const dayYearFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
const timeFmt = new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
const day = (iso: string) => dayFmt.format(new Date(iso));
/** "13 Oct – 12 Nov", with years when the dates fall in different years ("12 Nov 2026 – 12 Nov 2027"). */
const span = (from: string, to: string) => {
  const year = (iso: string) => new Date(iso).toLocaleString('en-NG', { year: 'numeric', timeZone: 'Africa/Lagos' });
  return year(from) === year(to) ? `${day(from)} – ${day(to)}` : `${dayYearFmt.format(new Date(from))} – ${dayYearFmt.format(new Date(to))}`;
};
const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;

const PERIOD: Record<PaidPlanId, string> = { monthly: 'a month', yearly: 'a year', weekly: 'a week', day: 'a day' };
const CHANNEL: Record<string, string> = { bank_transfer: 'Bank transfer', card: 'Card', ussd: 'USSD', bank: 'Bank' };
const FREE_INCLUDES = 'Recording by form, stock, debts, the Profit page, alerts in the app and receipts are free on every plan.';

export default function BillingPage() {
  return (
    <PageWrapper title="Plan">
      {/* useSearchParams needs a Suspense boundary in a statically built page. */}
      <Suspense fallback={<PlanSkeleton />}>
        <PlanScreen />
      </Suspense>
    </PageWrapper>
  );
}

function PlanSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-[120px] rounded-2xl" />
      <Skeleton className="h-[160px] rounded-2xl" />
    </div>
  );
}

function PlanScreen() {
  const { data, isLoading, error } = useBilling();
  const params = useSearchParams();
  // Paystack sends the owner back here with ?reference=… (and ?trxref=…, the same value). It's
  // kept from the first render: the check tidies the address bar afterwards, and the result
  // ("Payment received") has to stay on screen when it does. Coming back from Paystack is
  // always a fresh page load, so a later payment starts over with its own reference.
  const [reference] = useState(() => params.get('reference') ?? params.get('trxref'));

  if (isLoading) return <PlanSkeleton />;
  if (error || !data) return <p className="text-sm text-white/60" role="alert">{errorMessage(error, "Couldn't load your plan. Try again.")}</p>;

  if (!data.billingEnabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="glass-card rounded-2xl p-5">
          <p className="text-[13px] font-medium text-white/45">Your plan</p>
          <p className="mt-1 text-2xl font-bold text-white/90">Everything included</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">Payments aren&apos;t switched on yet, so every feature is free for now.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {reference && <PaymentCheck reference={reference} />}
      <CurrentPlan b={data} />
      {data.passSpendKobo >= 300_000 && data.offers.some((o) => o.id === 'monthly') && (
        <p className="glass-card flex gap-3 rounded-2xl p-4 text-[14px] leading-relaxed text-white/70">
          <Lightning size={18} className="mt-0.5 shrink-0 text-white/60" />
          <span>You&apos;ve spent {naira(data.passSpendKobo)} on passes this month. Monthly is ₦5,000 for every day of the month.</span>
        </p>
      )}
      {data.plan !== 'unlimited' && <Offers b={data} />}
      <Payments payments={data.payments} />
    </div>
  );
}

function CurrentPlan({ b }: { b: BillingInfo }) {
  const chat = b.chat;
  let detail: string;
  if (b.plan === 'unlimited') detail = 'Everything is included on this account.';
  else if (b.plan === 'free') detail = 'The assistant, PDF reports and receipts with your logo come with a paid plan.';
  else if (b.plan === 'trial' && b.trial) detail = `Ends ${day(b.trial.endsAt)} · ${b.trial.messagesLeft} of ${chat.limit} assistant messages left`;
  else if (b.plan === 'day' && b.periodEndsAt) detail = `Until ${timeFmt.format(new Date(b.periodEndsAt))}, ${day(b.periodEndsAt)} · ${chat.remaining} of ${chat.limit} messages left`;
  else detail = `Until ${b.periodEndsAt ? dayYearFmt.format(new Date(b.periodEndsAt)) : '—'} · ${chat.remaining} of ${chat.limit} assistant messages left today`;
  const later = [
    ...(b.underneath ? [`Then ${b.underneath.planName} until ${dayYearFmt.format(new Date(b.underneath.endsAt))}`] : []),
    ...b.upcoming.map((u) => `Paid ahead: ${u.planName}, ${dayYearFmt.format(new Date(u.startsAt))} – ${dayYearFmt.format(new Date(u.endsAt))}`),
  ];

  return (
    <section className="glass-card rounded-2xl p-5">
      <p className="text-[13px] font-medium text-white/45">Your plan</p>
      <p className="mt-1 text-2xl font-bold text-white/90">{b.planName}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{detail}</p>
      {later.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-[13px] text-white/50">
          {later.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      {b.plan === 'free' && <p className="mt-3 text-[13px] leading-relaxed text-white/40">{FREE_INCLUDES}</p>}
    </section>
  );
}

function Offers({ b }: { b: BillingInfo }) {
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState('');

  async function pay(plan: PaidPlanId) {
    setError('');
    setBusy(plan);
    try {
      const { authorizationUrl } = await billingApi.checkout(plan);
      window.location.assign(authorizationUrl); // Paystack's own page: transfer, card or USSD
    } catch (err) {
      setError(errorMessage(err, "Couldn't start the payment. Check your connection and try again."));
      setBusy(null);
    }
  }

  const subscriptions = b.offers.filter((o) => !o.pass);
  const passes = b.offers.filter((o) => o.pass);
  const onSubscription = b.plan === 'monthly' || b.plan === 'yearly' || b.upcoming.some((u) => u.plan === 'monthly' || u.plan === 'yearly');

  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-white/45">
        {b.plan === 'free' || b.plan === 'trial' ? 'Choose a plan' : 'Renew or add time'}
      </h2>
      {subscriptions.map((o) => (
        <OfferCard key={o.id} offer={o} busy={busy} onPay={pay} note={onSubscription ? 'Adds the time on after your current plan, so no days are lost.' : undefined} />
      ))}
      {passes.length > 0 && (
        <>
          <h2 className="px-1 pt-2 text-xs font-medium uppercase tracking-wide text-white/45">Full capacity</h2>
          <p className="-mt-1 px-1 text-[13px] leading-relaxed text-white/45">
            For busy days: 20 assistant messages a day instead of 6. Bought during Monthly, a pass gives the bigger allowance while it lasts.
          </p>
          {passes.map((o) => <OfferCard key={o.id} offer={o} busy={busy} onPay={pay} />)}
        </>
      )}
      {error && <p className="px-1 text-[13px] text-white/70" role="alert">{error}</p>}
      <p className="px-1 text-[13px] leading-relaxed text-white/40">
        You pay on Paystack&apos;s secure page by bank transfer, card or USSD. Your plan switches on as soon as the payment arrives.
        Your records are yours on every plan: nothing is ever deleted if you stop paying.
      </p>
    </section>
  );
}

function OfferCard({ offer, busy, onPay, note }: { offer: PlanOffer; busy: PaidPlanId | null; onPay: (p: PaidPlanId) => void; note?: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[16px] font-semibold text-white/90">{offer.name}</p>
        <p className="shrink-0 text-[16px] font-semibold tabular-nums text-white/90">
          {offer.priceText}<span className="text-[13px] font-normal text-white/45"> / {PERIOD[offer.id]}</span>
        </p>
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">{offer.summary}</p>
      {note && <p className="mt-1 text-[13px] text-white/40">{note}</p>}
      <Button size="lg" className="mt-4 w-full" loading={busy === offer.id} disabled={busy !== null && busy !== offer.id} onClick={() => onPay(offer.id)}>
        Pay {offer.priceText}
      </Button>
    </div>
  );
}

type CheckState = { kind: 'checking' } | { kind: 'success'; payment: PaymentRecord; until: string | null } | { kind: 'pending' } | { kind: 'failed'; reference: string } | { kind: 'error'; message: string };

/**
 * After Paystack sends the owner back. A card payment is confirmed at once; a bank transfer
 * can take a few minutes to arrive, so this keeps asking for a while before giving up.
 */
function PaymentCheck({ reference }: { reference: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [state, setState] = useState<CheckState>({ kind: 'checking' });
  const tries = useRef(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      tries.current += 1;
      try {
        const r = await billingApi.verify(reference);
        if (stopped) return;
        if (r.status === 'success') {
          qc.setQueryData(['billing'], (old: BillingInfo | undefined) => (old ? { ...old, ...r.entitlements } : r.entitlements));
          qc.invalidateQueries({ queryKey: ['billing'] });
          qc.invalidateQueries({ queryKey: ['chat-usage'] });
          setState({ kind: 'success', payment: r.payment, until: r.entitlements.endsAt });
          router.replace('/billing', { scroll: false });
          return;
        }
        if (r.status === 'failed') { setState({ kind: 'failed', reference }); return; }
        setState({ kind: 'pending' });
        // Every 5 seconds for the first minute, then every 20 seconds for ten minutes.
        if (tries.current < 42) timer = setTimeout(check, tries.current < 12 ? 5_000 : 20_000);
      } catch (err) {
        if (!stopped) setState({ kind: 'error', message: errorMessage(err, "Couldn't check the payment. If you paid, your plan will switch on by itself shortly.") });
      }
    }
    check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [reference, qc, router]);

  const box = 'glass-card flex gap-3 rounded-2xl p-4 text-[14px] leading-relaxed';
  if (state.kind === 'checking') {
    return <div className={box} role="status"><Clock size={20} className="mt-0.5 shrink-0 text-white/60" /><span className="text-white/70">Checking your payment with Paystack…</span></div>;
  }
  if (state.kind === 'success') {
    return (
      <div className={cn(box, 'ring-1 ring-inset ring-white/20')} role="status">
        <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-white/90" />
        <span className="text-white/85">
          Payment received: {state.payment.amountText} for {state.payment.planName}.
          {state.until && <> You&apos;re covered until {dayYearFmt.format(new Date(state.until))}.</>}
        </span>
      </div>
    );
  }
  if (state.kind === 'pending') {
    return (
      <div className={box} role="status">
        <Clock size={20} className="mt-0.5 shrink-0 text-white/60" />
        <span className="text-white/70">
          Waiting for your payment to arrive. A bank transfer can take a few minutes; this page keeps checking, and your plan switches on by itself
          even if you leave. Reference: <span className="break-all text-white/50">{reference}</span>
        </span>
      </div>
    );
  }
  return (
    <div className={box} role="alert">
      <WarningCircle size={20} className="mt-0.5 shrink-0 text-white/70" />
      <span className="text-white/70">
        {state.kind === 'failed'
          ? <>That payment didn&apos;t go through, so nothing was switched on. If money left your account, contact us with this reference: <span className="break-all text-white/50">{state.reference}</span></>
          : state.message}
      </span>
    </div>
  );
}

function Payments({ payments }: { payments: PaymentRecord[] }) {
  if (payments.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-white/45">Payments</h2>
      <ul className="glass-card divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
        {payments.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-[15px] text-white/85">{p.planName}</p>
              <p className="mt-0.5 text-[13px] text-white/40">
                {p.status === 'pending'
                  ? 'Waiting for the payment to arrive'
                  : [
                      p.paidAt && day(p.paidAt),
                      p.provider === 'manual' ? 'Paid directly' : p.channel ? CHANNEL[p.channel] ?? p.channel : null,
                      p.period && `covers ${span(p.period.startsAt, p.period.endsAt)}`,
                    ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={cn('shrink-0 text-[15px] tabular-nums', p.status === 'pending' ? 'text-white/45' : 'text-white/85')}>{p.amountText}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
