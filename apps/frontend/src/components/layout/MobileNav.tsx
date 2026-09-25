'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, LayoutDashboard, ArrowLeftRight, MessageSquare,
  BarChart2, Bell, Upload, Store, LogOut, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { useAlertsStore } from '@/store/alerts';

const NAV = [
  { href: '/chat',         label: 'Chat',          Icon: MessageSquare },
  { href: '/',             label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { href: '/reports',      label: 'Reports',       Icon: BarChart2 },
  { href: '/alerts',       label: 'Alerts',        Icon: Bell },
  { href: '/imports',      label: 'Import',        Icon: Upload },
  { href: '/shops',        label: 'Shops',         Icon: Store },
];

export default function MobileNav() {
  const pathname    = usePathname();
  const alertCount  = useAlertsStore((s) => s.activeCount);
  const user        = useAuthStore((s) => s.user);
  const active      = useShopsStore((s) => s.activeShop());
  const { logout }  = useAuth();

  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  function closeAll() { setLeftOpen(false); setRightOpen(false); }

  return (
    <>
      {/* ── Top bar ── */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] bg-ink-950/80 px-4 backdrop-blur-xl">
        {/* Left: hamburger */}
        <button
          onClick={() => { setRightOpen(false); setLeftOpen((v) => !v); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl glass text-white/60 transition hover:text-white/90"
          aria-label="Open menu"
        >
          {leftOpen ? <X size={17} /> : <Menu size={17} />}
        </button>

        {/* Center: wordmark */}
        <p className="absolute left-1/2 -translate-x-1/2 text-sm font-bold tracking-tight text-white/80">
          Bookkeeping<span className="ml-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">AI</span>
        </p>

        {/* Right: shop pill */}
        <button
          onClick={() => { setLeftOpen(false); setRightOpen((v) => !v); }}
          className="flex h-10 items-center gap-1.5 rounded-xl glass px-3 text-sm font-medium text-white/60 transition hover:text-white/90"
          aria-label="Open shop menu"
        >
          <span className="max-w-[90px] truncate">{active?.name ?? 'Shop'}</span>
          <ChevronRight size={13} className="shrink-0 text-white/30" />
        </button>
      </header>

      {/* ── Backdrop ── */}
      {(leftOpen || rightOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={closeAll}
        />
      )}

      {/* ── Left drawer: navigation ── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col glass-elevated transition-transform duration-200',
        leftOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
          <div>
            <p className="text-base font-bold tracking-tight text-white/85">Bookkeeping AI</p>
            <p className="mt-0.5 text-[10px] text-white/30 tracking-wide">Navigation</p>
          </div>
          <button
            onClick={() => setLeftOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass text-white/50 hover:text-white/80"
          >
            <X size={15} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeAll}
                className={cn(
                  'flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/[0.09] text-white/90 border border-white/[0.09]'
                    : 'text-white/50 hover:bg-white/[0.05] hover:text-white/75',
                )}
              >
                <Icon size={17} className={cn('shrink-0', isActive ? 'text-white/75' : 'text-white/35')} />
                <span className="flex-1">{label}</span>
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] px-1.5 text-[10px] font-semibold text-white/55">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.07] px-3 py-3">
          <button
            onClick={() => { closeAll(); logout(); }}
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-white/40 transition hover:bg-white/[0.05] hover:text-white/70"
          >
            <LogOut size={17} className="shrink-0 text-white/30" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Right drawer: shop & user ── */}
      <aside className={cn(
        'fixed inset-y-0 right-0 z-50 flex w-72 flex-col glass-elevated transition-transform duration-200',
        rightOpen ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
          <div>
            <p className="text-base font-bold tracking-tight text-white/85">Account</p>
            <p className="mt-0.5 text-[10px] text-white/30 tracking-wide">{user?.name ?? 'User'}</p>
          </div>
          <button
            onClick={() => setRightOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass text-white/50 hover:text-white/80"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 px-3 py-3 space-y-2">
          {/* Active shop card */}
          {active && (
            <div className="rounded-xl glass p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Active shop</p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg glass shrink-0">
                  <Store size={15} className="text-white/50" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85 truncate">{active.name}</p>
                  <p className="text-xs text-white/35 capitalize">{active.type} · {active.currency}</p>
                </div>
              </div>
            </div>
          )}

          <Link
            href="/shops"
            onClick={closeAll}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-white/50 transition hover:bg-white/[0.05] hover:text-white/75"
          >
            <Store size={17} className="shrink-0 text-white/30" />
            Manage shops
          </Link>
        </div>

        <div className="border-t border-white/[0.07] px-3 py-3">
          <button
            onClick={() => { closeAll(); logout(); }}
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-white/40 transition hover:bg-white/[0.05] hover:text-white/70"
          >
            <LogOut size={17} className="shrink-0 text-white/30" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
