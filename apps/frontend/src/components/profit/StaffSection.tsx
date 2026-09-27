'use client';
import { useState, type FormEvent } from 'react';
import { Plus } from '@phosphor-icons/react';
import { useStaff, useSaveStaff, useRemoveStaff, usePaySalaries } from '@/hooks/useProfit';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FormActions from '@/components/ui/FormActions';
import { errorMessage } from '@/lib/errors';
import { cn, formatShortDate, formatWhole, todayInLagos } from '@/lib/utils';
import type { StaffFields, StaffMember } from '@/types';

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Where they are with this month's pay, in a few words. */
function payStatus(s: StaffMember): string {
  if (s.payDate && s.due) return s.payDate < todayInLagos() ? `Salary was due ${formatShortDate(s.payDate)}` : `Salary due ${formatShortDate(s.payDate)}`;
  if (s.payDate && s.paid) return `Paid for ${formatShortDate(s.payDate)}`;
  if (s.payDate) return `Next pay day ${formatShortDate(s.payDate)}`;
  return s.lastPaidOn ? `Last paid ${formatShortDate(s.lastPaidOn)}` : 'No pay day set';
}

/**
 * Staff and salaries, on the Profit page. Optional: until someone is added it is one quiet
 * line, so owners who don't pay anyone never have to think about it.
 */
export default function StaffSection({ shopId, currency }: { shopId: string; currency?: string }) {
  const { data: staff, isLoading } = useStaff(shopId);
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
  const [paying, setPaying] = useState(false);
  if (isLoading || !staff) return null;
  const money = (n: number) => formatWhole(n, currency);

  return (
    <section id="staff" className="scroll-mt-4">
      {staff.length === 0 ? (
        <div className="glass-card flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] text-white/80 sm:text-sm">Do you pay staff?</p>
            <p className="mt-1 text-[14px] leading-relaxed text-white/45 sm:text-[13px]">
              Add them with their monthly pay to get a reminder on pay day and record everyone&apos;s salary in one tap.
            </p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setEditing('new')}>Add staff</Button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] py-2 pl-5 pr-2">
            <h2 className="text-sm font-semibold text-white/75">Staff</h2>
            <button
              type="button" onClick={() => setEditing('new')}
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] text-white/55 transition hover:bg-white/[0.06] hover:text-white/85 sm:text-[13px]"
            >
              <Plus size={14} weight="bold" /> Add
            </button>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {staff.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setEditing(s)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-white/90">{s.name}{s.role && <span className="text-white/40"> · {s.role}</span>}</p>
                    <p className={cn('mt-0.5 text-[13px]', s.due ? 'font-medium text-white/85' : 'text-white/40')}>{payStatus(s)}</p>
                  </div>
                  <span className="shrink-0 text-[15px] tabular-nums text-white/75">{s.monthlyPay !== null ? money(s.monthlyPay) : '—'}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/[0.06] p-4">
            <Button size="lg" className="w-full" onClick={() => setPaying(true)}>Pay salaries</Button>
          </div>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add staff' : 'Staff member'}>
        {editing !== null && <StaffForm shopId={shopId} member={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={paying} onClose={() => setPaying(false)} title="Pay salaries">
        {paying && <PaySalaries shopId={shopId} staff={staff} currency={currency} onDone={() => setPaying(false)} />}
      </Modal>
    </section>
  );
}

const toNumber = (s: string) => (s.trim() === '' ? null : Number(s.replace(/,/g, '')));

function StaffForm({ shopId, member, onDone }: { shopId: string; member?: StaffMember; onDone: () => void }) {
  const save = useSaveStaff(shopId);
  const remove = useRemoveStaff(shopId);
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [pay, setPay] = useState(member?.monthlyPay != null ? String(member.monthlyPay) : '');
  const [payDay, setPayDay] = useState(member?.payDay != null ? String(member.payDay) : '');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const monthlyPay = toNumber(pay);
    if (!name.trim()) return setError('Enter their name.');
    if (monthlyPay !== null && !(Number.isFinite(monthlyPay) && monthlyPay > 0)) return setError('Monthly pay must be a number above 0, or left empty.');
    const body: StaffFields = { name: name.trim(), role: role.trim() || null, monthlyPay, payDay: payDay ? Number(payDay) : null };
    try {
      await save.mutateAsync({ ...body, id: member?.id });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save. Check your connection and try again."));
    }
  }

  async function removeMember() {
    try { await remove.mutateAsync(member!.id); onDone(); } catch (err) { setError(errorMessage(err, "Couldn't remove them. Try again.")); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        <Input id="staff-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <Input id="staff-role" label="Job (optional)" placeholder="e.g. Sales girl, Driver" value={role} onChange={(e) => setRole(e.target.value)} />
        <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
          <Input id="staff-pay" label="Monthly pay (optional)" type="number" inputMode="decimal" min="0" value={pay} onChange={(e) => setPay(e.target.value)} />
          <Select id="staff-payday" label="Pay day" value={payDay} onChange={(e) => setPayDay(e.target.value)}>
            <option value="" className="bg-ink-900">No set day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d} className="bg-ink-900">{d === 31 ? 'Last day of the month' : `${ordinal(d)} of the month`}</option>
            ))}
          </Select>
        </div>
        <p className="text-[13px] leading-relaxed text-white/40">With a pay day, you&apos;ll get a reminder the day before until their salary is recorded.</p>
        {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
        <FormActions>
          <Button type="button" size="lg" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" size="lg" loading={save.isPending}>{member ? 'Save' : 'Add'}</Button>
        </FormActions>
      </form>

      {member && (
        <div className="border-t border-white/[0.06] pt-4">
          {confirmRemove ? (
            <div className="space-y-2">
              <p className="text-[13px] text-white/60">Take {member.name} off your staff list? Salaries already paid stay in your records.</p>
              <FormActions>
                <Button variant="ghost" size="lg" onClick={() => setConfirmRemove(false)}>Keep them</Button>
                <Button variant="danger" size="lg" onClick={removeMember} loading={remove.isPending}>Yes, they&apos;ve left</Button>
              </FormActions>
            </div>
          ) : (
            <Button variant="danger" size="lg" className="w-full sm:w-auto" onClick={() => setConfirmRemove(true)}>They&apos;ve left</Button>
          )}
        </div>
      )}
    </div>
  );
}

