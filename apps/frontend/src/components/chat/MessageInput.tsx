'use client';
import { useState, useRef, type KeyboardEvent } from 'react';
import { ArrowUp, Mic, Paperclip } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await onSend(trimmed);
      setValue('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  const hasText = value.trim().length > 0;

  return (
    <div className="border-t border-white/[0.06] bg-ink-950/70 px-3 pb-4 pt-3 backdrop-blur-xl">
      {/* Input row */}
      <div className="flex items-end gap-2 glass-elevated rounded-2xl px-3 py-2">

        {/* Attachment */}
        <button
          type="button"
          disabled={disabled || loading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white/65 disabled:opacity-30 mb-0.5"
          aria-label="Attach file"
        >
          <Paperclip size={17} />
        </button>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={autoResize}
          onKeyDown={onKeyDown}
          placeholder="Message your bookkeeping agent…"
          disabled={disabled || loading}
          className="flex-1 resize-none bg-transparent py-1.5 text-sm text-white/80 placeholder:text-white/25 focus:outline-none disabled:opacity-40 leading-relaxed"
          style={{ minHeight: '36px', maxHeight: '140px' }}
        />

        {/* Voice or Send */}
        {hasText ? (
          <button
            onClick={submit}
            disabled={disabled || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl btn-primary transition-all disabled:opacity-30 mb-0.5"
            aria-label="Send"
          >
            {loading
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              : <ArrowUp size={15} />
            }
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white/65 disabled:opacity-30 mb-0.5"
            aria-label="Voice input"
          >
            <Mic size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
