import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface StatTileProps {
  label: string
  value: ReactNode
  /** e.g. "+3 this week". Neutral by default — this is not a scoreboard. */
  hint?: string
  icon?: ReactNode
  className?: string
}

export function StatTile({ label, value, hint, icon, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-line bg-surface p-4',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="text-micro uppercase">{label}</span>
      </div>
      <span className="tnum font-display text-display-sm leading-none text-ink">{value}</span>
      {hint && <span className="text-meta text-ink-3">{hint}</span>}
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
          className={cn('h-full rounded-full transition-[width] duration-500', art ? 'bg-art' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tnum w-10 shrink-0 text-right text-meta text-ink-3">
        {readout ?? value}
      </span>
    </div>
  )
}
