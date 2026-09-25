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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Sign in</h1>
        <p className="mb-6 text-sm text-gray-500">Welcome back to Bookkeeping Agent</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="email"    label="Email"    type="email"    error={errors.email?.message}    {...register('email')} />
          <Input id="password" label="Password" type="password" error={errors.password?.message} {...register('password')} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="mb-3 text-center text-xs text-gray-400 uppercase tracking-wide">No backend yet</p>
          <Button variant="secondary" className="w-full" onClick={enterPreviewMode}>
            Preview UI — demo mode
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
