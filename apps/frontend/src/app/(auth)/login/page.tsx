'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
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
  const { setAuth } = useAuthStore();
  const { setShops, setActiveShop } = useShopsStore();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ email, password }: Form) {
    setError('');
    try { await login(email, password); }
    catch { setError('Invalid email or password.'); }
  }

  function enterPreviewMode() {
    const demo = { id: 'demo-shop-1', ownerId: 'demo-user-1', name: 'My Demo Shop', type: 'retail' as const, currency: 'NGN', isActive: true };
    setShops([demo]);
    setActiveShop('demo-shop-1');
    setAuth({ id: 'demo-user-1', name: 'Demo User', email: 'demo@example.com' }, 'demo-token');
    router.replace('/');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      <div className="glass-card relative w-full max-w-sm rounded-2xl p-8">
        {/* Wordmark */}
        <div className="mb-8">
          <p className="text-base font-semibold text-white/90 tracking-tight">Bookkeeping Agent</p>
          <p className="mt-0.5 text-xs text-white/30">Sign in to continue</p>
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
          Preview — demo mode
        </Button>

        <p className="mt-6 text-center text-xs text-white/25">
          No account?{' '}
          <Link href="/signup" className="text-white/60 hover:text-white/90 underline underline-offset-2">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
