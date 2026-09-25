'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import Spinner from '@/components/ui/Spinner';
import type { ChatMessage } from '@/types';

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'demo-1',
    sessionId: 'demo-session-1',
    role: 'assistant',
    type: 'text',
    content: 'Hello! I\'m your bookkeeping agent. I can help you track expenses, analyse your cash flow, and answer any questions about your finances. What would you like to know?',
    createdAt: new Date(Date.now() - 60000 * 5).toISOString(),
  },
  {
    id: 'demo-2',
    sessionId: 'demo-session-1',
    role: 'user',
    type: 'text',
    content: 'What were my total expenses last month?',
    createdAt: new Date(Date.now() - 60000 * 4).toISOString(),
  },
  {
    id: 'demo-3',
    sessionId: 'demo-session-1',
    role: 'assistant',
    type: 'text',
    content: 'Last month your total expenses were ₦284,500. Your top categories were inventory restocking (₦140,000), staff wages (₦80,000), and rent (₦45,000). Would you like a detailed breakdown?',
    createdAt: new Date(Date.now() - 60000 * 3).toISOString(),
  },
  {
    id: 'demo-4',
    sessionId: 'demo-session-1',
    role: 'user',
    type: 'text',
    content: 'Yes, show me the breakdown.',
    createdAt: new Date(Date.now() - 60000 * 2).toISOString(),
  },
  {
    id: 'demo-5',
    sessionId: 'demo-session-1',
    role: 'assistant',
    type: 'text',
    content: 'Here\'s your expense breakdown for last month:\n\n• Inventory — ₦140,000 (49%)\n• Staff wages — ₦80,000 (28%)\n• Rent — ₦45,000 (16%)\n• Utilities — ₦12,000 (4%)\n• Misc — ₦7,500 (3%)\n\nCompared to the previous month, total expenses are up 8%. The increase is mainly from inventory.',
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
];

interface ChatWindowProps {
  sessionId: string;
}

export default function ChatWindow({ sessionId }: ChatWindowProps) {
  const qc = useQueryClient();
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const isDemo = sessionId === 'demo-session-1';

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: () => isDemo
      ? Promise.resolve(DEMO_MESSAGES)
      : chatApi.listMessages(sessionId).then((r) => r.data),
  });

  async function handleSend(content: string) {
    if (isDemo) {
      const userMsg: ChatMessage = {
        id: `demo-tmp-${Date.now()}`,
        sessionId,
        role: 'user',
        type: 'text',
        content,
        createdAt: new Date().toISOString(),
      };
      const reply: ChatMessage = {
        id: `demo-reply-${Date.now()}`,
        sessionId,
        role: 'assistant',
        type: 'text',
        content: 'This is a demo — connect to the backend to get real AI responses. Your message: "' + content + '"',
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessage[]>(['chat-messages', sessionId], (old = []) => [...old, userMsg, reply]);
      return;
    }

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
