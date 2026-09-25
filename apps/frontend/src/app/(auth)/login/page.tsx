'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart2 } from 'lucide-react';
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
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password.');
    }
  }

  function enterPreviewMode() {
    const demoShop = {
      id: 'demo-shop-1',
      ownerId: 'demo-user-1',
      name: 'My Demo Shop',
      type: 'retail' as const,
      location: 'Lagos',
      currency: 'NGN',
      isActive: true,
    };
    setShops([demoShop]);
    setActiveShop('demo-shop-1');
    setAuth({ id: 'demo-user-1', name: 'Demo User', email: 'demo@example.com' }, 'demo-token');
    router.replace('/');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/8 blur-3xl" />

      <div className="glass-card relative w-full max-w-sm rounded-2xl p-8">
        {/* Logo */}
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <BarChart2 size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Bookkeeping Agent</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="email"    label="Email"    type="email"    error={errors.email?.message}    {...register('email')} />
          <Input id="password" label="Password" type="password" error={errors.password?.message} {...register('password')} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[10px] uppercase tracking-widest text-white/25">or</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        <Button variant="secondary" className="w-full" onClick={enterPreviewMode}>
          Preview UI — demo mode
        </Button>

        <p className="mt-5 text-center text-xs text-white/30">
          No account?{' '}
          <Link href="/signup" className="text-amber-400 hover:text-amber-300 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
