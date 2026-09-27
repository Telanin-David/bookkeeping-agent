'use client';
import Link from 'next/link';
import { Check, type Icon } from '@phosphor-icons/react';
import Modal from './Modal';
import { cn } from '@/lib/utils';

export interface SheetAction {
  label: string;
  description?: string;
  icon?: Icon;
  /** A page to open, or… */
  href?: string;
  /** …something to do. The sheet closes first either way. */
  onSelect?: () => void;
  /** Marks the current choice in a list of options. */
  selected?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: SheetAction[];
}

/** A list of choices, one under the other, opened from a single button: how phones tuck away controls. */
export default function ActionSheet({ open, onClose, title, actions }: ActionSheetProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <ul className="-mx-1.5 space-y-1">
        {actions.map((a) => {
          const body = (
            <>
              {a.icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/75">
                  <a.icon size={18} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[15px]', a.selected ? 'font-medium text-white' : 'text-white/85')}>{a.label}</span>
                {a.description && <span className="mt-0.5 block text-[13px] leading-snug text-white/45">{a.description}</span>}
              </span>
              {a.selected && <Check size={18} weight="bold" className="shrink-0 text-white/80" />}
            </>
          );
          const cls = cn(
            'flex min-h-[3.25rem] w-full items-center gap-3.5 rounded-2xl px-3 py-2 text-left transition',
            'hover:bg-white/[0.06] active:bg-white/[0.1]',
            a.selected && 'bg-white/[0.07]',
          );
          return (
            <li key={a.label}>
              {a.href
                ? <Link href={a.href} onClick={onClose} className={cls}>{body}</Link>
                : <button type="button" onClick={() => { onClose(); a.onSelect?.(); }} className={cls}>{body}</button>}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
