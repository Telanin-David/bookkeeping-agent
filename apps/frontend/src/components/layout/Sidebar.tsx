'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ArrowLeftRight, MessageSquare,
  BarChart2, Bell, Upload, Store,
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
  const navItems = (
    <nav className="flex-1 space-y-0.5 px-2 py-2">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => {}}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
              active
                ? 'glass-elevated text-white/90'
                : 'text-white/45 hover:bg-white/[0.05] hover:text-white/75',
            )}
          >
            <Icon
              size={16}
              className={cn(
                'shrink-0 transition-colors',
                active ? 'text-white/80' : 'text-white/35 group-hover:text-white/60',
              )}
            />
            <span>{label}</span>
            {label === 'Alerts' && alertCount > 0 && (
              <span className="ml-auto flex h-4.5 min-w-4 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] px-1 text-[10px] font-bold text-white/60">
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
      {/* Sidebar — desktop only */}
      <aside className="flex h-full w-60 flex-col border-r border-white/[0.07] bg-ink-950/90 backdrop-blur-2xl">
        {/* Wordmark */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/[0.06]">
          <p className="text-base font-bold tracking-tight text-white/85">Bookkeeping</p>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 self-end pb-0.5">AI</span>
        </div>

        {navItems}

        <div className="h-6 bg-gradient-to-t from-ink-950/90 to-transparent" />
      </aside>
    </>
  );
}
