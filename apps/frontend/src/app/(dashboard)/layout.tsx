'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <span className="text-sm text-white/30">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:flex">
          <Header />
        </div>

        {/* Mobile top nav */}
        <div className="flex flex-col md:hidden">
          <MobileNav />
        </div>

        <main className="flex flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
