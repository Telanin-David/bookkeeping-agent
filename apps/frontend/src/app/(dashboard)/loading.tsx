import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';

// Shown the instant a page is tapped, while it loads: the page's shape rather than a blank
// pause, so moving around feels immediate.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4 md:px-6">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex-1 p-5 md:p-6">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
