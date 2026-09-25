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
  name:     z.string().min(2),
  email:    z.string().email(),
  phone:    z.string().optional(),
  password: z.string().min(8),
});

type Form = z.infer<typeof schema>;

export default function SignupPage() {
  const { signup } = useAuth();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ name, email, password, phone }: Form) {
    setError('');
    try {
      await signup(name, email, password, phone);
    } catch {
      setError('Registration failed. Email may already be in use.');
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-8">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.025] blur-3xl" />

      <div className="glass-card relative w-full max-w-sm rounded-2xl p-8">
        <div className="mb-7">
          <p className="text-lg font-bold tracking-tight text-white/85">Bookkeeping Agent</p>
          <p className="mt-0.5 text-xs text-white/30 tracking-wide">Create your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name"     label="Full name"              error={errors.name?.message}     {...register('name')} />
          <Input id="email"    label="Email"  type="email"    error={errors.email?.message}    {...register('email')} />
          <Input id="phone"    label="Phone (optional)"       error={errors.phone?.message}    {...register('phone')} />
          <Input id="password" label="Password (min 8 chars)" type="password" error={errors.password?.message} {...register('password')} />
          {error && <p className="text-xs text-white/50">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
        </form>

        <p className="mt-5 text-center text-xs text-white/25">
          Already have an account?{' '}
          <Link href="/login" className="text-white/55 hover:text-white/80 font-medium underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
