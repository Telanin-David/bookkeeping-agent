'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import ChatWindow from '@/components/chat/ChatWindow';
import Spinner from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/utils';
import type { ChatSession } from '@/types';
import { Plus, MessageSquare } from 'lucide-react';

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

      {/* Session list — desktop only */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/60 overflow-y-auto">
        <div className="p-3 border-b border-white/[0.06]">
          <button
            onClick={createSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl btn-primary px-3 py-2 text-sm font-medium"
          >
            <Plus size={14} />
            New chat
          </button>
        </div>
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Spinner className="h-4 w-4 text-white/20" />
          </div>
        )}
        {sessions.length === 0 && !isLoading && (
          <p className="px-4 py-6 text-xs text-white/25 text-center">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/[0.04] ${
              activeSessionId === s.id
                ? 'bg-white/[0.07] text-white/85 font-medium'
                : 'text-white/40 hover:bg-white/[0.04] hover:text-white/65'
            }`}
          >
            {formatDateTime(s.lastMessageAt)}
          </button>
        ))}
      </aside>

      {/* Chat area — full width on mobile */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          <ChatWindow sessionId={activeSessionId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass">
              <MessageSquare size={24} className="text-white/35" />
            </div>
            <div>
              <p className="text-base font-semibold text-white/75">Chat with your bookkeeping agent</p>
              <p className="mt-1.5 text-sm text-white/35">Ask about your finances, transactions, or reports.</p>
            </div>
            <button
              onClick={createSession}
              className="flex items-center gap-2 rounded-xl btn-primary px-5 py-2.5 text-sm font-medium"
            >
              <Plus size={15} />
              Start a new chat
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
