'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SquaresFour, ArrowsLeftRight, ChatCircle,
  ChartBar, Bell, UploadSimple, Storefront, NotePencil,
} from '@phosphor-icons/react';
import { cn, formatDateTime } from '@/lib/utils';
import { useAlertsStore } from '@/store/alerts';
import { useChatStore } from '@/store/chat';
import { useChatSessions } from '@/hooks/useChatSessions';

const NAV = [
  { href: '/',             label: 'Dashboard',    Icon: SquaresFour },
  { href: '/transactions', label: 'Transactions', Icon: ArrowsLeftRight },
  { href: '/chat',         label: 'Chat',          Icon: ChatCircle },
  { href: '/reports',      label: 'Reports',       Icon: ChartBar },
  { href: '/alerts',       label: 'Alerts',        Icon: Bell },
  { href: '/imports',      label: 'Import',        Icon: UploadSimple },
  { href: '/shops',        label: 'Shops',         Icon: Storefront },
];

export default function Sidebar() {
  const pathname   = usePathname();
  const router     = useRouter();
  const alertCount = useAlertsStore((s) => s.activeCount);
  const activeSessionId    = useChatStore((s) => s.activeSessionId);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const { sessions, createSession } = useChatSessions();

  async function newChat() {
    await createSession();
    router.push('/chat');
  }

  function openChat(id: string) {
    setActiveSessionId(id);
    router.push('/chat');
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-white/[0.07] bg-ink-950/90 backdrop-blur-2xl">
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/[0.06]">
        <p className="text-base font-bold tracking-tight text-white/85">Bookkeeping</p>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 self-end pb-0.5">AI</span>
      </div>

      <nav className="shrink-0 space-y-0.5 px-2 py-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'glass-elevated text-white/90'
                  : 'text-white/45 hover:bg-white/[0.05] hover:text-white/75',
              )}
            >
              <Icon
                size={17}
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

      {/* Recent chats live here instead of a separate column, so the chat page isn't three panels deep */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-white/[0.06] pt-2">
        <button
          onClick={newChat}
          className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white/75"
        >
          <NotePencil size={16} className="shrink-0 text-white/35" />
          New chat
        </button>

        <p className="px-5 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-widest text-white/25">Recents</p>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="px-3 py-1.5 text-[13px] text-white/25">No chats yet</p>
          ) : sessions.map((s) => {
            const active = pathname.startsWith('/chat') && s.id === activeSessionId;
            return (
              <button
                key={s.id}
                onClick={() => openChat(s.id)}
                className={cn(
                  'block w-full truncate rounded-xl px-3 py-2 text-left text-[13px] transition',
                  active ? 'bg-white/[0.07] text-white/85' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70',
                )}
              >
                {formatDateTime(s.lastMessageAt)}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
