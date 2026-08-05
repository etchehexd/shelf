import { useMemo, useState } from 'react'
import { Check, Minus, SlidersHorizontal, X } from 'lucide-react'
import { Button, Eyebrow, Popover, SegmentedControl } from '@/design'
import { useGenres, type MediaFilters } from '@/data/anilist/hooks'
import type { MediaKind } from '@/data/anilist/types'
import { cn } from '@/lib/cn'

/**
 * One filter control, not six.
 *
 * The old bar was a row of five separate dropdowns — Genre, Format, Any year,
 * Any score, Status — each opening its own little menu. That is five things to
 * scan before you have narrowed anything, five popovers that each know a
 * different amount about what you already picked, and no single place that
 * answers "what is currently on". It read as a toolbar for a spreadsheet.
 *
 * Now there is one button. It opens a panel with every axis laid out at once,
 * so choosing a genre and a decade is one interaction rather than two, and you
 * can see the whole shape of a query while you build it.
 *
 * ---------------------------------------------------------------- tri-state
 *
 * Genres, formats and statuses are three-way rather than on/off:
 *
 *   neutral   the filter says nothing about this value
 *   include   results must have it
 *   exclude   results must not have it
 *
 * Excluding is the half people actually reach for and almost no tracker
 * offers: "isekai, but not harem" is a real request, and with on/off checkboxes
 * it is unexpressible. Clicking cycles neutral → include → exclude → neutral,
 * and the checkbox itself shows which state it is in — a tick, a minus, or
 * nothing — so the three states are distinguishable without color alone.
 *
 * Exclusions are applied *locally*, after results come back, because the
 * upstream catalog has no "not this genre" argument. That is a deliberate
 * trade: it means an exclusion can thin a page of results rather than
 * refetching a fuller one, which is a far better failure than silently
 * ignoring the constraint.
 */

const FORMATS: Record<MediaKind, { value: string; label: string }[]> = {
  anime: [
    { value: 'TV', label: 'TV' },
    { value: 'TV_SHORT', label: 'TV short' },
    { value: 'MOVIE', label: 'Film' },
    { value: 'OVA', label: 'OVA' },
    { value: 'ONA', label: 'ONA' },
    { value: 'SPECIAL', label: 'Special' },
  ],
  manga: [
    { value: 'MANGA', label: 'Manga' },
    { value: 'ONE_SHOT', label: 'One shot' },
  ],
  novel: [{ value: 'NOVEL', label: 'Light novel' }],
}

