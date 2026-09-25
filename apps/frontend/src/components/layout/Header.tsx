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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-ink-950/60 px-5 backdrop-blur-lg md:px-6">
      {/* Left: active shop pill */}
      <div className="flex items-center gap-2">
        {active && (
          <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/8 hover:text-white">
            {active.name}
            <ChevronDown size={13} className="text-white/40" />
          </button>
        )}
      </div>

      {/* Right: user + sign out */}
      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden text-sm text-white/50 sm:block">{user.name}</span>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
