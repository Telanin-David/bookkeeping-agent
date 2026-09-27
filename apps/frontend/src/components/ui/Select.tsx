import { forwardRef, type SelectHTMLAttributes } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * A dropdown matching the text fields: the browser's own arrow is hidden (it sits hard
 * against the edge and differs per phone) and replaced by one with room around it.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, id, children, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-white/40">{label}</label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(
            'glass-input block min-h-[2.75rem] w-full cursor-pointer appearance-none rounded-xl py-2.5 pl-3.5 pr-10 text-base sm:text-sm',
            error && 'border-white/25',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <CaretDown size={15} weight="bold" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45" aria-hidden />
      </div>
      {error
        ? <p className="text-xs text-white/45">{error}</p>
        : hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  ),
);

Select.displayName = 'Select';
export default Select;
