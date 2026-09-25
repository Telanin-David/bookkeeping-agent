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
  const pathname   = usePathname();
  const alertCount = useAlertsStore((s) => s.activeCount);
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Mobile: hamburger button in top-left ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed left-4 top-3.5 z-50 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.06] hover:text-white/80 md:hidden"
      >
        <Menu size={18} />
      </button>

      {/* ── Mobile: backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in glass drawer ── */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 glass-elevated flex flex-col transition-transform duration-200 md:hidden',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-sm font-semibold text-white/90 tracking-tight">Bookkeeping</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/30">Agent</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70"
          >
            <X size={14} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                  active
                    ? 'bg-white/[0.08] text-white/90'
                    : 'text-white/45 hover:bg-white/[0.05] hover:text-white/70',
                )}
              >
                <Icon size={15} className="shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span className="font-medium">{label}</span>
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-semibold text-white/70">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Desktop: slim icon-only rail ── */}
      <aside className="hidden md:flex h-full w-14 flex-col items-center border-r border-white/[0.06] bg-ink-950 py-4 gap-1">
        {/* Logo mark */}
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <BarChart2 size={14} className="text-white/50" strokeWidth={1.5} />
        </div>

        {/* Nav icons */}
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'group relative flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                active
                  ? 'bg-white/[0.09] text-white/90'
                  : 'text-white/30 hover:bg-white/[0.06] hover:text-white/70',
              )}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.5} />
              {label === 'Alerts' && alertCount > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/60" />
              )}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-white/[0.08] bg-ink-900 px-2.5 py-1 text-xs text-white/70 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                {label}
              </span>
            </Link>
          );
        })}
      </aside>
    </>
  );
}
