'use client';
import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { PASSWORD_HINT, PASSWORD_RULE } from '@/lib/password';
import { useAuthStore } from '@/store/auth';
import AuthCard from '@/components/auth/AuthCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

function ResetPassword() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [linkProblem, setLinkProblem] = useState(token ? '' : 'This link is missing its code. Open the link from the email again, or ask for a new one.');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!PASSWORD_RULE.test(password)) { setError(PASSWORD_HINT); return; }
    setSaving(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      // The server signed every device out, this one included.
      if (useAuthStore.getState().status === 'authenticated') useAuthStore.getState().clearAuth();
      setDone(true);
    } catch (err) {
      const message = errorMessage(err, "Couldn't save the new password. Check your connection and try again.");
      // A used, expired or broken link can't be fixed by retyping the password.
      if (/link/i.test(message)) setLinkProblem(message); else setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <AuthCard subtitle="Reset your password">
        <h1 className="text-[17px] font-semibold text-white/90">Password changed</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">
          Sign in with your new password. For your safety, every phone and computer that was signed in has been signed out.
        </p>
        <Link href="/login" className="mt-6 block"><Button size="lg" className="w-full">Sign in</Button></Link>
      </AuthCard>
    );
  }

  if (linkProblem) {
    return (
      <AuthCard subtitle="Reset your password">
        <h1 className="text-[17px] font-semibold text-white/90">That link didn&apos;t work</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60" role="alert">{linkProblem}</p>
        <Link href="/forgot-password" className="mt-6 block"><Button size="lg" className="w-full">Get a new link</Button></Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Reset your password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="relative">
          <Input id="new-password" label="New password" type={show ? 'text' : 'password'} autoComplete="new-password"
            value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
            error={error || undefined} hint={PASSWORD_HINT} className="pr-16" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
            className="absolute right-2 top-[1.625rem] flex h-9 items-center rounded-lg px-2.5 text-[13px] text-white/55 transition hover:text-white/85 active:bg-white/[0.08]">
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={saving}>Save new password</Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary for the production build.
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-ink-950" />}>
      <ResetPassword />
    </Suspense>
  );
}
