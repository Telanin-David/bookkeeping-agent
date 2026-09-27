import type { ReactNode } from 'react';

/** The frame around the sign-in screens: the app's name, a line under it, then the form. */
export default function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-ink-950 px-4">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.025] blur-3xl" />
      <div className="glass-card anim-page relative w-full max-w-sm rounded-2xl p-7 sm:p-8">
        <div className="mb-7">
          <p className="text-lg font-bold tracking-tight text-white/85">Bookkeeping AI</p>
          <p className="mt-0.5 text-[13px] text-white/40">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
