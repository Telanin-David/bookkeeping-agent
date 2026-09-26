import { create } from 'zustand';
import { setAccessToken, clearAccessToken } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useShopsStore } from '@/store/shops';
import { useChatStore } from '@/store/chat';
import { useAlertsStore } from '@/store/alerts';
import type { User } from '@/types';

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
    set({ user, status: 'authenticated', isAuthenticated: true });
  },

  // Signing out (or a session expiring) wipes everything cached about this owner —
  // shops are persisted in localStorage, so a shared shop phone would otherwise show
  // the previous owner's shops and data to whoever signs in next.
  clearAuth: () => {
    clearAccessToken();
    queryClient.clear();
    useShopsStore.setState({ shops: [], activeShopId: null });
    useChatStore.getState().setActiveSessionId(null);
    useAlertsStore.getState().setActiveCount(0);
    set({ user: null, status: 'anonymous', isAuthenticated: false });
  },
}));
