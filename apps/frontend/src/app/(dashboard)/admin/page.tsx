'use client';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { usd, shortDay, percent, count } from '@/lib/admin';
import { useAuthStore } from '@/store/auth';
import PageWrapper from '@/components/layout/PageWrapper';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import DailyCostChart from '@/components/admin/DailyCostChart';
import type { AdminOverview, AdminUser } from '@/types';

// Above this share of the assistant's records being fixed by owners, Haiku isn't accurate
// enough and a stronger model is worth its price.
const FIX_RATE_LIMIT = 0.05;

export default function AdminPage() {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin === true);
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: adminApi.overview, enabled: isAdmin });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.users, enabled: isAdmin });

  // The dashboard layout already shows non-admins "not found"; this is a second lock.
  if (!isAdmin) notFound();

  return (
    <PageWrapper title="Business dashboard">
      <div className="max-w-5xl space-y-8">
        {overview.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Loading">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
          </div>
        ) : overview.error ? (
          <p className="text-sm text-white/60" role="alert">{errorMessage(overview.error, "Couldn't load the dashboard. Try again.")}</p>
        ) : overview.data && <Overview o={overview.data} />}

        <section>
          <SectionTitle title="Users" note="Last 30 days, most AI spending first. Counts only: their sales and customers stay private." />
          {users.isLoading ? (
            <ListSkeleton rows={3} />
          ) : users.error ? (
            <p className="text-sm text-white/60" role="alert">{errorMessage(users.error, "Couldn't load the users.")}</p>
          ) : users.data && <UserList users={users.data.data} total={users.data.total} />}
        </section>
      </div>
    </PageWrapper>
  );
}

