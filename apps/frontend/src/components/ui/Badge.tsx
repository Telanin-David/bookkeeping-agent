import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-white/55',
      className,
    )}>
      {children}
    </span>
  );
}
