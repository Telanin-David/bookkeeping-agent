import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
          <div className={cn(
            'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            msg.role === 'user'
              ? 'glass-elevated text-white/85'
              : 'glass text-white/70',
          )}>
            {msg.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
