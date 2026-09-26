'use client';
import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { DEMO_USER_ID } from '@/lib/demo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const router = useRouter();
  const { setAuth, status, user } = useAuthStore();

  // A device that's still signed in (restored on load) skips the login screen.
  useEffect(() => {
    if (status === 'authenticated' && user?.id !== DEMO_USER_ID) router.replace('/');
  }, [status, user, router]);
  const { setShops } = useShopsStore();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ email, password }: Form) {
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401) setError('Invalid email or password.');
      else if (status === 429) setError(isAxiosError(err) ? err.response?.data?.message : 'Too many attempts. Try again later.');
      else setError("Couldn't log in. Check your connection and try again.");
    }
  }

  // Preview starts at onboarding, like a new account; onboarding creates the demo shop.
  function enterPreviewMode() {
    setShops([]);
    setAuth({ id: DEMO_USER_ID, name: 'Demo User', email: 'demo@example.com' }, 'demo-token');
    router.replace('/onboarding');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.025] blur-3xl" />

      <div className="glass-card relative w-full max-w-sm rounded-2xl p-8">
        {/* Wordmark */}
        <div className="mb-7">
          <p className="text-lg font-bold tracking-tight text-white/85">Bookkeeping Agent</p>
          <p className="mt-0.5 text-xs text-white/30 tracking-wide">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="email"    label="Email"    type="email"    error={errors.email?.message}    {...register('email')} />
          <Input id="password" label="Password" type="password" error={errors.password?.message} {...register('password')} />
          {error && <p className="text-xs text-white/50">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[10px] uppercase tracking-widest text-white/20">or</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        <Button variant="secondary" className="w-full" onClick={enterPreviewMode}>
          Preview UI — demo mode
        </Button>

        <p className="mt-5 text-center text-xs text-white/25">
          No account?{' '}
          <Link href="/signup" className="text-white/55 hover:text-white/80 font-medium underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
