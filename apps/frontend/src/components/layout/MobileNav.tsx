'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X, SquaresFour, ArrowsLeftRight, ChartBar, Bell,
  Storefront, SignOut, DotsThree, NotePencil, CaretRight, Stamp,
} from '@phosphor-icons/react';
import { MenuIcon } from '@/components/ui/icons';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { useAlertsStore } from '@/store/alerts';
import { useChatStore } from '@/store/chat';

const PAGES = [
  { href: '/',             label: 'Dashboard',    Icon: SquaresFour },
  { href: '/transactions', label: 'Transactions', Icon: ArrowsLeftRight },
  { href: '/reports',      label: 'Reports',      Icon: ChartBar },
  { href: '/alerts',       label: 'Alerts',       Icon: Bell },
];

const circleBtn =
  'flex h-11 w-11 items-center justify-center rounded-full glass-elevated text-white/70 transition duration-150 active:scale-[0.94] hover:text-white';

export default function MobileNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const alertCount = useAlertsStore((s) => s.activeCount);
  const user       = useAuthStore((s) => s.user);
  const shop       = useShopsStore((s) => s.activeShop());
  const activeSessionId    = useChatStore((s) => s.activeSessionId);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const { sessions, createSession } = useChatSessions();
  const { logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  function closeAll() { setMenuOpen(false); setMoreOpen(false); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeAll(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function newChat() {
    closeAll();
    await createSession();
    router.push('/chat');
  }

  function openChat(id: string) {
    closeAll();
    setActiveSessionId(id);
    router.push('/chat');
  }

  const initial = (user?.name ?? 'U').charAt(0).toUpperCase();

  return (
    <>
      {/* ── Top controls ── */}
      <div className="relative z-30 flex items-center justify-between px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={() => { setMoreOpen(false); setMenuOpen(true); }}
          className={circleBtn}
          aria-label="Open menu"
        >
          <MenuIcon size={21} />
        </button>

        <div className="relative">
          <button
            onClick={() => { setMenuOpen(false); setMoreOpen((v) => !v); }}
            className={cn(circleBtn, moreOpen && 'text-white')}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <DotsThree size={22} weight="bold" />
          </button>

          {/* ── Three-dots card ── */}
          <div
            className={cn(
              'absolute right-0 top-[calc(100%+10px)] z-50 w-[252px] origin-top-right rounded-[22px] glass-menu p-1.5 transition duration-150 ease-out',
              moreOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-[0.96] opacity-0',
            )}
            role="menu"
          >
            {shop && (
              <Link
                href="/shops"
                onClick={closeAll}
                className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition hover:bg-white/[0.06]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/[0.08]">
                  <Storefront size={19} className="text-white/70" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-white/90">{shop.name}</span>
                  <span className="mt-0.5 block text-[13px] capitalize text-white/40">{shop.type} · {shop.currency}</span>
                </span>
                <CaretRight size={14} className="shrink-0 text-white/30" />
              </Link>
            )}

            <div className="mx-3 my-1.5 h-px bg-white/[0.07]" />

            <MenuRow href="/shops" Icon={Storefront} label="Manage shops" onClick={closeAll} />
            <MenuRow href="/shops/branding" Icon={Stamp} label="Receipt branding" onClick={closeAll} />

            <div className="mx-3 my-1.5 h-px bg-white/[0.07]" />

            <button
              onClick={() => { closeAll(); logout(); }}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-white/60 transition hover:bg-white/[0.06] hover:text-white/90"
            >
              <SignOut size={19} className="shrink-0 text-white/45" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* ── Backdrops ── */}
      {moreOpen && <div className="fixed inset-0 z-20" onClick={closeAll} />}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300',
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeAll}
      />

      {/* ── Hamburger drawer ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[84%] max-w-[330px] flex-col rounded-r-[28px] glass-menu transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          menuOpen ? 'translate-x-0' : '-translate-x-[calc(100%+80px)]',
        )}
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <p className="font-display text-[21px] font-semibold tracking-[-0.03em] text-white/90">Bookkeeping AI</p>
          <button
            onClick={closeAll}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/55 transition hover:text-white/90"
            aria-label="Close menu"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={newChat}
            className="flex h-12 w-full items-center gap-3 rounded-2xl bg-white/[0.08] px-3.5 text-[15px] font-medium text-white/90 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.11] active:scale-[0.99]"
          >
            <NotePencil size={20} className="shrink-0" />
            New chat
          </button>
        </div>

        <nav className="mt-3 px-3">
          {PAGES.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeAll}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] transition',
                  active ? 'bg-white/[0.07] text-white' : 'text-white/65 hover:bg-white/[0.05] hover:text-white/90',
                )}
              >
                <Icon size={20} weight={active ? 'fill' : 'regular'} className={cn('shrink-0', active ? 'text-white/85' : 'text-white/45')} />
                <span className="flex-1">{label}</span>
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.10] px-1.5 text-[11px] font-medium tabular-nums text-white/70">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <p className="mt-6 px-6 pb-2 text-[13px] font-medium text-white/35">Recents</p>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 ? (
            <p className="px-3.5 py-2 text-[15px] text-white/30">No chats yet</p>
          ) : sessions.map((s) => {
            const active = pathname.startsWith('/chat') && s.id === activeSessionId;
            return (
              <button
                key={s.id}
                onClick={() => openChat(s.id)}
                className={cn(
                  'flex h-11 w-full items-center rounded-xl px-3.5 text-left text-[15px] transition',
                  active ? 'bg-white/[0.07] text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white/90',
                )}
              >
                <span className="truncate">{formatDateTime(s.lastMessageAt)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.06] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.09] font-display text-[15px] font-semibold text-white/80 ring-1 ring-inset ring-white/[0.08]">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium text-white/85">{user?.name}</span>
            <span className="block truncate text-[13px] text-white/40">{user?.email}</span>
          </span>
        </div>
      </aside>
    </>
  );
}

function MenuRow({ href, Icon, label, onClick }: {
  href: string; Icon: typeof Storefront; label: string; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-white/75 transition hover:bg-white/[0.06] hover:text-white"
    >
      <Icon size={19} className="shrink-0 text-white/50" />
      {label}
    </Link>
  );
}
