import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantCls: Record<Variant, string> = {
  primary:
    'btn-primary disabled:opacity-40 disabled:cursor-not-allowed',
  secondary:
    'glass text-white/70 hover:bg-white/[0.09] hover:text-white/90 active:bg-white/[0.12] disabled:opacity-40',
  ghost:
    'text-white/50 hover:bg-white/[0.06] hover:text-white/80 active:bg-white/[0.09] disabled:opacity-40',
  danger:
    'bg-white/[0.06] border border-white/[0.08] text-white/60 hover:bg-red-500/10 hover:text-red-300/80 disabled:opacity-40',
};

const sizeCls: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  // Thumb-sized on phones, a little tighter with a mouse.
  md: 'min-h-[2.75rem] px-4 py-2 text-[15px] rounded-xl sm:min-h-0 sm:text-sm',
  lg: 'min-h-[3rem] px-5 py-2.5 text-[15px] rounded-2xl sm:min-h-0 sm:text-sm sm:rounded-xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        // Presses shrink a touch, so a tap on a phone feels answered.
        'inline-flex select-none items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.97] disabled:active:scale-100',
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
export default Button;
