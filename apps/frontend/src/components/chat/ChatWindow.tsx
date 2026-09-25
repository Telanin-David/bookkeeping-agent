'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import Spinner from '@/components/ui/Spinner';
import type { ChatMessage } from '@/types';

interface ChatWindowProps {
  sessionId: string;
}

export default function ChatWindow({ sessionId }: ChatWindowProps) {
  const qc = useQueryClient();
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: () => chatApi.listMessages(sessionId).then((r) => r.data),
  });

  async function handleSend(content: string) {
    const tempId = `tmp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId, sessionId, role: 'user', type: 'text', content,
      createdAt: new Date().toISOString(),
    };
    setOptimistic((prev) => [...prev, userMsg]);

    try {
      const { data } = await chatApi.sendMessage(sessionId, content);
      setOptimistic([]);
      qc.setQueryData<ChatMessage[]>(['chat-messages', sessionId], (old = []) => [
        ...old, data.userMessage, data.assistantMessage,
      ]);
    } catch {
      setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  if (isLoading) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList messages={[...messages, ...optimistic]} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
