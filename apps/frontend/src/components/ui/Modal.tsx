'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

const EXIT_MS = 220;

/**
 * A panel over the page: it slides up from the bottom on a phone, like the phone's own
 * sheets, and rises into the middle on wider screens. It animates out too, showing the
 * last content it had, so callers can clear their state the moment it's closed.
 */
export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const lastChildren = useRef(children);
  if (open) lastChildren.current = children;
  const titleId = useId();

  useEffect(() => {
    if (open) { setPresent(true); setClosing(false); return; }
    if (!present) return;
    setClosing(true);
    const t = setTimeout(() => { setPresent(false); setClosing(false); }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, present]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // The page behind stays put while the panel is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [open, onClose]);

  if (!present || typeof document === 'undefined') return null;

  // Rendered at the top of the page: inside a frosted card, "fixed" would pin the panel to
  // the card instead of the screen.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className={cn('absolute inset-0 bg-black/60 backdrop-blur-[3px]', closing ? 'anim-fade-out' : 'anim-fade-in')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'glass-menu relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[28px] sm:rounded-3xl',
          closing ? 'anim-sheet-out' : 'anim-sheet-in',
          className,
        )}
      >
        {/* Grab handle, the phone's sign that this panel sits over the page. */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
          <h2 id={titleId} className="text-[17px] font-semibold text-white/90">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/55 transition hover:bg-white/[0.1] hover:text-white/90 active:scale-95"
          >
            <X size={15} weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          {open ? children : lastChildren.current}
        </div>
      </div>
    </div>,
    document.body,
  );
}
