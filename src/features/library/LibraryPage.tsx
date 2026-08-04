import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LayoutGrid, Library as LibraryIcon, List, Rows3 } from 'lucide-react'
import {
  Button,
  buttonClasses,
  Chip,
  CommunityScore,
  CoverImage,
  CoverSkeleton,
  EmptyState,
  Eyebrow,
  MenuItem,
  MenuLabel,
  Popover,
  ProgressBar,
  Rail,
  SearchInput,
  SegmentedControl,
  ShelfLine,
  Skeleton,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, totalUnits, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { usePrefs, type LibrarySort, type ViewMode } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { SignInWall } from '@/features/auth/SignInWall'
import { useEntriesOfKind, useStatusCounts } from '@/data/store/selectors'
import { STATUS_ORDER, statusLabel, type EntryStatus, type LibraryEntry } from '@/data/store/types'
import { MediaCard, MediaRow, ShelfCover } from '@/features/tracking/cards'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'

const VIEWS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'shelf', label: 'Shelves', icon: Rows3 },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: List },
]

/**
 * No "Rank" here any more. Ordering by taste is a different activity from
 * tracking progress and it has its own section now — leaving a rank sort behind
 * would put half of a feature in a page that no longer explains it.
 */
const SORTS: { value: LibrarySort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'added', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'score', label: 'Score' },
  { value: 'progress', label: 'Progress' },
]

/**
 * Every filter lives in the URL, so any view of the library is linkable and
 * survives reload and back-navigation. Component state here would quietly break
 * both.
 */
