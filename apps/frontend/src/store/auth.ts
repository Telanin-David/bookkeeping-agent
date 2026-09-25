import { create } from 'zustand';
import { setAccessToken, clearAccessToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    setAccessToken(token);
    set({ user, isAuthenticated: true });
  },

  clearAuth: () => {
    clearAccessToken();
    set({ user: null, isAuthenticated: false });
  },
}));
