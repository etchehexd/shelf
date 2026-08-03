import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shimmer rounded-md', className)} aria-hidden {...rest} />
}

/** Matches CoverCard's footprint exactly so grids don't reflow when data lands. */
export function CoverSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-md" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton className="h-15 w-10 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  )
}
