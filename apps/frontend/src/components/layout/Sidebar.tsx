'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ArrowLeftRight, MessageSquare,
  BarChart2, Bell, Upload, Store, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertsStore } from '@/store/alerts';

const NAV = [
  { href: '/',             label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { href: '/chat',         label: 'Chat',          Icon: MessageSquare },
  { href: '/reports',      label: 'Reports',       Icon: BarChart2 },
  { href: '/alerts',       label: 'Alerts',        Icon: Bell },
  { href: '/imports',      label: 'Import',        Icon: Upload },
  { href: '/shops',        label: 'Shops',         Icon: Store },
];

export default function Sidebar() {
  const pathname    = usePathname();
  const alertCount  = useAlertsStore((s) => s.activeCount);
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-0.5 px-2 py-2">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
              active
                ? 'bg-white/10 text-white shadow-glass-sm border border-white/10'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80',
            )}
          >
            <Icon
              size={16}
              className={cn(
                'shrink-0 transition-colors',
                active ? 'text-amber-400' : 'text-white/40 group-hover:text-white/60',
              )}
            />
            <span>{label}</span>
            {label === 'Alerts' && alertCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-ink-950">
                {alertCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-xl glass md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {open ? <X size={16} className="text-white/70" /> : <Menu size={16} className="text-white/70" />}
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full w-56 flex-col border-r border-white/[0.06] bg-ink-950/80 backdrop-blur-xl transition-transform duration-200 md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <BarChart2 size={15} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Bookkeeping</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/30">Agent</p>
          </div>
        </div>

        {nav}

        {/* Bottom gradient fade */}
        <div className="h-8 bg-gradient-to-t from-ink-950/80 to-transparent" />
      </aside>
    </>
  );
}
