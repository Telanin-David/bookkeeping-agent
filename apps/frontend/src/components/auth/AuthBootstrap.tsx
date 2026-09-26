'use client';
import { useEffect } from 'react';
import { refreshSession, setSessionExpiredHandler } from '@/lib/api';
import { DEMO_USER_ID } from '@/lib/demo';
import { useAuthStore } from '@/store/auth';

/**
 * The access token lives only in memory, so every page load starts signed out. This asks
 * the server once, on load, whether the device's refresh cookie is still valid, and
 * restores the session if so. Until it answers, auth status stays 'loading'.
 */
export default function AuthBootstrap() {
  useEffect(() => {
    setSessionExpiredHandler(() => {
      // The demo account has no real session to expire; its API calls are never sent.
      if (useAuthStore.getState().user?.id === DEMO_USER_ID) return;
      useAuthStore.getState().clearAuth();
    });

    let cancelled = false;
    refreshSession()
      .then(({ user, accessToken }) => {
        // Only settle a still-pending check: the owner may have logged in or opened
        // the demo while this request was in flight.
        if (!cancelled && useAuthStore.getState().status === 'loading') {
          useAuthStore.getState().setAuth(user, accessToken);
        }
      })
      .catch(() => {
        if (!cancelled && useAuthStore.getState().status === 'loading') {
          useAuthStore.getState().clearAuth();
        }
      });
    return () => { cancelled = true; };
  }, []);

  return null;
}
