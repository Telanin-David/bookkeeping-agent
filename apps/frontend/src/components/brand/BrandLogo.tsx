import Image from 'next/image';
import { cn } from '@/lib/utils';
import word from '@/assets/brand/sabeebook-word.svg';
import bee from '@/assets/brand/sabeebook-bee.svg';

/**
 * The sabeebook logo, redrawn as vector shapes from the brand sheet's dark-panel version in
 * the exact brand colours, so it stays sharp at any size. One or the other per
 * place, never both together: `word` where there's width (sign-in, menus), `bee` where
 * the space is small or square (the loading screen).
 */
export default function BrandLogo({ variant = 'word', className, priority }: { variant?: 'word' | 'bee'; className?: string; priority?: boolean }) {
  return (
    <Image
      src={variant === 'word' ? word : bee}
      alt="sabeebook"
      priority={priority}
      className={cn('h-auto select-none', className)}
    />
  );
}
