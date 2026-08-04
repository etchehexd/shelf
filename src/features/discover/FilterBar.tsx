import { useMemo } from 'react'
import { Check, SlidersHorizontal, X } from 'lucide-react'
import { Button, Chip, MenuLabel, Pill, Popover, SegmentedControl } from '@/design'
import { useGenres, type MediaFilters } from '@/data/anilist/hooks'
import type { MediaKind } from '@/data/anilist/types'
import { cn } from '@/lib/cn'

/**
 * The narrowing controls.
 *
 * One row of dropdowns, then a row of what is currently on. That second row is
 * the important half: a filter you cannot see is a filter you will forget you
 * set, and "why is this list empty" is almost always an invisible filter three
 * screens back. Every active constraint is a chip here, and every chip removes
 * exactly itself.
 *
 * Multi-select menus stay open as you tick; single-select ones close. That
 * follows the intent — you pick one format, but you pick three genres.
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

/** Decade buckets plus the years anyone actually filters to one at a time. */
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

const SCORES = [
  { label: 'Any score', from: undefined },
  { label: '9.0+', from: 9 },
  { label: '8.0+', from: 8 },
  { label: '7.0+', from: 7 },
  { label: '6.0+', from: 6 },
] as const

export interface FilterBarProps {
  kind: MediaKind
  filters: MediaFilters
  onChange: (next: MediaFilters) => void
  /** Sort is only offered while browsing — a text search sorts by relevance. */
  sort?: string
  onSortChange?: (next: string) => void
  showSort?: boolean
}

