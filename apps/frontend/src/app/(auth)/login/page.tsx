'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
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

        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
