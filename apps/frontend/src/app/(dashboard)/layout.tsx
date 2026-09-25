'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import { useShops } from '@/hooks/useShops';
import { useAlerts } from '@/hooks/useAlerts';
import { useAlertsStore } from '@/store/alerts';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  // A signed-in account with no shop hasn't finished onboarding yet.
  const { fetched } = useShops();
  useEffect(() => {
    if (fetched && fetched.length === 0) router.replace('/onboarding');
  }, [fetched, router]);

  // Keeps the ☰ / sidebar alert badge correct everywhere, not just after visiting Alerts.
  const { data: activeAlerts } = useAlerts('active');
  const setActiveCount = useAlertsStore((s) => s.setActiveCount);
  useEffect(() => {
    if (activeAlerts) setActiveCount(activeAlerts.total);
  }, [activeAlerts, setActiveCount]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <span className="text-sm text-white/30">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 print:block print:h-auto print:overflow-visible print:bg-white">
      {/* Desktop sidebar */}
      <div className="hidden md:flex print:hidden">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        {/* Desktop header */}
        <div className="hidden md:flex print:hidden">
          <Header />
        </div>

        {/* Mobile top nav */}
        <div className="flex flex-col md:hidden print:hidden">
          <MobileNav />
        </div>

        <main className="flex flex-1 overflow-hidden print:block print:overflow-visible">{children}</main>
      </div>
    </div>
  );
}
