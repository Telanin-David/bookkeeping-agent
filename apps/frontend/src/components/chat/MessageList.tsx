import { useEffect, useRef } from 'react';
import Image from 'next/image';
import ReceiptCard from '@/components/receipts/ReceiptCard';
import BrandLogo from '@/components/brand/BrandLogo';
import tile from '@/assets/brand/sabeebook-tile.png';
import type { ChatMessage } from '@/types';

interface MessageListProps {
  messages: ChatMessage[];
  /** A message is on its way to the assistant: show the bee "typing". */
  thinking?: boolean;
}

/** The assistant's face: the bee tile from the brand sheet. */
function Bee() {
  return <Image src={tile} alt="" width={30} height={30} className="mt-0.5 h-[30px] w-[30px] shrink-0 select-none" />;
}

export default function MessageList({ messages, thinking }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  if (messages.length === 0 && !thinking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <BrandLogo variant="bee" className="w-[96px]" />
        <p className="mt-5 text-[17px] font-medium text-white/85">What did you sell today?</p>
        <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-white/45">
          Tell me in your own words, like &ldquo;I sold 2 crates of Coke for ₦7,000&rdquo;, and I&apos;ll record it.
        </p>
      </div>
    );
  }

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
            <div key={msg.id} className="flex gap-3">
              <Bee />
              <div className="min-w-0 flex-1">
                <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-white/80">{msg.content}</div>
                {msg.receiptTransactionId && <ReceiptCard transactionId={msg.receiptTransactionId} />}
              </div>
            </div>
          ),
        )}
        {thinking && (
          <div className="flex items-center gap-3" role="status" aria-label="The assistant is replying">
            <Bee />
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-yellow" style={{ animationDelay: `${i * 180}ms` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
