import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface Segment<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  /** Rendered as a quiet count after the label. */
  count?: number
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  segments: Segment<T>[]
  size?: 'sm' | 'md'
  /** Icon-only mode for view switchers; labels become accessible names. */
  iconOnly?: boolean
  className?: string
  'aria-label': string
}

/**
 * The moving thumb is a shared `layoutId`, so switching tabs animates the
 * highlight between positions on the compositor rather than cross-fading two
 * backgrounds.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  size = 'md',
  iconOnly,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const layoutId = useId()

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-surface-2 p-0.5',
        className,
      )}
    >
      {segments.map((seg) => {
        const active = seg.value === value
        return (
          <button
            key={seg.value}
            role="tab"
            type="button"
            aria-selected={active}
            aria-label={iconOnly && typeof seg.label === 'string' ? seg.label : undefined}
            title={iconOnly && typeof seg.label === 'string' ? seg.label : undefined}
            onClick={() => onChange(seg.value)}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap',
              'transition-colors duration-[110ms]',
              size === 'sm' ? 'h-7 text-meta' : 'h-8 text-label',
              iconOnly ? (size === 'sm' ? 'w-7' : 'w-8') : size === 'sm' ? 'px-2.5' : 'px-3.5',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {seg.icon}
              {!iconOnly && seg.label}
              {!iconOnly && seg.count != null && (
                <span className="tnum text-ink-3">{seg.count}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
