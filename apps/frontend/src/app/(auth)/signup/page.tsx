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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Create account</h1>
        <p className="mb-6 text-sm text-gray-500">Start managing your shop finances</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name"     label="Full name" error={errors.name?.message}     {...register('name')} />
          <Input id="email"    label="Email"     type="email" error={errors.email?.message}    {...register('email')} />
          <Input id="phone"    label="Phone (optional)" error={errors.phone?.message}    {...register('phone')} />
          <Input id="password" label="Password (min 8 chars)" type="password" error={errors.password?.message} {...register('password')} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
