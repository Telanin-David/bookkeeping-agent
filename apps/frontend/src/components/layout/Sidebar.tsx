'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAlertsStore } from '@/store/alerts';

const NAV = [
  { href: '/',             label: 'Dashboard',     icon: '⊞' },
  { href: '/transactions', label: 'Transactions',  icon: '↕' },
  { href: '/chat',         label: 'Chat',           icon: '💬' },
  { href: '/reports',      label: 'Reports',        icon: '📄' },
  { href: '/alerts',       label: 'Alerts',         icon: '🔔' },
  { href: '/imports',      label: 'Import Excel',   icon: '📥' },
  { href: '/shops',        label: 'Shops',          icon: '🏪' },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const alertCount = useAlertsStore((s) => s.activeCount);

  return (
    <aside className="flex h-full w-56 flex-col bg-brand-900 text-white">
      <div className="px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-100/60">Bookkeeping</p>
        <p className="mt-0.5 text-lg font-bold">Agent</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-brand-100/70 hover:bg-white/5 hover:text-white',
              )}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
              {label === 'Alerts' && alertCount > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold">
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
