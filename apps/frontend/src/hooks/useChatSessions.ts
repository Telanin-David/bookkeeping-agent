'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import { useChatStore } from '@/store/chat';
import type { ChatSession } from '@/types';

export function useChatSessions() {
  const qc = useQueryClient();
  const activeShop = useShopsStore((s) => s.activeShop());
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const [creating, setCreating] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => chatApi.listSessions().then((r) => r.data),
  });

  async function createSession() {
    if (!activeShop || creating) return;
    setCreating(true);
    try {
      const { data } = await chatApi.createSession(activeShop.id);
      qc.setQueryData<ChatSession[]>(['chat-sessions'], (old = []) => [data, ...old]);
      setActiveSessionId(data.id);
    } catch {
      // No backend (demo mode): fall back to a local placeholder session.
      const now = new Date().toISOString();
      const demo: ChatSession = {
        id: 'demo-session-1', userId: 'demo-user-1', shopId: activeShop.id,
        lastMessageAt: now, createdAt: now,
      };
      qc.setQueryData<ChatSession[]>(['chat-sessions'], (old = []) =>
        old.some((s) => s.id === demo.id) ? old : [demo, ...old]);
      setActiveSessionId(demo.id);
    } finally {
      setCreating(false);
    }
  }

  return { sessions, isLoading, creating, createSession };
}
