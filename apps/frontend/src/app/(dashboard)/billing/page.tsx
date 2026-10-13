'use client';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle, Clock, Lightning, LockSimple, WarningCircle } from '@phosphor-icons/react';
import PageWrapper from '@/components/layout/PageWrapper';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { billingApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useBilling } from '@/hooks/useBilling';
import { cn } from '@/lib/utils';
import type { BillingInfo, PaidPlanId, PaymentRecord } from '@/types';

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
    <div className="mx-auto max-w-xl space-y-6">
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

/** One line of a grouped list: a label on the left, its value on the right. */
function Row({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <span className="shrink-0 text-[15px] text-white/80">{label}</span>
      <span className="min-w-0 text-right">
        <span className="block text-[15px] text-white/55">{value}</span>
        {sub && <span className="mt-0.5 block text-[13px] text-white/35">{sub}</span>}
      </span>
    </div>
  );
}

const Group = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('glass-card divide-y divide-white/[0.06] overflow-hidden rounded-2xl', className)}>{children}</div>
);
const Heading = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-2 px-1 text-[13px] font-medium text-white/45">{children}</h2>
);

function CurrentPlan({ b }: { b: BillingInfo }) {
  const chat = b.chat;
  const left = `${chat.remaining} of ${chat.limit} left`;
  return (
    <section>
      <Heading>Your plan</Heading>
      <Group>
        <Row label="Plan" value={<span className="font-medium text-white/90">{b.planName}</span>} />
        {b.plan === 'free' && <Row label="Assistant" value="Not included" />}
        {b.plan === 'trial' && b.trial && (
          <>
            <Row label="Ends" value={dayYearFmt.format(new Date(b.trial.endsAt))} />
            <Row label="Assistant" value={`${b.trial.messagesLeft} of ${chat.limit} left`} sub="For the whole trial" />
          </>
        )}
        {b.plan === 'day' && b.periodEndsAt && (
          <>
            <Row label="Ends" value={`${timeFmt.format(new Date(b.periodEndsAt))}, ${day(b.periodEndsAt)}`} />
            <Row label="Assistant" value={left} />
          </>
        )}
        {(b.plan === 'monthly' || b.plan === 'yearly' || b.plan === 'weekly') && (
          <>
            <Row label="Ends" value={b.periodEndsAt ? dayYearFmt.format(new Date(b.periodEndsAt)) : '—'} />
            <Row label="Assistant today" value={left} />
          </>
        )}
        {b.underneath && <Row label="Then" value={b.underneath.planName} sub={`Until ${dayYearFmt.format(new Date(b.underneath.endsAt))}`} />}
        {b.upcoming.map((u) => (
          <Row key={u.startsAt} label="Paid ahead" value={u.planName} sub={span(u.startsAt, u.endsAt)} />
        ))}
      </Group>
      {b.plan === 'free' && <p className="mt-2 px-1 text-[13px] leading-relaxed text-white/40">{FREE_INCLUDES}</p>}
    </section>
  );
}

/** What Monthly and Yearly include, as ticks under the price. */
/** "6 a day" → "6 assistant messages a day"; "20 in 24 hours" → "20 assistant messages in 24 hours". */
const messagesText = (m: string) => { const [n, ...rest] = m.split(' '); return `${n} assistant messages ${rest.join(' ')}`; };
const INCLUDED = ['PDF reports: profit, debts and stock', 'Your logo and signature on receipts', 'Alert emails', 'Staff and salaries', 'Import from a spreadsheet', 'Up to 3 shops'];

