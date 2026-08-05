import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Scores, both kinds.
 *
 * The app carries two numbers for every title and they must never be confused,
 * so they are drawn in two different languages:
 *
 *   YOURS       five ember stars, two points each, 1–10.  <Rating> / <RatingInput>
 *   EVERYONE'S  a solid cool-toned badge out of 100.       <CommunityScore>
 *
 * Different shape, different color, different scale, different corner of the
 * poster. You can tell them apart from across the room, which is the whole
 * requirement — and neither of them is a gray number that vanishes into the
 * artwork, which was the old failure.
 */

export const RATING_MAX = 10

/** What each score actually means, in the words people use out loud. */
export const RATING_WORD: Record<number, string> = {
  1: 'Awful',
  2: 'Bad',
  3: 'Poor',
  4: 'Weak',
  5: 'Fine',
  6: 'Good',
  7: 'Very good',
  8: 'Great',
  9: 'Superb',
  10: 'Masterpiece',
}

export function ratingWord(score: number | null | undefined): string {
  if (score == null) return 'Not rated'
  return RATING_WORD[Math.round(score)] ?? '—'
}

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * Back to the original sizes.
 *
 * These were briefly grown to fix the poster row being hard to read, which was
 * the wrong lever: the row was hard to read because the glyph dissolved and the
 * unlit stars sat too close to the lit ones in both position and brightness,
 * not because 14px is too small for five marks. Growing it made the plate a bar
 * across the bottom of a 132px poster and bought nothing the shape and contrast
 * work below wasn't already buying.
 *
 * The one thing kept from that pass is a pixel of extra gap at the two small
 * sizes. Two pixels at 14px let the arms of neighbouring stars very nearly
 * touch, so the row arrived as one serrated band that had to be parsed before
 * it could be counted — and four pixels of total width is not a size change.
 */
const STAR_PX: Record<Size, number> = { xs: 14, sm: 17, md: 21, lg: 28, xl: 36 }
const GAP_PX: Record<Size, number> = { xs: 3, sm: 4, md: 5, lg: 6, xl: 8 }

/**
 * A deliberately fat star: inner radius at 0.51 of the outer, against the 0.38
 * of the conventional one. Those thin classical arms are lovely at 36px and
 * dissolve into antialiasing at 16 — half the ink in the glyph sits in points
 * too narrow to render, which is most of why the poster row read as grey mush.
 * Drawn with a rounded join stroked over the fill, which fattens the shape a
 * further half-pixel and stops the tips fraying.
 */
const STAR_PATH =
  'M12 1.5L15.17 7.63L21.99 8.76L17.14 13.67L18.17 20.49L12 17.4L5.83 20.49L6.86 13.67L2.01 8.76L8.83 7.63Z'

/* --------------------------------------------------------------- the star -- */

/**
 * A single star at a given fill (0, 0.5 or 1).
 *
 * Drawn as an inline path rather than a lucide icon so the half state can be a
 * hard clip on a solid shape — an outlined icon clipped in half shows its own
 * outline down the middle, which reads as a rendering bug.
 *
 * The outer span is a fixed box and never moves. Every hover effect is a
 * transform on the inner layer, so a sweep across the row can never reflow the
 * row it is sweeping across.
 */
function Star({
  fill,
  px,
  filledClass,
  lift,
  delay,
}: {
  fill: 0 | 0.5 | 1
  px: number
  filledClass: string
  /** Hover emphasis — a transform only, never a size change. */
  lift?: boolean
  delay?: number
}) {
  return (
    <span
      className="relative block shrink-0"
      style={{ width: px, height: px }}
      aria-hidden
    >
      <span
        className="absolute inset-0 origin-center will-change-transform"
        style={{
          transform: lift ? 'scale(1.14)' : 'scale(1)',
          transition: 'transform 200ms var(--ease-spring)',
          transitionDelay: delay ? `${delay}ms` : undefined,
        }}
      >
        {/* The unlit track. Quiet enough that the lit ones are counted rather
            than compared: at 55% it sat in the same brightness range as the
            ember and the row became five similar marks you had to inspect one
            by one to score. Its only remaining job is to hold the row's width
            and say "out of five". */}
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-full text-ink-3/30">
          <path
            d={STAR_PATH}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>

        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{
            width: `${fill * 100}%`,
            transition: 'width 160ms var(--ease-out-soft)',
            transitionDelay: delay ? `${delay}ms` : undefined,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn('absolute inset-y-0 left-0 h-full transition-colors duration-150', filledClass)}
            style={{
              width: px,
              /**
               * What makes the lit stars pop, in place of making them bigger.
               *
               * Two layers doing different jobs: a tight contact shadow that
               * sits the star *on* the plate rather than in it, and a wider
               * soft halo that darkens whatever is immediately around the
               * glyph. The halo is the one that matters — an ember star is a
               * warm mark and cover art is warm more often than not, so the
               * edge needs contrast of its own instead of borrowing the
               * plate's. Both are black rather than tinted: a colored glow
               * reads as a highlight state, and this is the resting state.
               */
              filter:
                'drop-shadow(0 1px 1px rgb(0 0 0 / 0.55)) drop-shadow(0 0 2.5px rgb(0 0 0 / 0.4))',
            }}
          >
            <path
              d={STAR_PATH}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </span>
  )
}