function Overview({ o }: { o: AdminOverview }) {
  const { ai, users, accuracy } = o;
  const tooManyFixes = accuracy.rate !== null && accuracy.rate > FIX_RATE_LIMIT;
  return (
    <>
      <section>
        <SectionTitle title="AI spending" note="Everyone's use, including yours: this is the bill." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Today" value={usd(ai.costToday)} sub={`${count(ai.messagesToday)} ${ai.messagesToday === 1 ? 'message' : 'messages'}`} />
          <Stat label="This month so far" value={usd(ai.monthToDate)} />
          <Stat label="This month, at this pace" value={usd(ai.monthProjected)} />
          <Stat label="Per message" value={ai.costPerMessage === null ? '–' : usd(ai.costPerMessage)} sub={`${count(ai.messages)} in 30 days`} />
        </div>
        <div className="mt-3">
          <DailyCostChart daily={ai.daily} />
        </div>
        <p className="mt-2 text-[13px] text-white/45">
          {ai.costPerChatUser === null
            ? 'Nobody has chatted with the assistant in the last 30 days.'
            : `${usd(ai.costPerChatUser)} per owner who chatted in the last 30 days (${ai.chatUsers} ${ai.chatUsers === 1 ? 'owner' : 'owners'}).`}
          {ai.failed > 0 && ` The assistant couldn't answer ${ai.failed} ${ai.failed === 1 ? 'time' : 'times'}.`}
        </p>
        {o.limit && (
          <p className="mt-1 text-[13px] text-white/45">
            Daily limit: {o.limit.daily} messages per owner (CHAT_DAILY_LIMIT on the server).{' '}
            {o.limit.ownerDays === 0
              ? 'Nobody has reached it in the last 30 days.'
              : `Reached ${o.limit.ownerDays} ${o.limit.ownerDays === 1 ? 'time' : 'times'} by ${o.limit.owners} ${o.limit.owners === 1 ? 'owner' : 'owners'} in the last 30 days.`}
          </p>
        )}
      </section>

      <section>
        <SectionTitle title="Owners" note="Your own admin account isn't counted here." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Signed up" value={count(users.total)} sub={`${users.newInWindow} in the last 30 days`} />
          <Stat label="Email confirmed" value={String(users.verified)} sub={users.total ? percent(users.verified, users.total) : undefined} />
          <Stat label="Used the app today" value={String(users.activeToday)} />
          <Stat label="Used it this week" value={String(users.active7)} sub={`${users.active30} in 30 days`} />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="glass-card rounded-2xl p-5">
          <p className="text-sm font-semibold text-white/75">Is the assistant accurate?</p>
          {accuracy.recorded === 0 ? (
            <p className="mt-2 text-[14px] text-white/50">The assistant hasn&apos;t recorded anything in the last 30 days.</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white/85">{percent(accuracy.corrected, accuracy.recorded)}</p>
              <p className="mt-1 text-[14px] text-white/55">
                of what it recorded was later changed or deleted by the owner ({accuracy.corrected} of {accuracy.recorded}).
              </p>
              <p className="mt-3 text-[13px] text-white/45">
                {tooManyFixes
                  ? 'More than 1 in 20 is being fixed. Some fixes are owners changing their minds, but if this stays high, try a stronger model.'
                  : 'Under 1 in 20. Some fixes are owners changing their minds, not the assistant’s mistakes.'}
              </p>
            </>
          )}
        </section>

        <section className="glass-card rounded-2xl p-5">
          <p className="text-sm font-semibold text-white/75">Do owners come back?</p>
          <ul className="mt-3 space-y-2.5">
            {o.returning.map((r) => (
              <li key={r.afterDays} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="text-white/55">{r.afterDays === 7 ? 'After a week' : `After ${r.afterDays / 7} weeks`}</span>
                <span className="text-right tabular-nums text-white/80">
                  {r.eligible === 0
                    ? <span className="text-white/35">No one signed up that long ago yet</span>
                    : <>{percent(r.returned, r.eligible)} <span className="text-white/40">({r.returned} of {r.eligible})</span></>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-white/45">Owners who opened the app again at least that long after signing up.</p>
        </section>
      </div>

      <p className="text-[13px] text-white/45">
        Alert emails in the last 30 days: {o.emails.sent} sent
        {o.emails.failed > 0 ? `, ${o.emails.failed} failed (check the email settings on the server)` : ', none failed'}.
      </p>
    </>
  );
}

function UserList({ users, total }: { users: AdminUser[]; total: number }) {
  if (users.length === 0) return <p className="text-sm text-white/40">No one has signed up yet.</p>;
  const fixed = (u: AdminUser) => (u.recorded ? `${u.corrected} of ${u.recorded}` : '–');
  const last = (u: AdminUser) => (u.lastActive ? shortDay(u.lastActive) : 'Never');
  return (
    <>
      {/* Phones: one card per owner. */}
      <ul className="space-y-2 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="glass-card rounded-2xl px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[15px] font-medium text-white/85">{u.name}{u.isAdmin && <AdminTag />}</p>
              <p className="shrink-0 text-[15px] tabular-nums text-white/80">{usd(u.cost)}</p>
            </div>
            <p className="truncate text-[13px] text-white/40">{u.email}{!u.emailVerified && ' · not confirmed'}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-[13px] text-white/55">
              <span className="whitespace-nowrap">Last used {last(u)} ·</span>
              <span className="whitespace-nowrap">{u.activeDays} {u.activeDays === 1 ? 'day' : 'days'} ·</span>
              <span className="whitespace-nowrap">{count(u.messages)} {u.messages === 1 ? 'message' : 'messages'}{u.recorded > 0 && ' ·'}</span>
              {u.recorded > 0 && <span className="whitespace-nowrap">fixed {fixed(u)}</span>}
            </p>
          </li>
        ))}
      </ul>

      {/* Wider screens: a table. */}
      <div className="glass-card hidden overflow-x-auto rounded-2xl md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-white/40">
              <th className="px-4 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Signed up</th>
              <th className="px-3 py-2.5 font-medium">Last used</th>
              <th className="px-3 py-2.5 text-right font-medium">Days used</th>
              <th className="px-3 py-2.5 text-right font-medium">Messages</th>
              <th className="px-3 py-2.5 text-right font-medium">AI cost</th>
              <th className="px-4 py-2.5 text-right font-medium">Fixed</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                <td className="max-w-[260px] px-4 py-2.5">
                  <p className="truncate font-medium text-white/85">{u.name}{u.isAdmin && <AdminTag />}</p>
                  <p className="truncate text-white/40">{u.email}{!u.emailVerified && ' · not confirmed'}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-white/60">{shortDay(u.signedUp)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-white/60">{last(u)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{u.activeDays}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{count(u.messages)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/85">{usd(u.cost)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-white/60">{fixed(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > users.length && <p className="mt-2 text-[13px] text-white/40">Showing the top {users.length} of {total}.</p>}
    </>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-white/45">{title}</h2>
      {note && <p className="mt-0.5 text-[13px] text-white/35">{note}</p>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[12px] font-medium text-white/40">{label}</p>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-white/85">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-white/40">{sub}</p>}
    </div>
  );
}

function AdminTag() {
  return <span className="ml-1.5 rounded-md border border-white/10 px-1.5 py-px align-middle text-[10px] font-semibold uppercase tracking-wide text-white/45">Admin</span>;
}
