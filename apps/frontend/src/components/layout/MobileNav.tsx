'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, LayoutDashboard, ArrowLeftRight, MessageSquare,
  BarChart2, Bell, Upload, Store, LogOut, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { useAlertsStore } from '@/store/alerts';

const NAV = [
  { href: '/chat',         label: 'Chat',         Icon: MessageSquare },
  { href: '/',             label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { href: '/reports',      label: 'Reports',      Icon: BarChart2 },
  { href: '/alerts',       label: 'Alerts',       Icon: Bell },
  { href: '/imports',      label: 'Import',       Icon: Upload },
  { href: '/shops',        label: 'Shops',        Icon: Store },
];

function getPageIcon(pathname: string) {
  if (pathname.startsWith('/transactions')) return ArrowLeftRight;
  if (pathname.startsWith('/reports'))      return BarChart2;
  if (pathname.startsWith('/alerts'))       return Bell;
  if (pathname.startsWith('/imports'))      return Upload;
  if (pathname.startsWith('/shops'))        return Store;
  if (pathname.startsWith('/chat'))         return MessageSquare;
  return LayoutDashboard;
}

export default function MobileNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const alertCount = useAlertsStore((s) => s.activeCount);
  const user       = useAuthStore((s) => s.user);
  const active     = useShopsStore((s) => s.activeShop());
  const { logout } = useAuth();

  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  function closeAll() { setLeftOpen(false); setRightOpen(false); }

  const PageIcon = getPageIcon(pathname);

  return (
    <>
      {/* ── Top bar: two separate floating elements ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 z-30 relative">

        {/* Left — hamburger in its own glass circle */}
        <button
          onClick={() => { setRightOpen(false); setLeftOpen((v) => !v); }}
          className="flex h-11 w-11 items-center justify-center rounded-full glass-elevated text-white/60 transition hover:text-white/90"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Right — single glass circle, three dots → account/settings */}
        <button
          onClick={() => { setLeftOpen(false); setRightOpen((v) => !v); }}
          className="flex h-11 w-11 items-center justify-center rounded-full glass-elevated text-white/50 transition hover:text-white/80"
          aria-label="Open account menu"
        >
          <MoreHorizontal size={18} />
        </button>

      </div>

      {/* ── Backdrop ── */}
      {(leftOpen || rightOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
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
            <p className="mt-0.5 text-[10px] text-white/30 tracking-wide">{user?.name ?? 'Demo User'}</p>
          </div>
          <button
            onClick={() => setLeftOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass text-white/45 hover:text-white/80 transition"
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
                  'flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/[0.09] text-white/90 border border-white/[0.08]'
                    : 'text-white/45 hover:bg-white/[0.05] hover:text-white/75',
                )}
              >
                <Icon size={17} className={cn('shrink-0', isActive ? 'text-white/70' : 'text-white/30')} />
                <span className="flex-1">{label}</span>
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.07] px-1.5 text-[10px] font-semibold text-white/55">
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
            className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium text-white/35 transition hover:bg-white/[0.05] hover:text-white/65"
          >
            <LogOut size={17} className="shrink-0 text-white/25" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Right drawer: shop & account ── */}
      <aside className={cn(
        'fixed inset-y-0 right-0 z-50 flex w-72 flex-col glass-elevated transition-transform duration-200',
        rightOpen ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
          <div>
            <p className="text-base font-bold tracking-tight text-white/85">Account</p>
            <p className="mt-0.5 text-[10px] text-white/30 tracking-wide">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={() => setRightOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass text-white/45 hover:text-white/80 transition"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 px-3 py-3 space-y-2">
          {active && (
            <div className="rounded-xl glass p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3">Active shop</p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg glass">
                  <Store size={15} className="text-white/45" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85 truncate">{active.name}</p>
                  <p className="text-xs text-white/35 capitalize mt-0.5">{active.type} · {active.currency}</p>
                </div>
              </div>
            </div>
          )}

          <Link
            href="/shops"
            onClick={closeAll}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white/75"
          >
            <Store size={17} className="shrink-0 text-white/25" />
            Manage shops
          </Link>
        </div>

        <div className="border-t border-white/[0.07] px-3 py-3">
          <button
            onClick={() => { closeAll(); logout(); }}
            className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium text-white/35 transition hover:bg-white/[0.05] hover:text-white/65"
          >
            <LogOut size={17} className="shrink-0 text-white/25" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
