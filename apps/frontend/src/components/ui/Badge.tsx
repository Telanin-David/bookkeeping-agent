import { cn } from '@/lib/utils';

type Color = 'gray' | 'green' | 'yellow' | 'red' | 'blue';

interface BadgeProps {
  color?: Color;
  children: React.ReactNode;
  className?: string;
}

const colorCls: Record<Color, string> = {
  gray:   'bg-white/8 text-white/50 border-white/10',
  green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  red:    'bg-red-500/15 text-red-400 border-red-500/20',
  blue:   'bg-sky-500/15 text-sky-400 border-sky-500/20',
};

export default function Badge({ color = 'gray', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      colorCls[color],
      className,
    )}>
      {children}
    </span>
  );
}
