'use client';
import { useState, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await onSend(trimmed);
      setValue('');
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

  return (
    <div className="flex items-end gap-2 border-t border-white/[0.06] bg-ink-950/60 p-4 backdrop-blur-xl">
      <textarea
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about your finances… (Enter to send)"
        disabled={disabled || loading}
        className="glass-input flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm disabled:opacity-40"
      />
      <button
        onClick={submit}
        disabled={disabled || loading || !value.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl btn-primary transition-all disabled:opacity-25"
        aria-label="Send"
      >
        {loading
          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          : <ArrowUp size={15} />
        }
      </button>
    </div>
  );
}
