import { useCallback, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'
import { scoreText } from '@/lib/format'

/**
 * The rating control.
 *
 * ONE underlying number: 0.5 – 10.0 in 0.5 steps (20 stops). Five stars, each
 * worth 2 points. That makes "5 stars with half stars" and "10-point scale" the
 * same field viewed two ways, which is why nothing in the app ever converts
 * between scales.
 *
 * Interaction model: the whole row is one slider, not five buttons. Pointer x
 * across the row snaps to the nearest 0.5, so every one of the 20 stops is
 * reachable with a single click — a per-star click model could only ever reach
 * 10 of them. Fill is continuous, so 8.5 renders as 85% across the row and
 * lands as a visible quarter-star.
 */

const MAX = 10
const STEP = 0.5

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { star: string; gap: string; text: string }> = {
  sm: { star: 'size-3.5', gap: 'gap-0.5', text: 'text-meta' },
  md: { star: 'size-[18px]', gap: 'gap-1', text: 'text-label' },
  lg: { star: 'size-7', gap: 'gap-1.5', text: 'text-title' },
}

export interface StarsProps {
  value: number | null
  size?: Size
  /** Omit to render read-only. */
  onChange?: (value: number | null) => void
  /** Show the numeric score beside the stars. */
  showValue?: boolean
  /** Use the page's artwork accent instead of the brand amber. */
  art?: boolean
  className?: string
  label?: string
}

export function Stars({
  value,
  size = 'md',
  onChange,
  showValue,
  art,
  className,
  label = 'Rating',
}: StarsProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const interactive = Boolean(onChange)

  const shown = preview ?? value ?? 0
  const pct = (shown / MAX) * 100
  const s = SIZES[size]

  const valueFromPointer = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el) return STEP
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    const raw = Math.round((ratio * MAX) / STEP) * STEP
    return Math.min(MAX, Math.max(STEP, raw))
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (!onChange) return
    const current = value ?? 0

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        onChange(Math.min(MAX, current + STEP))
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        // Stepping below the minimum clears the rating rather than sticking at 0.5.
        onChange(current - STEP < STEP ? null : current - STEP)
        break
      case 'Home':
        e.preventDefault()
        onChange(STEP)
        break
      case 'End':
        e.preventDefault()
        onChange(MAX)
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        onChange(null)
        break
    }
  }

  return (
    <div className={cn('inline-flex items-center', s.gap === 'gap-0.5' ? 'gap-2' : 'gap-2.5', className)}>
      <div
        ref={trackRef}
        role={interactive ? 'slider' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={label}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? MAX : undefined}
        aria-valuenow={interactive ? (value ?? 0) : undefined}
        aria-valuetext={
          interactive ? (value == null ? 'Not rated' : `${scoreText(value)} out of 10`) : undefined
        }
        onKeyDown={interactive ? handleKey : undefined}
        onPointerMove={interactive ? (e) => setPreview(valueFromPointer(e.clientX)) : undefined}
        onPointerLeave={interactive ? () => setPreview(null) : undefined}
        onClick={
          interactive
            ? (e) => {
                const next = valueFromPointer(e.clientX)
                // Clicking the current value again clears it.
                onChange?.(next === value ? null : next)
              }
            : undefined
        }
        className={cn(
          'relative inline-flex shrink-0',
          s.gap,
          interactive && 'cursor-pointer rounded-sm',
        )}
      >
        {/* Empty track */}
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(s.star, 'shrink-0 text-ink-3/35')} strokeWidth={1.5} aria-hidden />
        ))}

        {/* Filled overlay, clipped to the score. Width is the only animated
            property, so the sweep runs on the compositor. */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex overflow-hidden',
            s.gap,
            'transition-[width] duration-200 ease-[cubic-bezier(.2,0,0,1)]',
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(
                s.star,
                'shrink-0 fill-current',
                preview != null ? 'text-accent-hover' : art ? 'text-art' : 'text-accent',
              )}
              strokeWidth={1.5}
            />
          ))}
        </div>
      </div>

      {showValue && (
        <span
          className={cn(
            'tnum font-medium tabular-nums',
            s.text,
            shown > 0 ? 'text-ink' : 'text-ink-3',
          )}
        >
          {shown > 0 ? scoreText(shown) : '—'}
        </span>
      )}
    </div>
  )
}
