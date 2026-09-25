import { useEffect, useRef } from 'react';
import ReceiptCard from '@/components/receipts/ReceiptCard';
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
    <div className="flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_32px)]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-6 pt-6">
        {messages.map((msg) =>
          msg.role === 'user' && msg.type === 'image' && msg.mediaUrl ? (
            <div key={msg.id} className="flex justify-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={msg.mediaUrl} alt="Attached photo" className="max-h-64 max-w-[70%] rounded-3xl object-cover ring-1 ring-inset ring-white/10" />
            </div>
          ) : msg.role === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-3xl bg-white/[0.08] px-4 py-2.5 text-[15px] leading-6 text-white/90 ring-1 ring-inset ring-white/[0.07]">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={msg.id}>
              <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-white/80">{msg.content}</div>
              {msg.receiptTransactionId && <ReceiptCard transactionId={msg.receiptTransactionId} />}
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
