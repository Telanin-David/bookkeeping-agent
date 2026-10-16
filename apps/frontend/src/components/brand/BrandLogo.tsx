import Image from 'next/image';
import { cn } from '@/lib/utils';
import logo from '@/assets/brand/sabeebook-logo.png';
import wordmark from '@/assets/brand/sabeebook-wordmark.png';

/**
 * The sabeebook logo, exactly as on the brand sheet (its dark-panel version, with the
 * panel's green taken out so it sits on the app's own background).
 * `full` adds the "Easy bookkeeping for busy people." line, for the sign-in screens.
 */
export default function BrandLogo({ variant = 'mark', className, priority }: { variant?: 'full' | 'mark'; className?: string; priority?: boolean }) {
  return (
    <Image
      src={variant === 'full' ? logo : wordmark}
      alt={variant === 'full' ? 'sabeebook: Easy bookkeeping for busy people.' : 'sabeebook'}
      priority={priority}
      className={cn('h-auto select-none', className)}
    />
  );
}
