import { cn } from '@/lib/utils';

/** A shimmering stand-in shape while data loads, so the page keeps its layout instead of jumping. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

/** Stand-in for a list of cards, such as transactions, alerts or products. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-3 h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
