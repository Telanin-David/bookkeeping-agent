'use client';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const user   = useAuthStore((s) => s.user);
  const active = useShopsStore((s) => s.activeShop());
  const { logout } = useAuth();

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-white/[0.06] bg-ink-950/70 px-4 backdrop-blur-xl md:px-5">
      {/* Left: shop selector — spacer on mobile for hamburger */}
      <div className="flex items-center gap-2 pl-10 md:pl-0">
        {active && (
          <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white/90">
            {active.name}
            <ChevronDown size={11} className="text-white/30" />
          </button>
        )}
      </div>

      {/* Right: user + sign out */}
      <div className="flex items-center gap-2">
        {user && (
          <span className="hidden text-xs text-white/35 sm:block">{user.name}</span>
        )}
        <button
          onClick={logout}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-white/70"
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