function PaySalaries({ shopId, staff, currency, onDone }: { shopId: string; staff: StaffMember[]; currency?: string; onDone: () => void }) {
  const pay = usePaySalaries(shopId);
  const [date, setDate] = useState(todayInLagos());
  // Everyone not yet paid for their current pay date starts ticked, at their usual pay.
  const [lines, setLines] = useState(() => staff.map((s) => ({
    id: s.id, name: s.name, on: !s.paid, amount: s.monthlyPay !== null ? String(s.monthlyPay) : '', note: s.paid && s.payDate ? `Already paid for ${formatShortDate(s.payDate)}` : undefined,
  })));
  const [error, setError] = useState('');
  const chosen = lines.filter((l) => l.on);
  const total = chosen.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (chosen.length === 0) return setError('Tick who you paid.');
    if (chosen.some((l) => !(Number(l.amount) > 0))) return setError('Enter how much you paid each person ticked.');
    try {
      await pay.mutateAsync({ date, payments: chosen.map((l) => ({ staffId: l.id, amount: Number(l.amount) })) });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't record the salaries. Check your connection and try again."));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-[14px] leading-relaxed text-white/50">Each salary is recorded as a running cost. Change an amount if you paid a different sum this time.</p>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={l.id} className="flex items-center gap-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
              <input
                type="checkbox" checked={l.on}
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                className="h-5 w-5 shrink-0 accent-white"
              />
              <span className="min-w-0">
                <span className={cn('block truncate text-[15px]', l.on ? 'text-white/90' : 'text-white/45')}>{l.name}</span>
                {l.note && <span className="block text-[12px] text-white/35">{l.note}</span>}
              </span>
            </label>
            <input
              aria-label={`Amount for ${l.name}`} type="number" inputMode="decimal" min="0" value={l.amount} disabled={!l.on}
              onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
              className="glass-input min-h-[2.75rem] w-32 rounded-xl px-3 py-2.5 text-right text-base tabular-nums disabled:opacity-40 sm:text-sm"
            />
          </li>
        ))}
      </ul>
      <Input id="salary-date" label="Paid on" type="date" value={date} max={todayInLagos()} onChange={(e) => setDate(e.target.value)} />
      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <FormActions>
        <Button type="button" size="lg" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="lg" loading={pay.isPending} disabled={chosen.length === 0}>
          {chosen.length ? `Record ${formatWhole(total, currency)}` : 'Record'}
        </Button>
      </FormActions>
    </form>
  );
}
