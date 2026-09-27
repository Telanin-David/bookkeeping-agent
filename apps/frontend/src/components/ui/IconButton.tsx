import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** A round button holding one icon, big enough for a thumb. Always give it an aria-label. */
const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full glass-elevated text-white/80 transition duration-150',
        'hover:text-white active:scale-[0.94] disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = 'IconButton';
export default IconButton;
