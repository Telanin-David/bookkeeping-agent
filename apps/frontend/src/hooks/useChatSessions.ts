'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import { useChatStore } from '@/store/chat';
import { isDemoShop } from '@/lib/demo';
import type { ChatSession } from '@/types';

export function useChatSessions() {
  const qc = useQueryClient();
  const activeShop = useShopsStore((s) => s.activeShop());
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => chatApi.listSessions(),
  });

  async function createSession() {
    if (!activeShop || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const { data } = await chatApi.createSession(activeShop.id);
      qc.setQueryData<ChatSession[]>(['chat-sessions'], (old = []) => [data, ...old]);
      setActiveSessionId(data.id);
    } catch {
      // Only the demo shop falls back to a local placeholder session — a real owner must
      // never be dropped into the fake demo conversation because a request failed.
      if (!isDemoShop(activeShop.id)) {
        setCreateError("Couldn't start a chat. Check your connection and try again.");
        return;
      }
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

  return { sessions, isLoading, creating, createError, createSession };
}
