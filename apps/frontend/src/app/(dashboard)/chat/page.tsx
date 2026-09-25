'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import ChatWindow from '@/components/chat/ChatWindow';
import PageWrapper from '@/components/layout/PageWrapper';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/utils';
import type { ChatSession } from '@/types';

export default function ChatPage() {
  const activeShop = useShopsStore((s) => s.activeShop());
  const qc = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => chatApi.listSessions().then((r) => r.data),
  });

  async function createSession() {
    if (!activeShop) return;
    const { data } = await chatApi.createSession(activeShop.id);
    qc.setQueryData<ChatSession[]>(['chat-sessions'], (old = []) => [data, ...old]);
    setActiveSessionId(data.id);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Session list */}
      <aside className="w-56 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-3">
          <Button size="sm" className="w-full" onClick={createSession}>+ New chat</Button>
        </div>
        {isLoading && <div className="p-3"><Spinner className="h-4 w-4" /></div>}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${activeSessionId === s.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}
          >
            {formatDateTime(s.lastMessageAt)}
          </button>
        ))}
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          <ChatWindow sessionId={activeSessionId} />
        ) : (
          <PageWrapper title="Chat with your bookkeeping agent">
            <p className="text-sm text-gray-500">Start a new chat or select an existing session to ask about your finances.</p>
          </PageWrapper>
        )}
      </div>
    </div>
  );
}