export function FilterBar({
  kind,
  filters,
  onChange,
  sort,
  onSortChange,
  showSort,
}: FilterBarProps) {
  const { data: allGenres } = useGenres()
  const formats = FORMATS[kind]
  const years = useMemo(yearOptions, [])

  const genres = filters.genres ?? []
  const chosenFormats = filters.formats ?? []
  const statuses = filters.statuses ?? []

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const yearLabel =
    filters.yearFrom == null
      ? 'Any year'
      : (years.find((y) => y.from === filters.yearFrom && y.to === filters.yearTo)?.label ??
        `${filters.yearFrom}–${filters.yearTo}`)

  const scoreLabel =
    filters.scoreFrom == null
      ? 'Any score'
      : `${filters.scoreFrom.toFixed(1)}+`

  const active = [
    ...genres.map((g) => ({ key: `genre:${g}`, label: g, clear: () => onChange({ ...filters, genres: genres.filter((x) => x !== g) }) })),
    ...chosenFormats.map((f) => ({
      key: `format:${f}`,
      label: formats.find((o) => o.value === f)?.label ?? f,
      clear: () => onChange({ ...filters, formats: chosenFormats.filter((x) => x !== f) }),
    })),
    ...statuses.map((s) => ({
      key: `status:${s}`,
      label: STATUSES.find((o) => o.value === s)?.label ?? s,
      clear: () => onChange({ ...filters, statuses: statuses.filter((x) => x !== s) }),
    })),
    ...(filters.yearFrom != null
      ? [{ key: 'year', label: yearLabel, clear: () => onChange({ ...filters, yearFrom: undefined, yearTo: undefined }) }]
      : []),
    ...(filters.scoreFrom != null
      ? [{ key: 'score', label: scoreLabel, clear: () => onChange({ ...filters, scoreFrom: undefined }) }]
      : []),
  ]

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-cat mr-1 hidden sm:inline-flex">
          <SlidersHorizontal className="size-3" aria-hidden />
          Narrow
        </span>

        <FilterMenu label="Genre" count={genres.length}>
          {() => (
            <div className="max-h-80 overflow-y-auto">
              <MenuLabel>Genre</MenuLabel>
              {(allGenres ?? []).map((g) => (
                <CheckRow
                  key={g}
                  checked={genres.includes(g)}
                  onSelect={() => onChange({ ...filters, genres: toggle(genres, g) })}
                >
                  {g}
                </CheckRow>
              ))}
            </div>
          )}
        </FilterMenu>

        <FilterMenu label="Format" count={chosenFormats.length}>
          {() => (
            <>
              <MenuLabel>Format</MenuLabel>
              {formats.map((f) => (
                <CheckRow
                  key={f.value}
                  checked={chosenFormats.includes(f.value)}
                  onSelect={() => onChange({ ...filters, formats: toggle(chosenFormats, f.value) })}
                >
                  {f.label}
                </CheckRow>
              ))}
            </>
          )}
        </FilterMenu>

        <FilterMenu label={yearLabel} active={filters.yearFrom != null}>
          {({ close }) => (
            <div className="max-h-80 overflow-y-auto">
              <MenuLabel>Released</MenuLabel>
              <CheckRow
                checked={filters.yearFrom == null}
                onSelect={() => {
                  onChange({ ...filters, yearFrom: undefined, yearTo: undefined })
                  close()
                }}
              >
                Any year
              </CheckRow>
              {years.map((y) => (
                <CheckRow
                  key={y.label}
                  checked={filters.yearFrom === y.from && filters.yearTo === y.to}
                  onSelect={() => {
                    onChange({ ...filters, yearFrom: y.from, yearTo: y.to })
                    close()
                  }}
                >
                  {y.label}
                </CheckRow>
              ))}
            </div>
          )}
        </FilterMenu>

        <FilterMenu label={scoreLabel} active={filters.scoreFrom != null}>
          {({ close }) => (
            <>
              <MenuLabel>Community score</MenuLabel>
              {SCORES.map((s) => (
                <CheckRow
                  key={s.label}
                  checked={filters.scoreFrom === s.from}
                  onSelect={() => {
                    onChange({ ...filters, scoreFrom: s.from })
                    close()
                  }}
                >
                  {s.label}
                </CheckRow>
              ))}
            </>
          )}
        </FilterMenu>

        <FilterMenu label="Status" count={statuses.length}>
          {() => (
            <>
              <MenuLabel>Status</MenuLabel>
              {STATUSES.map((s) => (
                <CheckRow
                  key={s.value}
                  checked={statuses.includes(s.value)}
                  onSelect={() => onChange({ ...filters, statuses: toggle(statuses, s.value) })}
                >
                  {s.label}
                </CheckRow>
              ))}
            </>
          )}
        </FilterMenu>

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

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.clear}
              className={cn(
                'group inline-flex h-7 items-center gap-1.5 rounded-full border border-accent-line',
                'bg-accent-quiet pr-2 pl-3 text-meta font-medium text-accent transition-colors',
                'hover:border-accent hover:bg-accent hover:text-accent-ink',
              )}
              aria-label={`Remove filter ${a.label}`}
            >
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

function FilterMenu({
  label,
  count,
  active,
  children,
}: {
  label: string
  count?: number
  active?: boolean
  children: (api: { close: () => void }) => React.ReactNode
}) {
  const on = active || (count ?? 0) > 0

  return (
    <Popover
      side="bottom"
      align="start"
      role="menu"
      label={label}
      className="w-56"
      trigger={
        <Chip active={on} aria-haspopup="menu">
          {label}
          {count != null && count > 0 && (
            <Pill
              size="sm"
              className="ml-1.5 h-4.5 border-none bg-accent-ink/20 px-1.5 text-[0.625rem] text-current"
            >
              {count}
            </Pill>
          )}
        </Chip>
      }
    >
      {children}
    </Popover>
  )
}

/**
 * A menu row that reads as a checkbox.
 *
 * Not `MenuItem`: that one is built for "pick this and the menu closes", and
 * silently reusing it for a multi-select is how a menu ends up dismissing
 * itself after the first genre.
 */
function CheckRow({
  checked,
  onSelect,
  children,
}: {
  checked: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-label',
        'transition-colors hover:bg-surface-2',
        checked ? 'font-medium text-ink' : 'text-ink-2',
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="truncate">{children}</span>
    </button>
  )
}