/** value (1–10) → per-star fill fractions. */
function fills(value: number): (0 | 0.5 | 1)[] {
  return Array.from({ length: 5 }, (_, i) => {
    const remaining = value - i * 2
    return remaining >= 2 ? 1 : remaining >= 1 ? 0.5 : 0
  })
}

/* ------------------------------------------------------------- read-only -- */

export interface RatingProps {
  value: number | null | undefined
  size?: Size
  /** Use the page's artwork accent instead of the brand ember. */
  art?: boolean
  /** Show the number after the stars. */
  showValue?: boolean
  /**
   * Wrap the stars in a frosted plate. Required whenever they sit *on*
   * artwork — five ember stars on an ember-heavy cover are invisible without
   * a surface of their own.
   */
  plate?: boolean
  className?: string
}

/**
 * The read-only form — your verdict, always as stars.
 *
 * This is the only way a personal score is ever drawn in this product. A bare
 * numeral in the corner of a poster says nothing at a glance and looks like
 * every other tracker; ★★★★☆ is countable in peripheral vision, on top of
 * artwork, and it is unmistakably *yours* rather than the crowd's.
 *
 * "Countable" is load-bearing, and it is what the small end of the size ramp is
 * tuned for. Five marks are read at a glance only while they are separate
 * objects with an obvious lit/unlit split. Crowd them, thin them, or bring the
 * unlit ones up near the lit ones in brightness and the row becomes something
 * you squint at and tally — worse than the numeral it replaced.
 */
export function Rating({ value, size = 'sm', art, showValue, plate, className }: RatingProps) {
  const px = STAR_PX[size]
  const parts = fills(value ?? 0)

  return (
    <span
      className={cn(
        'inline-flex items-center',
        plate &&
          // Near-opaque, with a hairline. At 88% over bright cover art the
          // plate was tinted by whatever was behind it, so the stars were
          // fighting the artwork for contrast instead of sitting on a surface.
          'rounded-full bg-canvas/95 px-2 py-1 ring-1 ring-inset ring-ink/10 shadow-[0_2px_6px_rgb(0_0_0/0.45)] backdrop-blur-md',
        className,
      )}
      style={{ gap: GAP_PX[size] + 4 }}
    >
      <span
        className="inline-flex"
        style={{ gap: GAP_PX[size] }}
        role="img"
        aria-label={value == null ? 'Not rated' : `Your rating: ${value} out of 10`}
      >
        {parts.map((f, i) => (
          <Star key={i} fill={f} px={px} filledClass={art ? 'text-art' : 'text-accent'} />
        ))}
      </span>

      {showValue && (
        <span
          className={cn(
            'font-mono-num font-semibold',
            value == null ? 'text-ink-3' : 'text-ink',
            size === 'xs' ? 'text-micro' : size === 'sm' ? 'text-meta' : 'text-label',
          )}
        >
          {value ?? '—'}
        </span>
      )}
    </span>
  )
}

/* ---------------------------------------------------------------- input -- */

export interface RatingInputProps {
  value: number | null
  onChange: (value: number | null) => void
  size?: Extract<Size, 'md' | 'lg' | 'xl'>
  art?: boolean
  /** Hide the numeral + word readout (used in tight rows). */
  bare?: boolean
  label?: string
  className?: string
}

/**
 * The rating interaction — the most polished control in the app.
 *
 * The whole row is one control, not five buttons: the pointer sweeps across it
 * and each half-star lights as it is crossed, so all ten stops are one click
 * away. Clicking the score you already have clears it.
 *
 * Everything here is built to hold absolutely still while you aim at it:
 *
 *  - the readout reserves its widest possible size up front, so the numeral and
 *    the word can change on every pixel of pointer movement without the row
 *    growing, shrinking, or nudging the popover it lives in
 *  - hover emphasis is a transform on a layer inside a fixed box — never a size,
 *    margin or position change
 *  - preview state only updates when the derived score actually changes, so a
 *    slow sweep across one star is zero renders
 *  - there is no enter/exit animation anywhere in here, because two of them
 *    fighting over the same node is what makes a control flicker
 */
