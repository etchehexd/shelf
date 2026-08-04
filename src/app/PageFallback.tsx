import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { CoverSkeleton, EmptyState, Skeleton } from '@/design'

/**
 * Skeletons mirror the dashboard's actual layout rather than showing a spinner,
 * so the page doesn't visibly rearrange itself when content lands.
 */
export function PageFallback({ notFound }: { notFound?: boolean }) {
  if (notFound) {
    return (
      <div className="py-24">
        <EmptyState
          icon={<Compass className="size-8" strokeWidth={1.5} />}
          title="Page not found"
          
          action={
            <Link
              to="/"
              className="inline-flex h-9.5 items-center rounded-md bg-accent px-4 text-label font-medium text-accent-ink hover:bg-accent-hover"
            >
              Back to your dashboard
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-16 py-2">
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="flex gap-5 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-80 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 sm:grid-cols-5 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <CoverSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
