'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  async function login(email: string, password: string) {
    const { data } = await authApi.login({ email, password });
    setAuth(data.user, data.accessToken);
    router.push('/');
  }

  async function signup(name: string, email: string, password: string, phone?: string) {
    const { data } = await authApi.signup({ name, email, password, phone });
    setAuth(data.user, data.accessToken);
    router.push('/');
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    clearAuth();
    router.push('/login');
  }

  return { user, isAuthenticated, login, signup, logout };
}