const STATUSES = [
  { value: 'RELEASING', label: 'Releasing' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
  { value: 'HIATUS', label: 'On hiatus' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function yearOptions(): { label: string; from: number; to: number }[] {
  const now = new Date().getFullYear()
  const recent = Array.from({ length: 6 }, (_, i) => now - i).map((y) => ({
    label: String(y),
    from: y,
    to: y,
  }))
  const decades = [2020, 2010, 2000, 1990, 1980].map((d) => ({
    label: `${d}s`,
    from: d,
    to: d + 9,
  }))
  return [...recent, ...decades, { label: 'Before 1980', from: 1900, to: 1979 }]
}

/**
 * The floor of the score filter, and its step.
 *
 * It starts at 5 rather than 0 because the bottom half of the range is not a
 * filter anyone sets: barely anything upstream scores under 50, so five of the
 * ten stops on a 0–10 slider would have returned the same results as "any".
 * The one real position below the useful band is *no constraint at all*, and
 * that lives at the left end as its own stop.
 */
const SCORE_MIN = 5
const SCORE_MAX = 9.5
const SCORE_STEP = 0.5

export type TriState = 'off' | 'include' | 'exclude'

function stateOf(filters: MediaFilters, axis: 'genres' | 'formats' | 'statuses', value: string): TriState {
  if ((filters[axis] ?? []).includes(value)) return 'include'
  const excludeKey = `${axis}Excluded` as const
  if ((filters[excludeKey] ?? []).includes(value)) return 'exclude'
  return 'off'
}

function cycle(
  filters: MediaFilters,
  axis: 'genres' | 'formats' | 'statuses',
  value: string,
): MediaFilters {
  const excludeKey = `${axis}Excluded` as const
  const included = filters[axis] ?? []
  const excluded = filters[excludeKey] ?? []
  const current = stateOf(filters, axis, value)

  if (current === 'off') {
    return { ...filters, [axis]: [...included, value] }
  }
  if (current === 'include') {
    return {
      ...filters,
      [axis]: included.filter((v) => v !== value),
      [excludeKey]: [...excluded, value],
    }
  }
  return { ...filters, [excludeKey]: excluded.filter((v) => v !== value) }
}

export interface FilterBarProps {
  kind: MediaKind
  filters: MediaFilters
  onChange: (next: MediaFilters) => void
  sort?: string
  onSortChange?: (next: string) => void
  showSort?: boolean
}

export function FilterBar({ kind, filters, onChange, sort, onSortChange, showSort }: FilterBarProps) {
  const { data: allGenres } = useGenres()
  const formats = FORMATS[kind]
  const years = useMemo(yearOptions, [])
  const [open, setOpen] = useState(false)

  const yearLabel =
    filters.yearFrom == null
      ? null
      : (years.find((y) => y.from === filters.yearFrom && y.to === filters.yearTo)?.label ??
        `${filters.yearFrom}–${filters.yearTo}`)

  /** Every constraint currently on, as a removable chip. */
  const active: { key: string; label: string; negated?: boolean; clear: () => void }[] = []

  for (const axis of ['genres', 'formats', 'statuses'] as const) {
    const excludeKey = `${axis}Excluded` as const
    const labelFor = (v: string) =>
      axis === 'formats'
        ? (formats.find((f) => f.value === v)?.label ?? v)
        : axis === 'statuses'
          ? (STATUSES.find((s) => s.value === v)?.label ?? v)
          : v

    for (const v of filters[axis] ?? []) {
      active.push({
        key: `${axis}:${v}`,
        label: labelFor(v),
        clear: () => onChange({ ...filters, [axis]: (filters[axis] ?? []).filter((x) => x !== v) }),
      })
    }
    for (const v of filters[excludeKey] ?? []) {
      active.push({
        key: `${excludeKey}:${v}`,
        label: labelFor(v),
        negated: true,
        clear: () =>
          onChange({ ...filters, [excludeKey]: (filters[excludeKey] ?? []).filter((x) => x !== v) }),
      })
    }
  }

  if (yearLabel) {
    active.push({
      key: 'year',
      label: yearLabel,
      clear: () => onChange({ ...filters, yearFrom: undefined, yearTo: undefined }),
    })
  }
  if (filters.scoreFrom != null) {
    active.push({
      key: 'score',
      label: `${filters.scoreFrom.toFixed(1)}+`,
      clear: () => onChange({ ...filters, scoreFrom: undefined }),
    })
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Popover
          side="bottom"
          align="start"
          role="dialog"
          label="Filters"
          open={open}
          onOpenChange={setOpen}
          className="w-[min(30rem,calc(100vw-2rem))] p-0"
          trigger={
            <Button
              icon={<SlidersHorizontal className="size-4" />}
              variant={active.length > 0 ? 'primary' : 'secondary'}
              aria-haspopup="dialog"
            >
              Filters
              {active.length > 0 && (
                <span className="font-mono-num ml-1 rounded-full bg-accent-ink/25 px-1.5 text-[0.6875rem]">
                  {active.length}
                </span>
              )}
            </Button>
          }
        >
          {() => (
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-4">
              <p className="mb-4 text-meta text-ink-3">
                Click once to require, twice to exclude.
              </p>

              <Axis title="Genre">
                {(allGenres ?? []).map((g) => (
                  <TriChip
                    key={g}
                    label={g}
                    state={stateOf(filters, 'genres', g)}
                    onClick={() => onChange(cycle(filters, 'genres', g))}
                  />
                ))}
              </Axis>

              <Axis title="Format">
                {formats.map((f) => (
                  <TriChip
                    key={f.value}
                    label={f.label}
                    state={stateOf(filters, 'formats', f.value)}
                    onClick={() => onChange(cycle(filters, 'formats', f.value))}
                  />
                ))}
              </Axis>

              <Axis title="Status">
                {STATUSES.map((s) => (
                  <TriChip
                    key={s.value}
                    label={s.label}
                    state={stateOf(filters, 'statuses', s.value)}
                    onClick={() => onChange(cycle(filters, 'statuses', s.value))}
                  />
                ))}
              </Axis>

              {/* Year and score are ranges, so they stay single-select — there
                  is no coherent meaning for "exclude the 2010s but also
                  require 2015". */}
              <Axis title="Released">
                <PickChip
                  label="Any year"
                  active={filters.yearFrom == null}
                  onClick={() => onChange({ ...filters, yearFrom: undefined, yearTo: undefined })}
                />
                {years.map((y) => (
                  <PickChip
                    key={y.label}
                    label={y.label}
                    active={filters.yearFrom === y.from && filters.yearTo === y.to}
                    onClick={() => onChange({ ...filters, yearFrom: y.from, yearTo: y.to })}
                  />
                ))}
              </Axis>

              <Axis title="Community score" last>
                <ScoreSlider
                  value={filters.scoreFrom}
                  onChange={(scoreFrom) => onChange({ ...filters, scoreFrom })}
                />
              </Axis>

              <div className="sticky bottom-0 -mx-4 -mb-4 mt-5 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => onChange({})}>
                  Clear all
                </Button>
                <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </Popover>

        {showSort && onSortChange && (
          <div className="ml-auto">
            <SegmentedControl
              aria-label="Sort"
              size="sm"
              value={sort ?? 'trending'}
              onChange={onSortChange}
              segments={[
                { value: 'trending', label: 'Trending' },
                { value: 'score', label: 'Top rated' },
                { value: 'newest', label: 'Newest' },
              ]}
            />
          </div>
        )}
      </div>

      {/* What is on, outside the panel. An active filter you have to open a
          menu to see is an active filter you will forget you set. */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.clear}
              className={cn(
                'group inline-flex h-7 items-center gap-1.5 rounded-full border pr-2 pl-3',
                'text-meta font-medium transition-colors',
                a.negated
                  ? 'border-dropped/45 bg-dropped/10 text-dropped hover:border-dropped hover:bg-dropped hover:text-canvas'
                  : 'border-accent-line bg-accent-quiet text-accent hover:border-accent hover:bg-accent hover:text-accent-ink',
              )}
              aria-label={`Remove filter ${a.negated ? 'excluding ' : ''}${a.label}`}
            >
              {a.negated && <Minus className="size-3" aria-hidden />}
              {a.label}
              <X className="size-3.5 opacity-60 group-hover:opacity-100" aria-hidden />
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Axis({
  title,
  children,
  last,
}: {
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={cn('py-3', !last && 'border-b border-line')}>
      <Eyebrow className="mb-2.5">{title}</Eyebrow>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/**
 * A three-state chip.
 *
 * The state is carried by an icon as well as by color — a tick for include, a
 * minus for exclude, nothing for off — because "this genre is required" and
 * "this genre is banned" differing only in hue is unreadable to a good
 * proportion of people and ambiguous to everybody in a screenshot.
 */
function TriChip({
  label,
  state,
  onClick,
}: {
  label: string
  state: TriState
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={state !== 'off'}
      title={
        state === 'include'
          ? `${label} — required. Click to exclude.`
          : state === 'exclude'
            ? `${label} — excluded. Click to clear.`
            : `${label} — click to require.`
      }
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-meta font-medium',
        'transition-colors duration-150 active:scale-[0.97]',
        state === 'include' &&
          'border-accent-line bg-accent text-accent-ink motion-safe:animate-[squish_300ms_var(--ease-spring)]',
        state === 'exclude' && 'border-dropped/50 bg-dropped/15 text-dropped line-through',
        state === 'off' && 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {state === 'include' && <Check className="size-3" strokeWidth={3} aria-hidden />}
      {state === 'exclude' && <Minus className="size-3" strokeWidth={3} aria-hidden />}
      {label}
    </button>
  )
}

/**
 * The score floor, as a slider.
 *
 * It was five chips — Any, 9.0+, 8.0+, 7.0+, 6.0+ — which is a slider with four
 * of its stops removed and no way to ask for 8.5. A range is a range; the
 * control should be one, and the half-point stops are the ones people actually
 * want, because upstream's scores cluster hard between 7 and 8.5.
 *
 * The far-left position is "any", not "0.0+", and it is a real stop rather
 * than a checkbox beside the track: `scoreFrom: undefined` and
 * `scoreFrom: 0` mean the same thing to the query but very different things to
 * the chip row outside the panel, which should say nothing at all when the
 * filter is off.
 */
function ScoreSlider({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (next: number | undefined) => void
}) {
  const steps = Math.round((SCORE_MAX - SCORE_MIN) / SCORE_STEP) + 1
  // Position 0 is "any"; 1…steps are the real floors.
  const position = value == null ? 0 : Math.round((value - SCORE_MIN) / SCORE_STEP) + 1
  const fill = (position / steps) * 100

  return (
    <div className="w-full pt-1">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="text-meta text-ink-2">
          {value == null ? 'Any score' : 'At least'}
        </span>
        <span
          className={cn(
            'font-mono-num text-title font-semibold tabular-nums',
            value == null ? 'text-ink-3' : 'text-accent',
          )}
        >
          {value == null ? '—' : `${value.toFixed(1)}+`}
        </span>
      </div>

      <input
        type="range"
        className="range"
        min={0}
        max={steps}
        step={1}
        value={position}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        aria-label="Minimum community score"
        aria-valuetext={value == null ? 'Any score' : `${value.toFixed(1)} or higher`}
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange(next === 0 ? undefined : SCORE_MIN + (next - 1) * SCORE_STEP)
        }}
      />

      <div className="mt-1 flex justify-between text-[0.625rem] text-ink-3">
        <span>Any</span>
        <span className="font-mono-num">{SCORE_MAX.toFixed(1)}</span>
      </div>
    </div>
  )
}

function PickChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-2.5 text-meta font-medium',
        'transition-colors duration-150 active:scale-[0.97]',
        active
          ? 'border-accent-line bg-accent text-accent-ink'
          : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}
