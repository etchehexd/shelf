import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { scoreBand } from './Rating'

/**
 * A bar's color is the band its score belongs to.
 *
 * Reuses `scoreBand` rather than re-deriving the thresholds, so the chart
 * cannot drift out of agreement with the chips on every poster: a column at 8
 * and an 8.0/10 badge are the same green because they ask the same function.
 */
const BAND_FILL: Record<ReturnType<typeof scoreBand>, string> = {
  '9': 'bg-score-9',
  '8': 'bg-score-8',
  '7': 'bg-score-7',
  '6': 'bg-score-6',
  '5': 'bg-score-5',
  '3': 'bg-score-3',
  '0': 'bg-score-0',
}

const fill = (score: number): string => BAND_FILL[scoreBand(score)]

/**
 * The shape of your taste.
 *
 * Everywhere the app shows your scores in aggregate it shows this, and only
 * this — the old surfaces printed a bare average and a row of digits, which is
 * a number you have to *think* about rather than a picture you can read. A
 * histogram answers the actual question in one glance: are you generous, are
 * you harsh, do you only finish things you already know you'll love.
 *
 * Deliberately not a chart library:
 *
 *  - the axis is the product's own five-star scale, drawn underneath the ten
 *    columns it maps onto, so "8" and "★★★★" are visibly the same statement
 *  - bars are colored by the score band they represent — the same seven-step
 *    ramp the community chips use — so the shape of the distribution and its
 *    quality read in the same glance
 *  - the mean is a word in the footer, not a hairline through the plot
 *  - no gridlines, no tick marks, no boxed frame; the baseline rule is the
 *    only structure, which is how every other section on the page is built
 */

export interface ScoreHistogramProps {
  /** Ten buckets, scores 1–10. */
  distribution: number[]
  /** Plot height in px. The axis and footer add their own space. */
  height?: number
  /** Use the page's artwork accent instead of the brand ember. */
  art?: boolean
  /** Drop the count / average footer when the surrounding section says it. */
  footer?: boolean
  className?: string
}

export function ScoreHistogram({
  distribution,
  height = 132,
  art,
  footer = true,
  className,
}: ScoreHistogramProps) {
  const [hover, setHover] = useState<number | null>(null)

  const { total, max, mean, peak } = useMemo(() => {
    const total = distribution.reduce((a, b) => a + b, 0)
    const max = Math.max(1, ...distribution)
    const weighted = distribution.reduce((sum, count, i) => sum + count * (i + 1), 0)
    let peak = -1
    distribution.forEach((count, i) => {
      if (count > 0 && (peak === -1 || count > distribution[peak])) peak = i
    })
    return { total, max, mean: total > 0 ? weighted / total : null, peak }
  }, [distribution])

  if (total === 0) return null

  const shown = hover ?? peak

  return (
    <div className={cn('min-w-0 max-w-xl', className)}>
      {/* The readout sits above the plot and reserves its height, so sweeping
          across the columns can never nudge the chart underneath it. */}
      <div className="mb-3 flex h-5 items-baseline gap-2">
        {shown >= 0 && distribution[shown] > 0 && (
          <>
            <span
              className={cn(
                'font-mono-num text-title leading-none font-semibold',
                art ? 'text-art' : 'text-accent',
              )}
            >
              {distribution[shown]}
            </span>
            <span className="label-cat label-cat-plain">
              rated {shown + 1}
              {hover == null && ' · most given'}
            </span>
          </>
        )}
      </div>

      {/* No average line. It stood *in* the plot, so it cut whichever column it
          landed on in half and its label covered the two beside it — a
          hairline plus a chip of chrome obscuring the exact bars the chart
          exists to show. The footer already prints the same reading in words,
          which is where a summary of a picture belongs. */}
      <div className="relative" style={{ height }} onPointerLeave={() => setHover(null)}>
        <div className="flex h-full items-end gap-1 md:gap-1.5">
          {distribution.map((count, i) => {
            const empty = count === 0
            const active = hover === i
            return (
              <button
                key={i}
                type="button"
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${count} rated ${i + 1} out of 10`}
                className="group/col flex h-full flex-1 cursor-default items-end rounded-t-[3px]"
              >
                <span
                  className={cn(
                    'w-full origin-bottom rounded-t-[3px]',
                    'transition-[height,opacity,background-color,transform]',
                    'duration-[700ms] ease-[var(--ease-out-expo)]',
                    // Each branch names exactly one background and one opacity.
                    // Layering an `active &&` override on top would put two
                    // conflicting utilities of equal specificity on the same
                    // element, where the winner is decided by stylesheet order
                    // rather than by intent.
                    empty
                      ? active
                        ? 'bg-ink-3/30 opacity-100'
                        : 'bg-ink-3/15 opacity-100'
                      : cn(
                          // The bar for "rated 8" is the same color as an 8.0
                          // community chip. Two different color languages for
                          // the same 0–10 scale on the same page is what made
                          // this chart read as decoration rather than as data.
                          fill(i + 1),
                          active ? 'opacity-100 scale-x-105' : 'opacity-85',
                        ),
                  )}
                  style={{ height: empty ? 3 : `${Math.max(6, (count / max) * 100)}%` }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* Axis. The digits are the scale that is stored; the stars underneath
          are the scale that is shown everywhere else. Printing both, aligned,
          is what makes the two read as one thing. */}
      <div className="mt-2 border-t border-line pt-2">
        <div className="flex gap-1 md:gap-1.5">
          {distribution.map((_, i) => (
            <span
              key={i}
              className={cn(
                'font-mono-num flex-1 text-center text-[0.625rem] transition-colors duration-200',
                hover === i ? 'text-ink' : 'text-ink-3',
              )}
            >
              {i + 1}
            </span>
          ))}
        </div>

        <div className="mt-1 flex gap-1 md:gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((s) => (
            <span key={s} className="flex flex-[2] items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-2.5 text-ink-3/45">
                <path
                  d="M12 1.9l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 16.92l-5.88 3.09 1.12-6.55L2.48 8.82l6.58-.96z"
                  fill="currentColor"
                />
              </svg>
            </span>
          ))}
        </div>
      </div>

      {footer && (
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className="label-cat label-cat-plain">
            {total} {total === 1 ? 'score' : 'scores'}
          </span>
          <span className="label-cat label-cat-plain">
            {verdict(mean)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * One honest sentence about the shape, not a compliment. "Generous" and
 * "exacting" are descriptions; "great taste!" would be filler.
 */
function verdict(mean: number | null): string {
  if (mean == null) return ''
  if (mean >= 8.5) return 'generous'
  if (mean >= 7) return 'warm'
  if (mean >= 5.5) return 'even-handed'
  return 'exacting'
}
