'use client';
import { useState } from 'react';
import Link from 'next/link';
import { X } from '@phosphor-icons/react';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';

/**
 * Alerts are only emailed to a confirmed address. Shown until the owner confirms; they
 * can hide it for this visit. Not shown in demo mode (no emailVerified there).
 */
export default function VerifyEmailBanner() {
  const user = useAuthStore((s) => s.user);
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified !== false || hidden) return null;

  async function resend() {
    setSending(true);
    setNote('');
    try {
      const r = await authApi.resendVerification();
      if (r.alreadyVerified) {
        useAuthStore.setState({ user: { ...user!, emailVerified: true } });
        return;
      }
      setNote(`Sent. Check ${r.email ?? 'your inbox'}, and the spam folder.`);
    } catch (err) {
      setNote(errorMessage(err, "Couldn't send it. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-start gap-3 border-b border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-[13px] leading-snug text-white/70 md:px-6 print:hidden" role="status">
      <p className="min-w-0 flex-1">
        Confirm your email to get alerts there. We sent a link to <span className="text-white/90">{user.email}</span>.{' '}
        <button type="button" onClick={resend} disabled={sending} className="font-medium text-white/90 underline underline-offset-2 disabled:opacity-50">
          {sending ? 'Sending…' : 'Send again'}
        </button>
        {' · '}
        <Link href="/settings/alerts" className="text-white/60 underline underline-offset-2">Alert settings</Link>
        {note && <span className="mt-1 block text-white/55">{note}</span>}
      </p>
      <button type="button" onClick={() => setHidden(true)} aria-label="Hide" className="shrink-0 text-white/40 hover:text-white/80">
        <X size={14} />
      </button>
    </div>
  );
}
