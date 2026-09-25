'use client';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const user   = useAuthStore((s) => s.user);
  const active = useShopsStore((s) => s.activeShop());
  const { logout } = useAuth();

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-white/[0.06] bg-ink-950/60 px-5 backdrop-blur-xl md:px-6">
      {/* Active shop pill */}
      <div className="flex items-center gap-2 pl-10 md:pl-0">
        {active && (
          <span className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-white/65">
            {active.name}
          </span>
        )}
      </div>

      {/* User + sign out */}
      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden text-sm text-white/40 sm:block">{user.name}</span>
        )}
        <button
          onClick={logout}
          title="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-white/50 transition hover:bg-white/[0.09] hover:text-white/80"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