export function RatingInput({
  value,
  onChange,
  size = 'lg',
  art,
  bare,
  label = 'Your rating',
  className,
}: RatingInputProps) {
  const starsRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [pulse, setPulse] = useState(0)

  const shown = preview ?? value
  const px = STAR_PX[size]
  const gap = GAP_PX[size]
  const parts = fills(shown ?? 0)

  /**
   * Which of the ten stops the pointer is aimed at.
   *
   * Measured off the rendered stars rather than computed from the nominal
   * sizes. Sub-pixel rounding makes a star a fraction narrower than its token
   * says, and that error compounds across the row: with arithmetic, "10" ended
   * up living in the last few pixels of the control instead of the last half
   * star. Reading the boxes back costs one layout per pointer move and is
   * exact at any size, zoom or font scale.
   */
  const fromPointer = useCallback((clientX: number): number => {
    const el = starsRef.current
    if (!el) return 1

    const stars = el.children
    for (let i = 0; i < stars.length; i += 1) {
      const box = stars[i].getBoundingClientRect()
      if (clientX < box.right || i === stars.length - 1) {
        const half = clientX < box.left + box.width / 2 ? 1 : 2
        return Math.min(RATING_MAX, Math.max(1, i * 2 + half))
      }
    }
    return RATING_MAX
  }, [])

  const commit = useCallback(
    (next: number | null) => {
      setPulse((n) => n + 1)
      onChange(next)
    },
    [onChange],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = value ?? 0

    // Digits are the fastest possible path: press 8, you rated it an 8.
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      commit(e.key === '0' ? RATING_MAX : Number(e.key))
      return
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        commit(Math.min(RATING_MAX, current + 1))
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        commit(current <= 1 ? null : current - 1)
        break
      case 'Home':
        e.preventDefault()
        commit(1)
        break
      case 'End':
        e.preventDefault()
        commit(RATING_MAX)
        break
      case 'Enter':
      case ' ':
        // Commit whatever is being previewed — the pointer and the keyboard
        // agree on what "the current aim" means.
        e.preventDefault()
        if (shown != null) commit(shown)
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        commit(null)
        break
    }
  }

  const readoutSize =
    size === 'xl' ? 'text-[2.5rem]' : size === 'lg' ? 'text-display-md' : 'text-display-sm'

  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-3', className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={RATING_MAX}
        aria-valuenow={value ?? 0}
        aria-valuetext={value == null ? 'Not rated' : `${value} out of 10 — ${ratingWord(value)}`}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => {
          const next = fromPointer(e.clientX)
          // Only re-render when the aimed score actually changes.
          setPreview((prev) => (prev === next ? prev : next))
        }}
        onPointerLeave={() => setPreview(null)}
        onPointerCancel={() => setPreview(null)}
        // Stops the sweep selecting the text around it, and stops a card or a
        // link underneath from treating the gesture as a drag.
        onPointerDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const next = fromPointer(e.clientX)
          commit(next === value ? null : next)
        }}
        onBlur={() => setPreview(null)}
        className="-my-2 inline-flex cursor-pointer touch-none rounded-sm py-2"
      >
        <div ref={starsRef} className="inline-flex" style={{ gap }}>
          {parts.map((f, i) => (
            <Star
              key={i}
              fill={f}
              px={px}
              lift={preview != null && f > 0}
              // Each star lights a beat after the one before it, so a sweep to
              // 9 ripples outward instead of snapping as a block.
              delay={preview != null && f > 0 ? i * 20 : 0}
              filledClass={
                preview != null ? 'text-accent-hover' : art ? 'text-art' : 'text-accent'
              }
            />
          ))}
        </div>
      </div>

      {!bare && (
        // Both readouts reserve their widest content, so nothing in this row —
        // or in the popover around it — can move while you are aiming.
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span
            key={pulse}
            className={cn(
              'font-mono-num inline-block text-right leading-none font-semibold tracking-tight',
              'motion-safe:animate-[score-pop_260ms_var(--ease-spring)]',
              readoutSize,
              shown == null ? 'text-ink-3' : art ? 'text-art' : 'text-ink',
            )}
            style={{ minWidth: '2ch' }}
          >
            {shown ?? '—'}
          </span>

          <span
            className="label-cat label-cat-plain whitespace-nowrap transition-colors duration-150"
            style={{ minWidth: '7.25rem' }}
          >
            {shown == null ? 'Pick a score' : ratingWord(shown)}
          </span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------- community score -- */

/**
 * The seven bands.
 *
 * `how good is this` has more than four honest steps, and a real temperature
 * ramp — blue at the top, through greens and yellow, into orange, red and a
 * dead purple at the bottom — can be read without having learned the product.
 * Binning rather than interpolating means the same title is the same color on
 * every screen, so the color carries information instead of decorating.
 *
 * Band ids are the floor of the band on the 0–10 scale, which makes the table
 * below check itself against the spec at a glance.
 */
export type ScoreBand = '9' | '8' | '7' | '6' | '5' | '3' | '0'

/** Takes the score on the 0–10 scale, already rounded to the printed digit. */
export function scoreBand(outOfTen: number): ScoreBand {
  if (outOfTen >= 9) return '9'
  if (outOfTen >= 8) return '8'
  if (outOfTen >= 7) return '7'
  if (outOfTen >= 6) return '6'
  if (outOfTen >= 5) return '5'
  if (outOfTen >= 3) return '3'
  return '0'
}

export const SCORE_BAND_WORD: Record<ScoreBand, string> = {
  '9': 'Acclaimed',
  '8': 'Excellent',
  '7': 'Well liked',
  '6': 'Solid',
  '5': 'Mixed',
  '3': 'Poorly received',
  '0': 'Panned',
}

/**
 * Solid fill / tinted wash / text, per band.
 *
 * Kept in three parallel tables rather than composed at the call site so a new
 * surface cannot invent an eighth combination. Each solid pairs with its own
 * ink because the ramp crosses from dark blue to yellow: one shared ink fails
 * contrast at one end or the other.
 */
const BAND_SOLID: Record<ScoreBand, string> = {
  '9': 'bg-score-9 text-score-9-ink',
  '8': 'bg-score-8 text-score-8-ink',
  '7': 'bg-score-7 text-score-7-ink',
  '6': 'bg-score-6 text-score-6-ink',
  '5': 'bg-score-5 text-score-5-ink',
  '3': 'bg-score-3 text-score-3-ink',
  '0': 'bg-score-0 text-score-0-ink',
}

const BAND_TEXT: Record<ScoreBand, string> = {
  '9': 'text-score-9',
  '8': 'text-score-8',
  '7': 'text-score-7',
  '6': 'text-score-6',
  '5': 'text-score-5',
  '3': 'text-score-3',
  '0': 'text-score-0',
}

/** The hairline around the split pill, so the two halves read as one object. */
const BAND_RING: Record<ScoreBand, string> = {
  '9': 'ring-score-9/40',
  '8': 'ring-score-8/40',
  '7': 'ring-score-7/40',
  '6': 'ring-score-6/40',
  '5': 'ring-score-5/40',
  '3': 'ring-score-3/40',
  '0': 'ring-score-0/40',
}

const BAND_WASH: Record<ScoreBand, string> = {
  '9': 'bg-score-9/18 text-score-9',
  '8': 'bg-score-8/18 text-score-8',
  '7': 'bg-score-7/18 text-score-7',
  '6': 'bg-score-6/20 text-score-6',
  '5': 'bg-score-5/20 text-score-5',
  '3': 'bg-score-3/18 text-score-3',
  '0': 'bg-score-0/18 text-score-0',
}

/**
 * Upstream reports the community average out of 100. The product speaks in
 * tenths and never shows /100, so the conversion happens exactly here — at the
 * one component that draws the number — rather than at forty call sites that
 * would each get to round it slightly differently.
 */
export function communityOutOfTen(pct: number): number {
  return Math.round(Math.max(0, Math.min(100, pct))) / 10
}

/** "8.7" — always one decimal, so a shelf of chips is a straight column. */
export function communityText(pct: number): string {
  return communityOutOfTen(pct).toFixed(1)
}

export interface CommunityScoreProps {
  /** The community average as upstream reports it, 0–100. Drawn out of 10. */
  value: number | null | undefined
  /**
   * badge  — solid color block. Sits on artwork, on every poster in the app.
   * pill   — tinted wash. For rows and other flat surfaces.
   * hero   — the arc + big numeral, once per media page.
   */
  variant?: 'badge' | 'pill' | 'hero'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Everyone else's number: X.X/10, in a solid block of band color.
 *
 * Never stars, never ember, never gray — the two scores in this product must
 * be distinguishable at a glance from across the room, so they differ in
 * shape, color, scale *and* position. Yours is five ember stars at the bottom
 * left of a poster; everyone's is a colored numeric chip at the top left.
 *
 * The band color does the scanning work: on a wall of covers you read the
 * color first and the digits second, so a shelf's quality has a shape before
 * you have read a single number.
 */
export function CommunityScore({
  value,
  variant = 'pill',
  size = 'md',
  className,
}: CommunityScoreProps) {
  if (value == null) return null

  const outOfTen = communityOutOfTen(value)
  // Band off the *printed* digit, so a 8.96 that prints "9.0" is blue rather
  // than green. A chip whose color disagrees with its own number is a bug you
  // can see from the other side of the room.
  const band = scoreBand(outOfTen)
  const text = outOfTen.toFixed(1)
  const label = `Community score ${text} out of 10 — ${SCORE_BAND_WORD[band].toLowerCase()}`

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'font-mono-num inline-flex items-center justify-center rounded-md font-extrabold tabular-nums',
          // A real shadow and a proper corner. The old 5px radius and hairline
          // made this read as a sticker applied to the poster rather than as a
          // reading of it.
          'shadow-[0_2px_6px_rgb(0_0_0/0.45),inset_0_0_0_1px_rgb(255_255_255/0.22)]',
          'transition-transform duration-300 ease-[var(--ease-spring)] group-hover/card:scale-110',
          // Deliberately *not* scaled down with the rest of the type ramp. At
          // 11px semibold on busy cover art the number was legible only if you
          // went looking for it, which is the opposite of its job — on Discover
          // it is the only signal there is.
          size === 'sm' ? 'px-2 py-0.5 text-[0.8125rem]' : 'px-2.5 py-1 text-[0.9375rem]',
          BAND_SOLID[band],
          className,
        )}
        title={label}
        aria-label={label}
      >
        {/* No "/10" on a poster. At badge size the denominator is four extra
            glyphs of pure noise sitting on top of artwork — the scale is
            already unambiguous from the decimal point and from the band color,
            and the accessible name below still spells it out in full. The
            larger `pill` and `hero` variants keep it, where there is room for
            it to be information rather than clutter. */}
        {text}
      </span>
    )
  }

  if (variant === 'hero') {
    return (
      <span className={cn('inline-flex items-center gap-3.5', className)} aria-label={label}>
        <ScoreArc outOfTen={outOfTen} band={band} />
        <span className="flex flex-col">
          <span className="flex items-baseline leading-none font-semibold">
            <span className={cn('font-mono-num text-display-md tabular-nums', BAND_TEXT[band])}>
              {text}
            </span>
            <span className="font-mono-num text-title text-ink-3">/10</span>
          </span>
          <span className="label-cat label-cat-plain mt-1.5">
            Community · {SCORE_BAND_WORD[band]}
          </span>
        </span>
      </span>
    )
  }

  /**
   * The pill: a solid band-colored cap carrying the number, then the scale in
   * a quiet tail. The old version was a tinted wash with a dot — at 12% opacity
   * the color it was supposed to be communicating was barely present, so it
   * read as a grey pill with a number in it. Splitting it means the color is
   * solid where the digits are and the "/10" stays out of the way.
   */
  return (
    <span
      className={cn(
        'font-mono-num inline-flex items-stretch overflow-hidden rounded-md font-bold tabular-nums',
        'ring-1 ring-inset',
        BAND_RING[band],
        size === 'sm' ? 'text-[0.75rem]' : 'text-[0.8125rem]',
        className,
      )}
      title={label}
      aria-label={label}
    >
      <span className={cn('px-1.5 py-0.5', BAND_SOLID[band])}>{text}</span>
      <span className={cn('px-1 py-0.5 text-[0.85em] font-semibold', BAND_WASH[band])}>/10</span>
    </span>
  )
}

/**
 * The hero arc: 270° rather than a full circle, so the gap reads as a gauge
 * and the number beside it is unmistakably a measurement rather than a badge.
 */
function ScoreArc({ outOfTen, band }: { outOfTen: number; band: ScoreBand }) {
  const r = 15
  const sweep = 0.75 * 2 * Math.PI * r
  const gap = 2 * Math.PI * r - sweep

  return (
    <svg viewBox="0 0 36 36" className="size-14 shrink-0 rotate-[135deg]" aria-hidden>
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${sweep} ${gap}`}
        className="text-ink-3/20"
      />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${(outOfTen / 10) * sweep} ${2 * Math.PI * r}`}
        className={cn(
          BAND_TEXT[band],
          'transition-[stroke-dasharray] duration-[900ms] ease-[var(--ease-out-expo)]',
        )}
      />
    </svg>
  )
}
