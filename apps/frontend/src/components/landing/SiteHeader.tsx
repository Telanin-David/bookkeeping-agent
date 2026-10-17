'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/brand/BrandLogo';
import HeaderActions from '@/components/landing/HeaderActions';
import { cn } from '@/lib/utils';

/** A floating bar that turns to frosted glass once the page scrolls under it. */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full pl-5 pr-2 transition-all duration-300 sm:h-[60px]',
          scrolled
            ? 'border border-white/10 bg-[#06251a]/70 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl'
            : 'border border-transparent bg-transparent',
        )}
      >
        <Link href="/" aria-label="sabeebook home" className="shrink-0 py-3">
          <BrandLogo priority className="w-[108px] sm:w-[124px]" />
        </Link>
        <nav className="hidden items-center gap-1 text-[14px] text-brand-paper/70 md:flex">
          {[['#how', 'How it works'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#questions', 'Questions']].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3.5 py-2 transition hover:bg-white/[0.07] hover:text-brand-paper">{label}</a>
          ))}
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}
