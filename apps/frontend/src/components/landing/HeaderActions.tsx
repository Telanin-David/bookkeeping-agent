'use client';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { DEMO_USER_ID } from '@/lib/demo';

/** Sign in / Start free, or a way back into the app for an owner who's already signed in. */
export default function HeaderActions() {
  const signedIn = useAuthStore((s) => s.status === 'authenticated' && s.user?.id !== DEMO_USER_ID);

  if (signedIn) {
    return (
      <Link href="/dashboard" className="inline-flex h-10 items-center rounded-full bg-brand-yellow px-5 text-[14px] font-semibold text-brand-black transition hover:bg-[#ffd94a]">
        Open my shop
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link href="/login" className="inline-flex h-10 items-center rounded-full px-3 text-[14px] font-medium text-brand-paper/80 transition hover:text-brand-paper sm:px-4">
        Sign in
      </Link>
      <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-brand-yellow px-4 text-[14px] font-semibold text-brand-black transition hover:bg-[#ffd94a] sm:px-5">
        Start free
      </Link>
    </div>
  );
}
