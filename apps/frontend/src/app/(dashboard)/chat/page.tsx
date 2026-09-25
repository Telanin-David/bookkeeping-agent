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
  const { sessions, isLoading, creating, createSession } = useChatSessions();

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
      ) : null}
    </div>
  );
}
