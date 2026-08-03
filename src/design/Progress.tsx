import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHoldRepeat, usePrefersReducedMotion } from './hooks'
import { IconButton } from './Button'

export interface ProgressBarProps {
  value: number
  max: number | null
  /** Use the page's artwork accent instead of brand amber. */
  art?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, max, art, size = 'sm', className }: ProgressBarProps) {
  // An unknown total (ongoing series) still deserves a bar, so fall back to a
  // gentle indeterminate-looking fill rather than showing nothing.
  const pct = max && max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 8 : 0

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        size === 'sm' ? 'h-1' : 'h-1.5',
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max ?? undefined}
    >
      <motion.div
        className={cn('h-full rounded-full', art ? 'bg-art' : 'bg-accent')}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      />
    </div>
  )
}

export interface ProgressStepperProps {
  value: number
  max: number | null
  onChange: (next: number) => void
  /** "Episode" / "Chapter" / "Volume" */
  unit: string
  art?: boolean
  size?: 'md' | 'lg'
  className?: string
}

/**
 * The most-repeated control in the app, so it gets the most craft:
 *
 *  - hold either button to repeat, accelerating — a six-episode binge is one press
 *  - click the number to type an exact value
 *  - the number springs up on increment and down on decrement, so the change is
 *    legible without reading it
 *
 * Writes are local-first (see ARCHITECTURE.md), so there is no pending state to
 * design around: the animation *is* the latency budget.
 */
export function ProgressStepper({
  value,
  max,
  onChange,
  unit,
  art,
  size = 'md',
  className,
}: ProgressStepperProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [direction, setDirection] = useState<1 | -1>(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const reduced = usePrefersReducedMotion()

  const atMin = value <= 0
  const atMax = max != null && value >= max

  const step = (delta: 1 | -1) => {
    const next = value + delta
    if (next < 0 || (max != null && next > max)) return
    setDirection(delta)
    onChange(next)
  }

  const dec = useHoldRepeat(() => step(-1))
  const inc = useHoldRepeat(() => step(1))

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10)
    setEditing(false)
    if (Number.isNaN(parsed)) return
    const clamped = Math.max(0, max != null ? Math.min(max, parsed) : parsed)
    if (clamped !== value) {
      setDirection(clamped > value ? 1 : -1)
      onChange(clamped)
    }
  }

  const big = size === 'lg'

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <IconButton
        label={`One fewer ${unit.toLowerCase()}`}
        icon={<Minus className="size-4" />}
        variant="quiet"
        size={big ? 'md' : 'sm'}
        disabled={atMin}
        onClick={() => step(-1)}
        {...dec}
      />

      <div
        className={cn(
          'flex items-baseline justify-center gap-1 px-2 select-none',
          big ? 'min-w-28' : 'min-w-20',
        )}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label={`${unit} number`}
            className={cn(
              'tnum w-full bg-transparent text-center font-semibold outline-none',
              big ? 'text-display-md' : 'text-title',
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(value))
              setEditing(true)
            }}
            aria-label={`${value} of ${max ?? 'unknown'} ${unit.toLowerCase()}s. Click to set exactly.`}
            className="flex items-baseline gap-1 rounded-sm"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={value}
                initial={reduced ? false : { y: direction * 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: direction * -10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                className={cn(
                  'tnum font-semibold',
                  big ? 'text-display-md' : 'text-title',
                  art ? 'text-art' : 'text-ink',
                )}
              >
                {value}
              </motion.span>
            </AnimatePresence>
            <span className={cn('tnum text-ink-3', big ? 'text-label' : 'text-meta')}>
              / {max ?? '?'}
            </span>
          </button>
        )}
      </div>

      <IconButton
        label={`One more ${unit.toLowerCase()}`}
        icon={<Plus className="size-4" />}
        variant={art ? 'art' : 'primary'}
        size={big ? 'md' : 'sm'}
        disabled={atMax}
        onClick={() => step(1)}
        {...inc}
      />
    </div>
  )
}
