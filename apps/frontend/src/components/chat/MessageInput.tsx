'use client';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUp, Camera, FileArrowUp, Image as ImageIcon, Microphone, Plus, X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useImportsStore } from '@/store/imports';

export interface Attachment {
  file: File;
  url: string;
}

interface MessageInputProps {
  onSend: (content: string, attachments: Attachment[]) => Promise<void>;
  disabled?: boolean;
}

const iconBtn =
  'flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition duration-150 hover:bg-white/[0.07] hover:text-white/90 active:scale-[0.92] disabled:opacity-30';

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const router = useRouter();
  const setPendingFile = useImportsStore((s) => s.setPendingFile);

  const [value, setValue]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError]             = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef   = useRef<HTMLInputElement>(null);
  const galleryRef  = useRef<HTMLInputElement>(null);
  const importRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: globalThis.KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const hasText = value.trim().length > 0;
  const canSend = hasText || attachments.length > 0;
  const busy = disabled || loading;

  async function submit() {
    if (!canSend || loading) return;
    setLoading(true);
    setError('');
    try {
      await onSend(value.trim(), attachments);
      setValue('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message failed to send.');
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

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function pick(ref: React.RefObject<HTMLInputElement>) {
    setMenuOpen(false);
    ref.current?.click();
  }

  function onPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError('');
    setAttachments((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function removeAttachment(url: string) {
    URL.revokeObjectURL(url);
    setAttachments((prev) => prev.filter((a) => a.url !== url));
    setError('');
  }

  function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    router.push('/imports');
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotos} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onPhotos} />
      <input ref={importRef}  type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onImportFile} />

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />}

      <div className={cn(
        'relative rounded-[28px] glass-elevated px-2 pb-2 pt-2 transition-colors focus-within:border-white/20',
        menuOpen && 'z-30',
      )}>

        {/* ── Plus menu ── */}
        <div
          className={cn(
            'absolute bottom-[calc(100%+10px)] left-0 z-30 w-[244px] origin-bottom-left rounded-[22px] glass-menu p-1.5 transition duration-150 ease-out',
            menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-[0.96] opacity-0',
          )}
          role="menu"
        >
          <AttachRow Icon={Camera}      label="Take photo"   onClick={() => pick(cameraRef)} />
          <AttachRow Icon={ImageIcon}   label="Choose photo" onClick={() => pick(galleryRef)} />
          <div className="mx-3 my-1.5 h-px bg-white/[0.07]" />
          <AttachRow Icon={FileArrowUp} label="Import data"  hint="CSV or Excel" onClick={() => pick(importRef)} />
        </div>

        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-1.5 pb-2 pt-1">
            {attachments.map((a) => (
              <div key={a.url} className="relative h-16 w-16 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.file.name} className="h-full w-full rounded-2xl object-cover ring-1 ring-inset ring-white/10" />
                <button
                  onClick={() => removeAttachment(a.url)}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-white/80 ring-1 ring-white/15 transition hover:text-white"
                  aria-label={`Remove ${a.file.name}`}
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 16px text stops iOS Safari from zooming in on focus */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Ask your bookkeeper…"
          disabled={busy}
          className="block w-full resize-none bg-transparent px-3 py-1.5 text-base leading-6 text-white/90 placeholder:text-white/35 focus:outline-none disabled:opacity-40"
          style={{ minHeight: '36px', maxHeight: '160px' }}
        />

        {error && <p className="px-3 pb-1 pt-0.5 text-[13px] text-white/50">{error}</p>}

        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(iconBtn, 'ring-1 ring-inset ring-white/[0.10]', menuOpen && 'bg-white/[0.08] text-white/90')}
            aria-label="Add photos or files"
            aria-expanded={menuOpen}
          >
            <Plus size={20} className={cn('transition-transform duration-200', menuOpen && 'rotate-45')} />
          </button>

          {canSend ? (
            <button
              onClick={submit}
              disabled={busy}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-950 shadow-[0_2px_12px_rgba(255,255,255,0.12)] transition duration-150 hover:bg-white active:scale-[0.92] disabled:opacity-40"
              aria-label="Send"
            >
              {loading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <ArrowUp size={19} weight="bold" />}
            </button>
          ) : (
            <button type="button" disabled={busy} className={iconBtn} aria-label="Record voice">
              <Microphone size={22} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachRow({ Icon, label, hint, onClick }: {
  Icon: typeof Camera; label: string; hint?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-white/[0.06]"
      role="menuitem"
    >
      <Icon size={20} className="shrink-0 text-white/55" />
      <span className="flex-1 text-[15px] text-white/80">{label}</span>
      {hint && <span className="text-[12px] text-white/35">{hint}</span>}
    </button>
  );
}
