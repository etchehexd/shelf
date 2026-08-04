import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface StatTileProps {
  label: string
  value: ReactNode
  /** e.g. "this week". Neutral by default — this is not a scoreboard. */
  hint?: string
  icon?: ReactNode
  className?: string
}

/**
 * A number presented like a caption in a printed catalog: the figure large
 * and in mono, the label small and wide beneath it, and a hairline above
 * instead of a box around it. Four in a row read as a masthead strip rather
 * than as a dashboard.
 */
export function StatTile({ label, value, hint, icon, className }: StatTileProps) {
  return (
    <div className={cn('group/stat min-w-0', className)}>
      <div className="mb-3 h-px w-full bg-line transition-colors duration-500 group-hover/stat:bg-accent" />
      <div className="flex items-baseline gap-2">
        <span className="font-mono-num text-display-md leading-none font-semibold text-ink">
          {value}
        </span>
        {hint && <span className="truncate text-meta text-ink-3">{hint}</span>}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="label-cat label-cat-plain truncate">{label}</span>
      </div>
    </div>
  )
}

export interface BarRowProps {
  label: string
  value: number
  max: number
  /** Right-aligned readout; defaults to the raw value. */
  readout?: string
  art?: boolean
}

/** Horizontal bar used by genre affinity and rating distribution. */
export function BarRow({ label, value, max, readout, art }: BarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-meta text-ink-2">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]',
            art ? 'bg-art' : 'bg-accent',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono-num w-8 shrink-0 text-right text-meta text-ink-3">
        {readout ?? value}
      </span>
    </div>
  )
}
