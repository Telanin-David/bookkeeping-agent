'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import AuthCard from '@/components/auth/AuthCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) { setError('Enter the email you signed up with.'); return; }
    setSending(true);
    setError('');
    try {
      await authApi.forgotPassword(address);
      setSentTo(address);
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the link. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard subtitle="Reset your password">
        <h1 className="text-[17px] font-semibold text-white/90">Check your email</h1>
        {/* The same words whether or not the email has an account, so the page can't reveal which do. */}
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">
          If an account uses <span className="text-white/85">{sentTo}</span>, we&apos;ve sent it a link to choose a new password.
          It works once, for 1 hour. Check the spam folder too.
        </p>
        <div className="mt-6 space-y-2">
          <Link href="/login" className="block"><Button size="lg" className="w-full">Back to sign in</Button></Link>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => setSentTo('')}>Use a different email</Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Reset your password">
      <p className="mb-5 text-[14px] leading-relaxed text-white/60">
        Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }} error={error || undefined} />
        <Button type="submit" size="lg" className="w-full" loading={sending}>Send me a link</Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-white/40">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-white/70 underline underline-offset-2 hover:text-white/90">Sign in</Link>
      </p>
    </AuthCard>
  );
}
