import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { LayoutGrid, Library as LibraryIcon, List, Rows3, Search } from 'lucide-react'
import {
  Chip,
  CoverSkeleton,
  EmptyState,
  Input,
  MenuItem,
  MenuLabel,
  Popover,
  Rail,
  SegmentedControl,
  Button,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, kindCount, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { usePrefs, type LibrarySort, type ViewMode } from '@/data/store/prefs'
import { useEntriesOfKind, useRankedIds, useStatusCounts } from '@/data/store/selectors'
import { STATUS_ORDER, statusLabel, type EntryStatus, type LibraryEntry } from '@/data/store/types'
import { MediaCard, MediaRow, ShelfCover } from '@/features/tracking/cards'
import { cn } from '@/lib/cn'

const VIEWS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'shelf', label: 'Shelf', icon: Rows3 },
  { value: 'list', label: 'List', icon: List },
]

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'added', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'score', label: 'Your score' },
  { value: 'rank', label: 'Your ranking' },
  { value: 'progress', label: 'Progress' },
]

/**
 * Every filter lives in the URL, so any view of the library is linkable and
 * survives reload and back-navigation. Component state here would quietly break
 * both.
 */
export default function LibraryPage() {
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
  const rankedIds = useRankedIds(kind)
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
      .sort(comparator(sort, map, rankedIds, language))
  }, [entries, status, genre, query, sort, map, rankedIds, language])

  const grouped = useMemo(() => {
    if (status) return null
    return STATUS_ORDER.map((s) => ({
      status: s,
      entries: filtered.filter((e) => e.status === s),
    })).filter((group) => group.entries.length > 0)
  }, [filtered, status])

  const total = entries.length

  return (
    <div className="space-y-8">
      <header className="space-y-6 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display-lg text-ink">Library</h1>
            <p className="mt-1 text-body text-ink-3">{kindCount(kind, total)} tracked</p>
          </div>

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

        <SegmentedControl
          aria-label="Media type"
          value={kind}
          onChange={(next) => patch({ kind: next, genre: null })}
          segments={(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => ({
            value: k,
            label: KIND_LABEL[k],
          }))}
        />

        {/* Status filter doubles as the count summary. */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!status} onClick={() => patch({ status: null })}>
            All {total > 0 && <span className="tnum ml-1.5 opacity-60">{total}</span>}
          </Chip>
          {STATUS_ORDER.map((s) => (
            <Chip key={s} active={status === s} onClick={() => patch({ status: s })}>
              {statusLabel(s, kind)}
              {counts[s] > 0 && <span className="tnum ml-1.5 opacity-60">{counts[s]}</span>}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Filter by title"
              aria-label="Filter library by title"
              className="pl-9"
            />
          </div>

          <Popover
            align="start"
            role="menu"
            label="Sort"
            className="w-52"
            trigger={
              <Button size="md">
                Sort: {SORTS.find((s) => s.value === sort)?.label ?? 'Recently updated'}
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
              trigger={<Button size="md">{genre ?? 'All genres'}</Button>}
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
                    All genres
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
        </div>
      </header>

      {/* ------------------------------------------------------------ body */}

      {filtered.length === 0 ? (
        isLoading && total > 0 ? (
          <LibraryGridSkeleton />
        ) : (
          <EmptyState
            icon={<LibraryIcon className="size-7" strokeWidth={1.5} />}
            title={total === 0 ? `No ${KIND_LABEL[kind].toLowerCase()} yet` : 'Nothing matches'}
            description={
              total === 0
                ? 'Anything you add from Discover or search lands here.'
                : 'Try clearing a filter.'
            }
          />
        )
      ) : view === 'list' ? (
        <ListView entries={filtered} map={map} />
      ) : view === 'shelf' ? (
        <ShelfView groups={grouped} entries={filtered} map={map} kind={kind} status={status} />
      ) : (
        <GridView entries={filtered} map={map} showRank={sort === 'rank'} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function GridView({
  entries,
  map,
  showRank,
}: {
  entries: LibraryEntry[]
  map: Map<number, MediaSummary>
  showRank?: boolean
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
      {entries.map((entry) => {
        const media = map.get(entry.mediaId)
        return media ? (
          <MediaCard key={entry.mediaId} media={media} showRank={showRank} className="cv-auto" />
        ) : (
          <CoverSkeleton key={entry.mediaId} />
        )
      })}
    </div>
  )
}

function ListView({ entries, map }: { entries: LibraryEntry[]; map: Map<number, MediaSummary> }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5">
      {entries.map((entry) => {
        const media = map.get(entry.mediaId)
        return media ? (
          <MediaRow key={entry.mediaId} media={media} entry={entry} />
        ) : (
          <div key={entry.mediaId} className="h-[74px] border-b border-line last:border-0" />
        )
      })}
    </div>
  )
}

/**
 * Shelf mode: one horizontal row per status, larger covers, and a hairline
 * baseline under each row so it reads as a bookcase rather than a carousel.
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
    <div className="space-y-12">
      {rows.map((row) => (
        <section key={row.status}>
          <h2 className="mb-4 flex items-baseline gap-2.5 font-display text-display-sm text-ink">
            {statusLabel(row.status, kind)}
            <span className="tnum text-label font-normal text-ink-3">{row.entries.length}</span>
          </h2>

          <div className="relative">
            <Rail aria-label={statusLabel(row.status, kind)}>
              {row.entries.map((entry) => {
                const media = map.get(entry.mediaId)
                return media ? (
                  <ShelfCover key={entry.mediaId} media={media} entry={entry} />
                ) : (
                  <div key={entry.mediaId} className="w-36 shrink-0 md:w-40">
                    <CoverSkeleton />
                  </div>
                )
              })}
            </Rail>

            {/* The shelf itself: a hairline plus a soft shadow gradient. */}
            <div
              className={cn(
                'pointer-events-none mt-1 h-px w-full bg-line-strong',
                'after:block after:h-3 after:w-full after:bg-gradient-to-b after:from-ink/6 after:to-transparent',
              )}
              aria-hidden
            />
          </div>
        </section>
      ))}
    </div>
  )
}

function LibraryGridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
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
  rankedIds: number[],
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
      case 'rank': {
        const ai = rankedIds.indexOf(a.mediaId)
        const bi = rankedIds.indexOf(b.mediaId)
        if (ai === -1 && bi === -1) return b.updatedAt - a.updatedAt
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      }
      case 'progress':
        return b.progress - a.progress
      case 'added':
        return b.createdAt - a.createdAt
      default:
        return b.updatedAt - a.updatedAt
    }
  }
}
