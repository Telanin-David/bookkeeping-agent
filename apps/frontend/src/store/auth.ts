import { create } from 'zustand';
import { setAccessToken, clearAccessToken } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useShopsStore } from '@/store/shops';
import { useChatStore } from '@/store/chat';
import { useAlertsStore } from '@/store/alerts';
import { DEMO_USER_ID } from '@/lib/demo';
import type { User } from '@/types';

// Not the session itself (that's the httpOnly refresh cookie, which only the API sees), just
// a hint for src/proxy.ts: a device that was signed in skips the home page and opens the app.
const SIGNED_IN_HINT = 'sb_signed_in';
function setSignedInHint(on: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${SIGNED_IN_HINT}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    : `${SIGNED_IN_HINT}=; path=/; max-age=0; samesite=lax`;
}

// 'loading' until the app has asked the server whether this device is still signed in
// (see AuthBootstrap). Guards must wait for it, or a page reload bounces to /login.
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  isAuthenticated: false,

  setAuth: (user, token) => {
    setAccessToken(token);
    // The demo account isn't a real session: don't send its next visit past the home page.
    setSignedInHint(user.id !== DEMO_USER_ID);
    set({ user, status: 'authenticated', isAuthenticated: true });
  },

  // Signing out (or a session expiring) wipes everything cached about this owner —
  // shops are persisted in localStorage, so a shared shop phone would otherwise show
  // the previous owner's shops and data to whoever signs in next.
  clearAuth: () => {
    clearAccessToken();
    setSignedInHint(false);
    queryClient.clear();
    useShopsStore.setState({ shops: [], activeShopId: null });
    useChatStore.getState().setActiveSessionId(null);
    useAlertsStore.getState().setActiveCount(0);
    set({ user: null, status: 'anonymous', isAuthenticated: false });
  },
}));
