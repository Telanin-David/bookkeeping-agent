import Image from 'next/image';
import { cn } from '@/lib/utils';
import word from '@/assets/brand/sabeebook-word.png';
import bee from '@/assets/brand/sabeebook-bee.png';

/**
 * The sabeebook logo, cut exactly from the brand sheet (its dark-panel version, with the
 * panel's green taken out so it sits on the app's own background). One or the other per
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