export default function LibraryPage() {
  const { signedOut } = useAuth()
  const [params, setParams] = useSearchParams()

  const defaultView = usePrefs((s) => s.defaultView)
  const librarySort = usePrefs((s) => s.librarySort)
  const setDefaultView = usePrefs((s) => s.setDefaultView)
  const setLibrarySort = usePrefs((s) => s.setLibrarySort)
  const language = usePrefs((s) => s.titleLanguage)

  const kind = (params.get('kind') as MediaKind) || 'anime'
  const status = params.get('status') as EntryStatus | null
  const view = (params.get('view') as ViewMode) || defaultView
  const sort = (params.get('sort') as LibrarySort) || librarySort
  const query = params.get('q') ?? ''
  const genre = params.get('genre')

  const patch = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === '') merged.delete(key)
      else merged.set(key, value)
    }
    setParams(merged, { replace: true })
  }

  const entries = useEntriesOfKind(kind)
  const counts = useStatusCounts(kind)
  const { map, isLoading } = useMediaMap(useMemo(() => entries.map((e) => e.mediaId), [entries]))

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) for (const g of map.get(entry.mediaId)?.genres ?? []) set.add(g)
    return [...set].sort()
  }, [entries, map])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return entries
      .filter((e) => (status ? e.status === status : true))
      .filter((e) => {
        if (!genre) return true
        return map.get(e.mediaId)?.genres.includes(genre) ?? false
      })
      .filter((e) => {
        if (!needle) return true
        const media = map.get(e.mediaId)
        if (!media) return false
        const { romaji, english, native } = media.title
        return [romaji, english, native].some((t) => t?.toLowerCase().includes(needle))
      })
      .sort(comparator(sort, map, language))
  }, [entries, status, genre, query, sort, map, language])

  const grouped = useMemo(() => {
    if (status) return null
    return STATUS_ORDER.map((s) => ({
      status: s,
      entries: filtered.filter((e) => e.status === s),
    })).filter((group) => group.entries.length > 0)
  }, [filtered, status])

  /* The head of the page: what you are actually in the middle of. */
  const inProgress = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'current')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6)
        .map((entry) => ({ entry, media: map.get(entry.mediaId) }))
        .filter((x) => x.media) as { media: MediaSummary; entry: LibraryEntry }[],
    [entries, map],
  )

  const total = entries.length
  const filtering = Boolean(status || genre || query)

  if (signedOut) {
    return (
      <SignInWall section="Library" headline="Nowhere to put it yet.">
        A library is a record of what you've watched, where you are in it, and what you made
        of it. It has to belong to an account — otherwise it lives on one browser and is gone
        the first time you clear it.
      </SignInWall>
    )
  }

  return (
    <div className="space-y-10 pt-1">
      {/* ---------------------------------------------------------- masthead */}

      <header className="space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-7">
          <h1 className="text-display-lg text-ink">Library</h1>
          <p className="flex items-baseline gap-2 pb-1.5">
            <span className="font-mono-num text-display-md leading-none font-semibold text-ink">
              {total}
            </span>
            <span className="label-cat label-cat-plain">{KIND_LABEL[kind]}</span>
          </p>
        </div>

        {/* What the Library is for, given the space it deserves: the things
            you are in the middle of, and how far in you are. */}
        {!filtering && inProgress.length > 0 && (
          <InProgressBand items={inProgress} counts={counts} total={total} kind={kind} />
        )}

        {/* --------------------------------------------------------- controls */}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              aria-label="Media type"
              value={kind}
              onChange={(next) => patch({ kind: next, genre: null })}
              segments={(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => ({
                value: k,
                label: KIND_LABEL[k],
              }))}
            />

            <SegmentedControl
              aria-label="View mode"
              value={view}
              onChange={(next) => {
                patch({ view: next })
                setDefaultView(next)
              }}
              segments={VIEWS.map((v) => ({
                value: v.value,
                label: v.label,
                icon: <v.icon className="size-4" aria-hidden />,
              }))}
              iconOnly
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip active={!status} onClick={() => patch({ status: null })}>
              Everything
              {total > 0 && <span className="font-mono-num ml-1.5 opacity-60">{total}</span>}
            </Chip>
            {STATUS_ORDER.filter((s) => counts[s] > 0 || status === s).map((s) => (
              <Chip key={s} active={status === s} onClick={() => patch({ status: s })}>
                {statusLabel(s, kind)}
                <span className="font-mono-num ml-1.5 opacity-60">{counts[s]}</span>
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Filter your library"
              aria-label="Filter library by title"
              className="flex-1 sm:max-w-xs"
            />

            <Popover
              align="start"
              role="menu"
              label="Sort"
              className="w-52"
              trigger={
                <Button size="md">
                  {SORTS.find((s) => s.value === sort)?.label ?? 'Recently touched'}
                </Button>
              }
            >
              {({ close }) => (
                <>
                  <MenuLabel>Sort by</MenuLabel>
                  {SORTS.map((s) => (
                    <MenuItem
                      key={s.value}
                      selected={sort === s.value}
                      onSelect={() => {
                        patch({ sort: s.value })
                        setLibrarySort(s.value)
                        close()
                      }}
                    >
                      {s.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Popover>

            {genres.length > 0 && (
              <Popover
                align="start"
                role="menu"
                label="Genre"
                className="max-h-80 w-56 overflow-y-auto"
                trigger={<Button size="md">{genre ?? 'Any genre'}</Button>}
              >
                {({ close }) => (
                  <>
                    <MenuItem
                      selected={!genre}
                      onSelect={() => {
                        patch({ genre: null })
                        close()
                      }}
                    >
                      Any genre
                    </MenuItem>
                    {genres.map((g) => (
                      <MenuItem
                        key={g}
                        selected={genre === g}
                        onSelect={() => {
                          patch({ genre: g })
                          close()
                        }}
                      >
                        {g}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Popover>
            )}

            {filtering && (
              <button
                type="button"
                onClick={() => patch({ status: null, genre: null, q: null })}
                className="label-cat label-cat-plain hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- body */}

      {filtered.length === 0 ? (
        isLoading && total > 0 ? (
          <LibraryGridSkeleton />
        ) : (
          <EmptyState
            icon={<LibraryIcon className="size-6" strokeWidth={1.5} />}
            title={total === 0 ? `No ${KIND_LABEL[kind].toLowerCase()} yet` : 'Nothing matches'}
            action={
              total === 0 ? (
                <Link to="/discover" className={buttonClasses('primary', 'md')}>
                  Search for something
                </Link>
              ) : undefined
            }
          />
        )
      ) : view === 'list' ? (
        <ListView entries={filtered} map={map} />
      ) : view === 'grid' ? (
        <GridView entries={filtered} map={map} />
      ) : (
        <ShelfView groups={grouped} entries={filtered} map={map} kind={kind} status={status} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The head of the Library — the page's one hero.
 *
 * The Library answers two questions and nothing else: *what am I in the middle
 * of*, and *how far in am I*. So the hero is those two answers, and only those:
 * the six things most recently touched at generous size, each standing on its
 * own progress, over a blown-up wash of the most recent cover.
 *
 * A stacked ribbon underneath gives the whole shelf its shape in one line —
 * proportion per status, which five separate count chips can state but can't
 * actually show.
 */
function InProgressBand({
  items,
  counts,
  total,
  kind,
}: {
  items: { media: MediaSummary; entry: LibraryEntry }[]
  counts: Record<EntryStatus, number>
  total: number
  kind: MediaKind
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const wash = items[0]?.media

  return (
    <section className="relative isolate overflow-hidden rounded-xl border border-line bg-surface-2/70 px-6 pt-6 pb-7">
      {/* The page takes its color from whatever you touched last. */}
      {wash?.coverImage && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <img src={wash.coverImage} alt="" className="art-wash size-full object-cover" />
          <div className="absolute inset-0 bg-canvas/72" />
        </div>
      )}

      <div className="mb-5 flex items-center gap-4">
        <Eyebrow>{statusLabel('current', kind)} now</Eyebrow>
        <span className="h-px flex-1 bg-line" aria-hidden />
        <Link to="?status=current" className="label-cat label-cat-plain hover:text-ink">
          See all
        </Link>
      </div>

      <ol className="no-scrollbar flex items-end gap-5 overflow-x-auto pb-1">
        {items.map(({ media, entry }, i) => {
          const unitTotal = totalUnits(media)
          const pct = unitTotal ? Math.round((entry.progress / unitTotal) * 100) : null

          return (
            <li key={media.id} className="shrink-0">
              <Link
                to={`/media/${media.id}`}
                className="group/head frame-lift block"
                title={displayTitle(media, language)}
              >
                {/* The first one is the biggest: it is almost always the thing
                    you opened the app to continue. */}
                <div className={i === 0 ? 'w-32 md:w-40' : 'w-24 md:w-28'}>
                  <CoverImage src={media.coverImage} alt="" color={media.color}>
                    <span className="absolute top-1.5 left-1.5 z-10">
                      <CommunityScore value={media.averageScore} variant="badge" size="sm" />
                    </span>
                  </CoverImage>

                  <div className="mt-2.5 space-y-1.5">
                    <ProgressBar value={entry.progress} max={unitTotal} />
                    <p className="font-mono-num flex items-baseline justify-between gap-2 text-[0.625rem] text-ink-3">
                      <span>
                        {entry.progress}
                        <span className="text-ink-3/70">/{unitTotal ?? '?'}</span>
                      </span>
                      {pct != null && (
                        <span className="text-ink-2 transition-colors duration-300 group-hover/head:text-accent">
                          {pct}%
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>

      {total > 0 && <StatusRibbon counts={counts} kind={kind} className="mt-7" />}
    </section>
  )
}

const RIBBON_TONE: Record<EntryStatus, string> = {
  current: 'bg-watching',
  completed: 'bg-completed',
  planning: 'bg-planning',
  paused: 'bg-paused',
  dropped: 'bg-dropped',
}

/** The whole shelf as one line: proportion, not just counts. */
function StatusRibbon({
  counts,
  kind,
  className,
}: {
  counts: Record<EntryStatus, number>
  kind: MediaKind
  className?: string
}) {
  const present = STATUS_ORDER.filter((s) => counts[s] > 0)

  return (
    <div className={className}>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="presentation">
        {present.map((s) => (
          <span
            key={s}
            className={cn('h-full transition-[flex-grow] duration-700 ease-[var(--ease-out-expo)]', RIBBON_TONE[s])}
            style={{ flexGrow: counts[s] }}
            title={`${statusLabel(s, kind)} — ${counts[s]}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {present.map((s) => (
          <span key={s} className="label-cat label-cat-plain flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', RIBBON_TONE[s])} aria-hidden />
            {statusLabel(s, kind)}
            <span className="font-mono-num text-ink-2">{counts[s]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function GridView({ entries, map }: { entries: LibraryEntry[]; map: Map<number, MediaSummary> }) {
  return (
    <div className="grid-stagger poster-grid">
      {entries.map((entry, i) => {
        const media = map.get(entry.mediaId)
        return media ? (
          <MediaCard key={entry.mediaId} media={media} index={i} className="cv-auto" />
        ) : (
          <CoverSkeleton key={entry.mediaId} />
        )
      })}
    </div>
  )
}

function ListView({ entries, map }: { entries: LibraryEntry[]; map: Map<number, MediaSummary> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface px-5">
      {entries.map((entry, i) => {
        const media = map.get(entry.mediaId)
        return media ? (
          <MediaRow key={entry.mediaId} media={media} entry={entry} index={i} />
        ) : (
          <div key={entry.mediaId} className="h-[68px] border-b border-line last:border-0" />
        )
      })}
    </div>
  )
}

/**
 * Shelf mode — the default.
 *
 * One horizontal row per status, larger covers standing on a hairline, and the
 * status named in plain language. It is the view that makes the library read
 * as a bookcase rather than a table, so it is what you see first.
 */
function ShelfView({
  groups,
  entries,
  map,
  kind,
  status,
}: {
  groups: { status: EntryStatus; entries: LibraryEntry[] }[] | null
  entries: LibraryEntry[]
  map: Map<number, MediaSummary>
  kind: MediaKind
  status: EntryStatus | null
}) {
  const rows = groups ?? [{ status: status ?? 'current', entries }]

  return (
    <div className="space-y-14">
      {rows.map((row) => (
        <section key={row.status}>
          <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <h2 className="text-display-sm text-ink">{statusLabel(row.status, kind)}</h2>
            <span
              className="hidden h-px min-w-8 flex-1 translate-y-[-0.35em] bg-line sm:block"
              aria-hidden
            />
            <span className="font-mono-num text-meta text-ink-3">
              {pluralize(row.entries.length, 'title')}
            </span>
          </div>

          <Rail aria-label={statusLabel(row.status, kind)}>
            {row.entries.map((entry) => {
              const media = map.get(entry.mediaId)
              return media ? (
                <ShelfCover key={entry.mediaId} media={media} entry={entry} />
              ) : (
                <Skeleton
                  key={entry.mediaId}
                  className="aspect-[2/3] w-32 shrink-0 rounded-[3px] md:w-38"
                />
              )
            })}
          </Rail>

          <ShelfLine className="mt-2.5" />
        </section>
      ))}
    </div>
  )
}

function LibraryGridSkeleton() {
  return (
    <div className="poster-grid">
      {Array.from({ length: 12 }, (_, i) => (
        <CoverSkeleton key={i} />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function comparator(
  sort: LibrarySort,
  map: Map<number, MediaSummary>,
  language: ReturnType<typeof usePrefs.getState>['titleLanguage'],
) {
  return (a: LibraryEntry, b: LibraryEntry): number => {
    switch (sort) {
      case 'title': {
        const at = map.get(a.mediaId)
        const bt = map.get(b.mediaId)
        if (!at || !bt) return 0
        return displayTitle(at, language).localeCompare(displayTitle(bt, language))
      }
      case 'score':
        // Unrated sinks rather than sorting as zero.
        return (b.score ?? -1) - (a.score ?? -1)
      case 'progress':
        return b.progress - a.progress
      case 'added':
        return b.createdAt - a.createdAt
      default:
        return b.updatedAt - a.updatedAt
    }
  }
}
