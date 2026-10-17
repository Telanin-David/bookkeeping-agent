import Image, { type StaticImageData } from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Device frames for the home page. What's inside them is never drawn: it's a screenshot of
 * the real app (a sample shop), so the page shows exactly what an owner will get.
 */

/** A phone with a status bar above the app, like the app looks when added to the home screen. */
export function Phone({ src, alt, className, priority, time = '10:47' }: {
  src: StaticImageData; alt: string; className?: string; priority?: boolean; time?: string;
}) {
  return (
    <div className={cn('relative rounded-[3rem] bg-[#1c1d1c] p-[10px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset]', className)}>
      {/* Side buttons */}
      <span aria-hidden className="absolute -left-[3px] top-[22%] h-12 w-[3px] rounded-l bg-[#2a2b2a]" />
      <span aria-hidden className="absolute -right-[3px] top-[28%] h-20 w-[3px] rounded-r bg-[#2a2b2a]" />
      <div className="relative overflow-hidden rounded-[2.4rem] bg-[#09090b]">
        <div aria-hidden className="relative flex h-[34px] items-center justify-between px-7 text-[11px] font-semibold text-white/90">
          <span className="tabular-nums">{time}</span>
          <span className="absolute left-1/2 top-[7px] h-[22px] w-[30%] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="1" /><rect x="4.3" y="4" width="3" height="6" rx="1" /><rect x="8.6" y="2" width="3" height="8" rx="1" /><rect x="12.9" y="0" width="3" height="10" rx="1" /></svg>
            <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="18" height="9" rx="2.5" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="13" height="6" rx="1.5" fill="currentColor" /><rect x="19.8" y="3.2" width="1.6" height="3.6" rx="0.8" fill="currentColor" opacity="0.5" /></svg>
          </span>
        </div>
        <Image src={src} alt={alt} priority={priority} placeholder="blur" sizes="(min-width: 1024px) 320px, 70vw" className="block h-auto w-full" />
      </div>
    </div>
  );
}

/** A laptop: the screen in a thin bezel, sitting on its base. */
export function Laptop({ src, alt, className }: { src: StaticImageData; alt: string; className?: string }) {
  return (
    <div className={cn('mx-auto', className)}>
      <div className="relative mx-auto w-[88%] rounded-t-[1.1rem] bg-[#262826] p-[1.4%] pb-[2.2%] shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]">
        <span aria-hidden className="absolute left-1/2 top-[0.55%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#3a3b3a]" />
        <div className="overflow-hidden rounded-[0.3rem] bg-[#09090b]">
          <Image src={src} alt={alt} placeholder="blur" sizes="(min-width: 1280px) 1000px, 90vw" className="block h-auto w-full" />
        </div>
      </div>
      <div aria-hidden className="relative h-3 rounded-b-[1rem] rounded-t-[2px] bg-gradient-to-b from-[#d9dbd6] to-[#a9aca6] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] sm:h-4">
        <span className="absolute left-1/2 top-0 h-1.5 w-[14%] -translate-x-1/2 rounded-b-md bg-[#8d908a]" />
      </div>
    </div>
  );
}

/** A cut-out of a real screen, shown as a card. */
export function Snip({ src, alt, className, sizes = '(min-width: 1024px) 360px, 90vw' }: {
  src: StaticImageData; alt: string; className?: string; sizes?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-[#09090b] ring-1 ring-black/5', className)}>
      <Image src={src} alt={alt} placeholder="blur" sizes={sizes} className="block h-auto w-full" />
    </div>
  );
}