function Offers({ b }: { b: BillingInfo }) {
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState('');
  const subscriptions = b.offers.filter((o) => !o.pass);
  const passes = b.offers.filter((o) => o.pass);
  const [choice, setChoice] = useState<PaidPlanId>(b.plan === 'yearly' ? 'yearly' : 'monthly');
  const onSubscription = b.plan === 'monthly' || b.plan === 'yearly' || b.upcoming.some((u) => u.plan === 'monthly' || u.plan === 'yearly');

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

  const offer = subscriptions.find((o) => o.id === choice) ?? subscriptions[0];
  const monthly = subscriptions.find((o) => o.id === 'monthly');
  const yearSaving = monthly && offer?.id === 'yearly' ? monthly.priceKobo * 12 - offer.priceKobo : 0;

  return (
    <>
      {offer && (
        <section>
          <Heading>{b.plan === 'free' || b.plan === 'trial' ? 'Choose a plan' : 'Renew or add time'}</Heading>
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="grid grid-cols-2 rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/[0.08]" role="tablist" aria-label="Plan">
              {subscriptions.map((o) => (
                <button
                  key={o.id} type="button" role="tab" aria-selected={o.id === offer.id} onClick={() => setChoice(o.id)}
                  className={cn('h-9 rounded-full text-[14px] font-medium transition',
                    o.id === offer.id ? 'bg-white/[0.14] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]' : 'text-white/50 hover:text-white/80')}
                >
                  {o.name}
                </button>
              ))}
            </div>

            <div className="mt-5 px-1">
              <p className="flex items-baseline gap-1.5">
                <span className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-white">{offer.priceText}</span>
                <span className="text-[15px] text-white/45">/ {PERIOD[offer.id].replace('a ', '')}</span>
              </p>
              <p className="mt-2 text-[14px] text-white/50">
                {yearSaving > 0 ? `${naira(Math.round(offer.priceKobo / 12))} a month · you save ${naira(yearSaving)}` : 'Pay once for 30 days. Nothing renews by itself.'}
              </p>
            </div>

            <ul className="mt-5 space-y-2.5 px-1 text-[15px] text-white/75">
              <li className="flex gap-3"><Check size={18} weight="bold" className="mt-0.5 shrink-0 text-white/60" />{messagesText(offer.messages)}</li>
              {INCLUDED.map((f) => (
                <li key={f} className="flex gap-3"><Check size={18} weight="bold" className="mt-0.5 shrink-0 text-white/60" />{f}</li>
              ))}
            </ul>

            {onSubscription && <p className="mt-4 px-1 text-[13px] text-white/40">Starts when your current plan ends, so no days are lost.</p>}
            <button
              type="button" onClick={() => pay(offer.id)} disabled={busy !== null}
              className="mt-5 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-ink-950 transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
            >
              {busy === offer.id && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Pay {offer.priceText}
            </button>
          </div>
        </section>
      )}

      {passes.length > 0 && (
        <section>
          <Heading>Full capacity</Heading>
          <Group>
            {passes.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="min-w-0">
                  <span className="block text-[15px] text-white/85">{o.name.replace('Full capacity: ', '')}</span>
                  <span className="mt-0.5 block text-[13px] text-white/40">{messagesText(o.messages)} · everything in Monthly</span>
                </span>
                <Button size="sm" variant="secondary" className="shrink-0 px-3.5 py-2 text-[14px]" loading={busy === o.id} disabled={busy !== null && busy !== o.id} onClick={() => pay(o.id)}>
                  {o.priceText}
                </Button>
              </div>
            ))}
          </Group>
          <p className="mt-2 px-1 text-[13px] leading-relaxed text-white/40">For busy days: 20 assistant messages instead of 6. Bought during Monthly, it starts at once.</p>
        </section>
      )}

      {error && <p className="px-1 text-[13px] text-white/70" role="alert">{error}</p>}
      <p className="flex gap-2 px-1 text-[13px] leading-relaxed text-white/40">
        <LockSimple size={15} className="mt-0.5 shrink-0" />
        <span>Paid on Paystack&apos;s secure page by bank transfer, card or USSD. Your records stay yours on every plan: nothing is deleted if you stop paying.</span>
      </p>
    </>
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
      <Heading>Payments</Heading>
      <Group>
        {payments.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[15px] text-white/85">{p.planName}</p>
              <p className="mt-0.5 text-[13px] text-white/40">
                {p.status === 'pending'
                  ? 'Waiting for the payment to arrive'
                  : p.status === 'failed'
                    ? 'Didn’t go through'
                    : [
                        p.paidAt && day(p.paidAt),
                        p.provider === 'manual' ? 'Paid directly' : p.channel ? CHANNEL[p.channel] ?? p.channel : null,
                      ].filter(Boolean).join(' · ')}
              </p>
              {p.status === 'success' && p.period && <p className="text-[13px] text-white/35">Covers {span(p.period.startsAt, p.period.endsAt)}</p>}
            </div>
            <span className={cn('shrink-0 text-[15px] tabular-nums', p.status === 'success' ? 'text-white/85' : 'text-white/40')}>{p.amountText}</span>
          </div>
        ))}
      </Group>
    </section>
  );
}
