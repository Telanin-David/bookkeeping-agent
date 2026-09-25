import { cn } from '@/lib/utils';

type Color = 'gray' | 'green' | 'yellow' | 'red' | 'blue';

interface BadgeProps {
  color?: Color;
  children: React.ReactNode;
  className?: string;
}

const colorCls: Record<Color, string> = {
  gray:   'bg-gray-100 text-gray-700',
  green:  'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  blue:   'bg-blue-100 text-blue-700',
};

export default function Badge({ color = 'gray', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colorCls[color], className)}>
      {children}
    </span>
  );
}
