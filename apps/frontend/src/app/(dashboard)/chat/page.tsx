'use client';
import { useEffect } from 'react';
import { useShopsStore } from '@/store/shops';
import { useChatStore } from '@/store/chat';
import { useChatSessions } from '@/hooks/useChatSessions';
import ChatWindow from '@/components/chat/ChatWindow';
import Spinner from '@/components/ui/Spinner';

export default function ChatPage() {
  const activeShop = useShopsStore((s) => s.activeShop());
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const { sessions, isLoading, creating, createError, createSession } = useChatSessions();

  useEffect(() => {
    if (isLoading || activeSessionId) return;
    if (sessions.length > 0) setActiveSessionId(sessions[0].id);
    else if (activeShop) createSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sessions, activeShop, activeSessionId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {creating || isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-5 w-5 text-white/20" />
        </div>
      ) : activeSessionId ? (
        <ChatWindow key={activeSessionId} sessionId={activeSessionId} />
      ) : createError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[15px] text-white/60">{createError}</p>
          <button
            onClick={() => createSession()}
            className="h-10 rounded-full bg-white/[0.08] px-5 text-[14px] font-medium text-white/85 ring-1 ring-inset ring-white/[0.1] transition hover:bg-white/[0.12]"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
