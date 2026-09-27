import Link from 'next/link';

// Any address that doesn't exist, in the app's own style (Next.js's default is a white page).
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 text-center">
      <p className="text-sm font-medium tabular-nums text-white/35">404</p>
      <h1 className="mt-2 text-xl font-semibold text-white/85">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-xs text-[14px] text-white/50">Check the address, or go back to your shop.</p>
      <Link href="/" className="mt-6 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.1]">
        Go to my shop
      </Link>
    </main>
  );
}
