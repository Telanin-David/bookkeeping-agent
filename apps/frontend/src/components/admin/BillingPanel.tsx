'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FormActions from '@/components/ui/FormActions';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { AdminUser, PaidPlanId } from '@/types';

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
const dayFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });

export const PLAN_PRICES: Record<PaidPlanId, { name: string; naira: number }> = {
  monthly: { name: 'Monthly', naira: 5000 },
  yearly: { name: 'Yearly', naira: 50000 },
  weekly: { name: 'Full capacity: 1 week', naira: 3000 },
  day: { name: 'Full capacity: 1 day', naira: 800 },
};

/** Money in: what owners pay, who's paying, and the switch for the full-capacity passes. */
export default function BillingPanel() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'billing'], queryFn: adminApi.billing });
  const passes = useMutation({
    mutationFn: adminApi.setPasses,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'billing'] }),
  });

  if (isLoading) return <Skeleton className="h-[140px] rounded-2xl" />;
  if (error || !data) return <p className="text-sm text-white/60" role="alert">{errorMessage(error, "Couldn't load payments.")}</p>;

  if (!data.billingEnabled) {
    return (
      <div className="glass-card rounded-2xl p-5 text-[14px] leading-relaxed text-white/55">
        Payments are switched off, so every owner has every feature. Set <code className="text-white/75">BILLING_ENABLED=true</code> and
        {' '}<code className="text-white/75">PAYSTACK_SECRET_KEY</code> in the server&apos;s settings to start charging; each owner&apos;s free trial starts then.
      </div>
    );
  }

  const conversion = data.trialsEnded30 ? Math.round((data.trialsConverted30 / data.trialsEnded30) * 100) : null;
  return (
    <div className="space-y-3">
      {!data.paystackConfigured && (
        <p className="glass-card rounded-2xl p-4 text-[14px] text-white/70">
          Paystack isn&apos;t set up (<code>PAYSTACK_SECRET_KEY</code> is empty), so owners can&apos;t pay online yet. You can still record payments by hand below.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid this month" value={naira(data.revenueThisMonthKobo)} sub={`${data.paymentsThisMonth} ${data.paymentsThisMonth === 1 ? 'payment' : 'payments'}`} />
        <Stat label="Paying owners now" value={String(data.payingOwners)} sub={data.byPlan.filter((p) => p.owners).map((p) => `${p.owners} ${p.planName}`).join(' · ') || 'None yet'} />
        <Stat label="On the free trial" value={String(data.onTrial)} />
        <Stat label="Trials that paid" value={conversion === null ? '–' : `${conversion}%`} sub={data.trialsEnded30 ? `${data.trialsConverted30} of ${data.trialsEnded30} ended in 30 days` : 'No trial has ended yet'} />
      </div>

      <div className="glass-card flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white/80">Full-capacity passes</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50">
            Weekly ₦3,000 and Day ₦800, with 20 assistant messages a day. Your plan: switch them on once about 50 owners pay Monthly.
          </p>
        </div>
        <button
          type="button" role="switch" aria-checked={data.passesEnabled} aria-label="Offer full-capacity passes"
          disabled={passes.isPending} onClick={() => passes.mutate(!data.passesEnabled)}
          className={cn('relative h-8 w-14 shrink-0 rounded-full ring-1 ring-inset transition disabled:opacity-50',
            data.passesEnabled ? 'bg-white/80 ring-white/80' : 'bg-white/[0.08] ring-white/[0.15]')}
        >
          <span className={cn('absolute top-1 h-6 w-6 rounded-full transition-all', data.passesEnabled ? 'left-7 bg-ink-950' : 'left-1 bg-white/70')} />
        </button>
      </div>
      {passes.error && <p className="text-[13px] text-white/70" role="alert">{errorMessage(passes.error, "Couldn't change it. Try again.")}</p>}

      {data.recent.length > 0 && (
        <div className="glass-card overflow-hidden rounded-2xl">
          <p className="border-b border-white/[0.06] px-5 py-3 text-sm font-semibold text-white/75">Latest payments</p>
          <ul className="divide-y divide-white/[0.05]">
            {data.recent.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 px-5 py-3 text-[14px]">
                <span className="min-w-0">
                  <span className="block truncate text-white/85">{p.ownerName}</span>
                  <span className="block truncate text-[13px] text-white/40">
                    {p.planName} · {p.paidAt && dayFmt.format(new Date(p.paidAt))} · {p.provider === 'manual' ? `by hand${p.note ? `: ${p.note}` : ''}` : 'Paystack'}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-white/85">{p.amountText}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[12px] font-medium text-white/40">{label}</p>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-white/85">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-white/40">{sub}</p>}
    </div>
  );
}

/** Money an owner sent straight to your account: switches their plan on at once. */
export function RecordPayment({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  return (
    <Modal open={user !== null} onClose={onClose} title="Record a payment">
      {user && <RecordPaymentForm user={user} onDone={onClose} />}
    </Modal>
  );
}

function RecordPaymentForm({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<PaidPlanId>('monthly');
  const [amount, setAmount] = useState(String(PLAN_PRICES.monthly.naira));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => adminApi.recordPayment(user.id, { plan, amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!(Number(amount) > 0)) return setError('Enter the amount you received.');
    save.mutate(undefined, { onError: (err) => setError(errorMessage(err, "Couldn't record it. Try again.")) });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-[14px] leading-relaxed text-white/60">
        For money {user.name} sent straight to your account. Check it has arrived in your bank first: never go by a screenshot.
        Their plan switches on as soon as you save.
      </p>
      <Select id="manual-plan" label="Plan" value={plan} onChange={(e) => { const p = e.target.value as PaidPlanId; setPlan(p); setAmount(String(PLAN_PRICES[p].naira)); }}>
        {(Object.keys(PLAN_PRICES) as PaidPlanId[]).map((p) => (
          <option key={p} value={p} className="bg-ink-900">{PLAN_PRICES[p].name} · ₦{PLAN_PRICES[p].naira.toLocaleString('en-NG')}</option>
        ))}
      </Select>
      <Input id="manual-amount" label="Amount received (₦)" type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input id="manual-note" label="Note (optional)" placeholder="e.g. GTB transfer, 13 Oct" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="lg" loading={save.isPending}>Switch plan on</Button>
      </FormActions>
    </form>
  );
}
