'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';

type State = { kind: 'working' } | { kind: 'done' } | { kind: 'failed'; message: string };

function VerifyEmail() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>({ kind: 'working' });
  const signedIn = useAuthStore((s) => s.status === 'authenticated');
  // React runs effects twice in development; a token only works once.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) {
      setState({ kind: 'failed', message: 'This link is missing its code. Open the link from the email again.' });
      return;
    }
    authApi.verifyEmail(token)
      .then(() => {
        setState({ kind: 'done' });
        // Hide the "confirm your email" banner without waiting for a reload.
        const { user } = useAuthStore.getState();
        if (user) useAuthStore.setState({ user: { ...user, emailVerified: true } });
      })
      .catch((err) => setState({ kind: 'failed', message: errorMessage(err, "Couldn't confirm your email. Check your connection and try again.") }));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="glass-card w-full max-w-sm rounded-2xl p-7 text-center">
        {state.kind === 'working' && <p className="text-[15px] text-white/70">Confirming your email…</p>}
        {state.kind === 'done' && (
          <>
            <h1 className="text-lg font-semibold text-white/90">Email confirmed</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-white/55">
              Alerts about your shop (money owed to you, bills due, low stock) can now reach you by email.
            </p>
          </>
        )}
        {state.kind === 'failed' && (
          <>
            <h1 className="text-lg font-semibold text-white/90">That didn&apos;t work</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-white/55" role="alert">{state.message}</p>
          </>
        )}
        {state.kind !== 'working' && (
          <Link
            href={signedIn ? (state.kind === 'done' ? '/' : '/settings/alerts') : '/login'}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-white/90 px-6 text-[14px] font-semibold text-ink-950 transition hover:bg-white"
          >
            {signedIn ? (state.kind === 'done' ? 'Go to the app' : 'Get a new link') : 'Sign in'}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams needs a Suspense boundary for the production build.
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <VerifyEmail />
    </Suspense>
  );
}
