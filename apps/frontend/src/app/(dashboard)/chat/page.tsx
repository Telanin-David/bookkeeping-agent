'use client';
import { useEffect } from 'react';
import { useShopsStore } from '@/store/shops';
import { useChatStore } from '@/store/chat';
import { useChatSessions } from '@/hooks/useChatSessions';
import ChatWindow from '@/components/chat/ChatWindow';
import Spinner from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/utils';

export default function ChatPage() {
  const activeShop = useShopsStore((s) => s.activeShop());
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const { sessions, isLoading, creating, createSession } = useChatSessions();

  useEffect(() => {
    if (isLoading || activeSessionId) return;
    if (sessions.length > 0) setActiveSessionId(sessions[0].id);
    else if (activeShop) createSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sessions, activeShop, activeSessionId]);

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Session history — desktop only; mobile gets it from the hamburger menu */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/60 overflow-y-auto">
        <div className="p-3 border-b border-white/[0.06]">
          <button
            onClick={createSession}
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-xl btn-primary px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            + New chat
          </button>
        </div>
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Spinner className="h-4 w-4 text-white/20" />
          </div>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={`w-full text-left px-4 py-3 text-sm border-b border-white/[0.04] transition-colors ${
              activeSessionId === s.id
                ? 'bg-white/[0.07] text-white/85 font-medium'
                : 'text-white/40 hover:bg-white/[0.04] hover:text-white/65'
            }`}
          >
            {formatDateTime(s.lastMessageAt)}
          </button>
        ))}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {creating || isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-5 w-5 text-white/20" />
          </div>
        ) : activeSessionId ? (
          <ChatWindow key={activeSessionId} sessionId={activeSessionId} />
        ) : null}
      </div>

    </div>
  );
}
