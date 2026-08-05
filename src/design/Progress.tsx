import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHoldRepeat, usePrefersReducedMotion } from './hooks'
import { IconButton } from './Button'

export interface ProgressBarProps {
  value: number
  max: number | null
  /** Use the page's artwork accent instead of brand ember. */
  art?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** Force the continuous bar even when a tick track would fit. */
  continuous?: boolean
  className?: string
}

/**
 * Above this, individual ticks stop being readable and become hatching.
 *
 * Was 50. At 25 ticks in a 128px poster cell each segment is under 3px wide
 * with a 2px gap — a row of dashes that reads as a barcode and, at 22% opacity
 * on the unfilled half, is genuinely hard to look at. 16 is roughly the point
 * where a tick is still wide enough to be a tick.
 */
const MAX_TICKS = 16

const TRACK_H = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' } as const

/**
 * The progress track.
 *
 * When a title has a known, countable length — a 12-episode season, a 24-volume
 * run — the track is drawn as *one tick per episode*, so you can see "three
 * left" without reading a number. Long runs fall back to a continuous bar,
 * because 400 chapters of hatching is just texture.
 *
 * This is the app's own progress control, and it appears everywhere progress
 * does: cards, rows, the media page, collections.
 */
export function ProgressBar({
  value,
  max,
  art,
  size = 'sm',
  continuous,
  className,
}: ProgressBarProps) {
  const ticked = !continuous && max != null && max > 1 && max <= MAX_TICKS
  const fill = art ? 'bg-art' : 'bg-accent'

  const common = {
    role: 'progressbar' as const,
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': max ?? undefined,
  }

  if (ticked) {
    return (
      <div className={cn('flex w-full items-stretch gap-[2px]', TRACK_H[size], className)} {...common}>
        {Array.from({ length: max! }, (_, i) => {
          const done = i < value
          return (
            <motion.span
              key={i}
              initial={false}
              animate={{ opacity: done ? 1 : 0.4 }}
              transition={{ duration: 0.22, delay: done ? Math.min(i, 24) * 0.012 : 0 }}
              className={cn(
                'min-w-[3px] flex-1 rounded-full',
                done ? fill : 'bg-ink-3',
              )}
            />
          )
        })}
      </div>
    )
  }

  // An unknown total (an ongoing series) still deserves a bar, so fall back to
  // a small standing fill rather than showing nothing.
  const pct = max && max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 8 : 0

  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', TRACK_H[size], className)}
      {...common}
    >
      <motion.div
        className={cn('h-full rounded-full', fill)}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface ProgressStepperProps {
  value: number
  max: number | null
  onChange: (next: number) => void
  /** "Episode" / "Chapter" / "Volume" */
  unit: string
  art?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * The most-repeated control in the app, so it gets the most craft:
 *
 *  - hold either button to repeat, accelerating — a six-episode binge is one press
 *  - click the number to type an exact value
 *  - the number springs up on increment and down on decrement, so the change is
 *    legible without reading it
 *  - reaching the end swaps the + for a tick, which is the moment a title
 *    finishes and deserves to feel like one
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
  const btn = size === 'sm' ? 'sm' : big ? 'md' : 'sm'

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-line bg-surface-2/70 p-0.5',
        'transition-colors duration-200 hover:border-line-strong',
        className,
      )}
    >
      <IconButton
        label={`One fewer ${unit.toLowerCase()}`}
        icon={<Minus className="size-4" />}
        variant="ghost"
        size={btn}
        disabled={atMin}
        onClick={() => step(-1)}
        className="rounded-full"
        {...dec}
      />

      <div
        className={cn(
          'flex items-baseline justify-center gap-1 select-none',
          big ? 'min-w-24 px-2' : size === 'sm' ? 'min-w-14 px-1' : 'min-w-18 px-1.5',
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
              'font-mono-num w-full bg-transparent text-center font-semibold outline-none',
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
                initial={reduced ? false : { y: direction * 9, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: direction * -9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 560, damping: 32 }}
                className={cn(
                  'font-mono-num font-semibold',
                  big ? 'text-display-md' : size === 'sm' ? 'text-label' : 'text-title',
                  art ? 'text-art' : 'text-ink',
                )}
              >
                {value}
              </motion.span>
            </AnimatePresence>
            <span
              className={cn('font-mono-num text-ink-3', big ? 'text-label' : 'text-micro')}
              aria-hidden
            >
              /{max ?? '?'}
            </span>
          </button>
        )}
      </div>

      <IconButton
        label={atMax ? 'Finished' : `One more ${unit.toLowerCase()}`}
        icon={atMax ? <Check className="size-4" /> : <Plus className="size-4" />}
        variant={atMax ? 'ghost' : art ? 'art' : 'primary'}
        size={btn}
        disabled={atMax}
        onClick={() => step(1)}
        className={cn('rounded-full', atMax && 'text-watching opacity-100')}
        {...inc}
      />
    </div>
  )
}
