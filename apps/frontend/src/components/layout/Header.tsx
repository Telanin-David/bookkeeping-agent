'use client';
import { useAuthStore } from '@/store/auth';
import { useShopsStore } from '@/store/shops';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';

export default function Header() {
  const user   = useAuthStore((s) => s.user);
  const active = useShopsStore((s) => s.activeShop());
  const { logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-2">
        {active && (
          <span className="rounded-md bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-700">
            {active.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-gray-600">{user.name}</span>
        )}
        <Button variant="secondary" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
