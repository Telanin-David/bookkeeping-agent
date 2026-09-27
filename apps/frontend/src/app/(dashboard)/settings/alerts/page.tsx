'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { DEMO_USER_ID } from '@/lib/demo';
import { useAuthStore } from '@/store/auth';
import PageWrapper from '@/components/layout/PageWrapper';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const WHAT_IS_EMAILED = [
  'A customer’s credit is past its due date and not fully paid',
  'A bill you owe is due within 2 days, or overdue',
  'A product is running low or has run out',
];

export default function AlertSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isDemo = user?.id === DEMO_USER_ID;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['alert-settings'], queryFn: accountApi.alertSettings, enabled: !isDemo && !!user });

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [quietOn, setQuietOn] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [resendNote, setResendNote] = useState('');

  useEffect(() => {
    if (!data) return;
    setEmailAlerts(data.emailAlerts);
    setQuietOn(data.quietStart !== data.quietEnd);
    if (data.quietStart !== data.quietEnd) { setQuietStart(data.quietStart); setQuietEnd(data.quietEnd); }
    // Keep the banner in step if the address was confirmed in another tab.
    if (user && user.emailVerified !== data.emailVerified) useAuthStore.setState({ user: { ...user, emailVerified: data.emailVerified } });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: FormEvent) {
    e.preventDefault();
    setNote('');
    setSaving(true);
    try {
      // Equal times mean "no quiet hours" on the server.
      const saved = await accountApi.updateAlertSettings({
        emailAlerts, quietStart: quietOn ? quietStart : '00:00', quietEnd: quietOn ? quietEnd : '00:00',
      });
      qc.setQueryData(['alert-settings'], saved);
      setNote('Saved.');
    } catch (err) {
      setNote(errorMessage(err, "Couldn't save. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setResendNote('');
    try {
      const r = await authApi.resendVerification();
      if (r.alreadyVerified) { qc.invalidateQueries({ queryKey: ['alert-settings'] }); return; }
      setResendNote(`Sent to ${r.email}. Check the spam folder too.`);
    } catch (err) {
      setResendNote(errorMessage(err, "Couldn't send it. Try again."));
    }
  }

  return (
    <PageWrapper title="Alert settings">
      <div className="max-w-lg space-y-4">
        {isDemo ? (
          <div className="glass-card rounded-2xl p-5 text-[14px] text-white/55">Alert emails are for real accounts, so there&apos;s nothing to set in demo mode.</div>
        ) : isLoading || !data ? (
          <div className="flex items-center gap-2 text-sm text-white/30"><Spinner className="h-4 w-4 text-white/20" /> Loading…</div>
        ) : (
          <>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-white/40">Your email</p>
              <p className="mt-1 text-[15px] text-white/90">{data.email}</p>
              {data.emailVerified ? (
                <p className="mt-1 text-[13px] text-white/50">Confirmed</p>
              ) : (
                <div className="mt-1.5 text-[13px] text-white/60">
                  Not confirmed yet, so no alert emails are sent.{' '}
                  <button type="button" onClick={resend} className="font-medium text-white/90 underline underline-offset-2">Send the link again</button>
                  {resendNote && <span className="mt-1 block text-white/50">{resendNote}</span>}
                </div>
              )}
            </div>

            <form onSubmit={save} className="glass-card space-y-5 rounded-2xl p-5">
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block text-[15px] text-white/90">Email me alerts</span>
                  <span className="mt-0.5 block text-[13px] text-white/45">At most one email an hour; anything new waits for the next one.</span>
                </span>
                <input id="email-alerts" type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="mt-1 h-5 w-5 accent-white" />
              </label>

              <ul className={cn('space-y-1 text-[13px] text-white/55', !emailAlerts && 'opacity-40')}>
                {WHAT_IS_EMAILED.map((w) => <li key={w}>· {w}</li>)}
              </ul>

              <div className={cn('space-y-3 border-t border-white/[0.06] pt-4', !emailAlerts && 'opacity-40')}>
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span>
                    <span className="block text-[15px] text-white/90">Quiet hours</span>
                    <span className="mt-0.5 block text-[13px] text-white/45">No emails in these hours; they arrive afterwards.</span>
                  </span>
                  <input id="quiet-on" type="checkbox" checked={quietOn} disabled={!emailAlerts} onChange={(e) => setQuietOn(e.target.checked)} className="mt-1 h-5 w-5 accent-white" />
                </label>
                {quietOn && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input id="quiet-start" label="From" type="time" value={quietStart} disabled={!emailAlerts} onChange={(e) => setQuietStart(e.target.value)} />
                    <Input id="quiet-end" label="Until" type="time" value={quietEnd} disabled={!emailAlerts} onChange={(e) => setQuietEnd(e.target.value)} />
                  </div>
                )}
              </div>

              <p className="text-[12px] text-white/35">Alerts always show in the app too. WhatsApp alerts are coming later.</p>
              <div className="flex items-center justify-end gap-3">
                {note && <span className="text-[13px] text-white/55" role="status">{note}</span>}
                <Button type="submit" loading={saving}>Save</Button>
              </div>
            </form>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
