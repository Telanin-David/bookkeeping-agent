import Link from 'next/link';
import { LockSimple } from '@phosphor-icons/react';

/**
 * In place of a feature the owner's plan doesn't include: what it is, what's still free,
 * and the way to the Plan screen. Never a dead end.
 */
export default function Locked({ title, text, compact }: { title: string; text: string; compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/[0.07]' : 'glass-card flex items-start gap-3 rounded-2xl p-5'}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/70">
        <LockSimple size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-white/85">{title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-white/55">{text}</p>
        <Link
          href="/billing"
          className="mt-3 inline-flex h-10 items-center rounded-full bg-white/[0.1] px-4 text-[14px] font-medium text-white/90 ring-1 ring-inset ring-white/[0.12] transition hover:bg-white/[0.15]"
        >
          See plans
        </Link>
      </div>
    </div>
  );
}
