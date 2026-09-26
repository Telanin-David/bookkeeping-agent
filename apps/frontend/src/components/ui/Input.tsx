import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Guidance shown under the field until there's an error to show instead. */
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-white/40">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'glass-input block w-full rounded-xl px-3.5 py-2.5 text-sm transition-all placeholder:text-white/25',
          error ? 'border-white/25' : '',
          className,
        )}
        {...props}
      />
      {error
        ? <p className="text-xs text-white/45">{error}</p>
        : hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
export default Input;
