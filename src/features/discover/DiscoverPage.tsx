import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Compass, SearchX } from 'lucide-react'
import {
  ArtBand,
  Chip,
  CoverSkeleton,
  EmptyState,
  LeanRow,
  SearchInput,
  SegmentedControl,
  Section,
  SectionHeader,
  ShelfRail,
  usePageAccent,
  useResolvedTheme,
} from '@/design'
import {
  hasFilters,
  useMediaMap,
  useMediaSearch,
  useRecommendations,
  useTitleSearch,
  type MediaFilters,
} from '@/data/anilist/hooks'
import type { SortKey } from '@/data/anilist/queries'
import { FilterBar } from './FilterBar'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { genreAffinity, useAllEntries, useEntriesOfKind, useTrackedIds } from '@/data/store/selectors'
import { FeatureCard, MediaCard } from '@/features/tracking/cards'
import { scoreText } from '@/lib/format'

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const

function currentSeason(): { season: (typeof SEASONS)[number]; year: number } {
  const now = new Date()
  return { season: SEASONS[Math.floor(now.getMonth() / 3)], year: now.getFullYear() }
}

/* ---------------------------------------------------------- filters in the URL --
 *
 * Filters live in the query string rather than in component state so that a
 * narrowed view is a real place: it survives a reload, it can be sent to
 * somebody, and the back button walks out of it one constraint at a time.
 * Repeated keys carry the multi-selects, which keeps the encoding readable —
 * ?genre=Action&genre=Comedy — instead of inventing a delimiter that then has
 * to be escaped out of genre names.
 */

function filtersFromParams(params: URLSearchParams): MediaFilters {
  const num = (key: string): number | undefined => {
    const raw = params.get(key)
    if (raw == null) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }

  return {
    genres: params.getAll('genre'),
    formats: params.getAll('format'),
    statuses: params.getAll('status'),
    yearFrom: num('from'),
    yearTo: num('to'),
    scoreFrom: num('min'),
  }
}

function paramsWithFilters(params: URLSearchParams, filters: MediaFilters): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of ['genre', 'format', 'status', 'from', 'to', 'min']) next.delete(key)

  for (const g of filters.genres ?? []) next.append('genre', g)
  for (const f of filters.formats ?? []) next.append('format', f)
  for (const s of filters.statuses ?? []) next.append('status', s)
  if (filters.yearFrom != null) next.set('from', String(filters.yearFrom))
  if (filters.yearTo != null) next.set('to', String(filters.yearTo))
  if (filters.scoreFrom != null) next.set('min', String(filters.scoreFrom))

  return next
}

/**
 * No global popularity chart anywhere on this page.
 *
 * Every shelf is generated from the user's own library and titled to say
 * exactly why it is being shown — the feeling should be "someone who knows my
 * taste laid this out", not "here is what is trending". Shelves alternate
 * between rails, grids and a full-width spotlight so that scrolling the page
 * feels like walking past differently-arranged tables in a bookshop rather
 * than paging through a feed.
 */
export default function DiscoverPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const kind = (params.get('kind') as MediaKind) || 'anime'
  const sort = (params.get('sort') as SortKey) || 'trending'

  const filters = useMemo(() => filtersFromParams(params), [params])
  const filtering = hasFilters(filters)

  const setFilters = useCallback(
    (next: MediaFilters) => setParams(paramsWithFilters(params, next), { replace: true }),
    [params, setParams],
  )

  const [draft, setDraft] = useState(query)
  const language = usePrefs((s) => s.titleLanguage)

  // Debounced so typing doesn't burn the AniList rate budget.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const merged = new URLSearchParams(params)
      if (draft) merged.set('q', draft)
      else merged.delete('q')
      setParams(merged, { replace: true })
    }, 300)
    return () => window.clearTimeout(id)
  }, [draft])

  const entries = useEntriesOfKind(kind)
  const allEntries = useAllEntries()
  const trackedIds = useTrackedIds()
  const { map } = useMediaMap(trackedIds)

  const affinity = useMemo(() => genreAffinity(allEntries, map, 8), [allEntries, map])

  /* The highest-rated titles seed the "because you loved X" shelves. Hooks
     can't be called in a loop over variable length, so three fixed slots. */
  const favorites = useMemo(
    () =>
      entries
        .filter((e) => e.score != null && e.score >= 8)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3),
    [entries],
  )

  const searching = query.trim().length >= 2
  const hasTaste = favorites.length > 0 || affinity.length > 0

  // Whatever is at the top of the page colors the rest of it.
  const accentSource = favorites[0] ? map.get(favorites[0].mediaId) : undefined
  usePageAccent(accentSource?.color, useResolvedTheme())

  return (
    <div className="space-y-14 pt-1">
      <header className="space-y-7">
        <div className="border-b border-line pb-7">
          <h1 className="text-display-lg text-ink">Discover</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Search ${KIND_LABEL[kind].toLowerCase()}`}
            aria-label="Search"
            className="flex-1 sm:max-w-md"
          />

          <SegmentedControl
            aria-label="Media type"
            value={kind}
            onChange={(next) => {
              const merged = new URLSearchParams(params)
              merged.set('kind', next)
              // Formats are per-kind enums, so carrying them across would ask
              // upstream for TV manga. Everything else survives the switch.
              merged.delete('format')
              setParams(merged, { replace: true })
            }}
            segments={(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => ({
              value: k,
              label: KIND_LABEL[k],
            }))}
          />
        </div>

        <FilterBar
          kind={kind}
          filters={filters}
          onChange={setFilters}
          showSort={!searching}
          sort={sort}
          onSortChange={(next) => {
            const merged = new URLSearchParams(params)
            merged.set('sort', next)
            setParams(merged, { replace: true })
          }}
        />

        {/* Your own strongest genres, one tap away. These sit below the
            general controls because they are a shortcut into them, not a
            second filtering system. */}
        {affinity.length > 0 && !searching && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-cat mr-1">Your genres</span>
            {affinity.map((g) => {
              const on = (filters.genres ?? []).includes(g.genre)
              return (
                <Chip
                  key={g.genre}
                  active={on}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      genres: on
                        ? (filters.genres ?? []).filter((x) => x !== g.genre)
                        : [...(filters.genres ?? []), g.genre],
                    })
                  }
                >
                  {g.genre}
                  {g.averageScore != null && (
                    <span className="font-mono-num ml-1.5 opacity-60">
                      {scoreText(g.averageScore)}
                    </span>
                  )}
                </Chip>
              )
            })}
          </div>
        )}
      </header>

      {searching ? (
        <SearchResults query={query} kind={kind} filters={filters} />
      ) : filtering ? (
        <FilteredResults kind={kind} filters={filters} sort={sort} />
      ) : !hasTaste ? (
        <EmptyState
          icon={<Compass className="size-6" strokeWidth={1.5} />}
          title="Recommendations appear once you've rated something"
          description="Search above to add your first title."
        />
      ) : (
        <div className="space-y-16">
          {/* The lead: one title, full width, with the reason spelled out. */}
          {favorites[0] && (
            <BecauseLead
              mediaId={favorites[0].mediaId}
              source={map.get(favorites[0].mediaId)}
              language={language}
            />
          )}

          {/* Forms alternate deliberately down the page — rail, lean, grid,
              rail — so no two adjacent sections share a silhouette. This is
              the whole difference between "a bookshop" and "a feed". */}
          <ReadyToStart kind={kind} />

          {affinity[0] && (
            <ComfortZone genre={affinity[0].genre} kind={kind} score={affinity[0].averageScore} />
          )}

          {favorites[1] && (
            <BecauseShelf
              mediaId={favorites[1].mediaId}
              source={map.get(favorites[1].mediaId)}
              language={language}
            />
          )}

          <SeasonalShelf kind={kind} genre={affinity[0]?.genre} />

          {affinity[1] && <HiddenGems genre={affinity[1].genre} kind={kind} />}

          <ShortEnough kind={kind} genre={affinity[0]?.genre} />

          {favorites[2] && (
            <BecauseShelf
              mediaId={favorites[2].mediaId}
              source={map.get(favorites[2].mediaId)}
              language={language}
            />
          )}

          {affinity[2] && <DeepCut genre={affinity[2].genre} kind={kind} />}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Search results, ordered here rather than upstream.
 *
 * `useTitleSearch` asks for several spellings of the query at once and ranks
 * the merged pool locally against every name a title carries, which is what
 * makes "rezero", "re zero" and "Re:Zero" one search and what puts One Piece
 * at the top of "one".
 */
function SearchResults({
  query,
  kind,
  filters,
}: {
  query: string
  kind: MediaKind
  filters: MediaFilters
}) {
  const { media, isLoading } = useTitleSearch({ query, kind, filters })

  if (isLoading && media.length === 0) return <GridSkeleton />

  if (media.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="size-6" strokeWidth={1.5} />}
        title={`Nothing found for “${query}”`}
        description={
          hasFilters(filters)
            ? 'The filters above may be narrowing this to nothing — try clearing them.'
            : 'Try fewer words, or the title as it is spelled on the cover.'
        }
      />
    )
  }

  return (
    <Section>
      <SectionHeader
        title={`“${query}”`}
        action={
          <span className="label-cat label-cat-plain">
            {media.length} {media.length === 1 ? 'result' : 'results'}
          </span>
        }
      />
      <Grid media={media} />
    </Section>
  )
}

/** Browsing with the filter bar set and no text query. */
function FilteredResults({
  kind,
  filters,
  sort,
}: {
  kind: MediaKind
  filters: MediaFilters
  sort: SortKey
}) {
  const { data, isLoading } = useMediaSearch({ kind, sort, perPage: 40, ...filters })
  const media = data?.media ?? []

  const title = [
    (filters.genres ?? []).join(' + '),
    filters.scoreFrom != null ? `${filters.scoreFrom.toFixed(1)}+` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Section>
      <SectionHeader
        title={title || 'Filtered'}
        action={
          !isLoading ? (
            <span className="label-cat label-cat-plain">
              {data?.total ?? media.length} matching
            </span>
          ) : undefined
        }
      />
      {isLoading ? (
        <GridSkeleton />
      ) : media.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" strokeWidth={1.5} />}
          title="Nothing matches all of those"
          description="Loosen one of the filters above and the shelf fills back up."
        />
      ) : (
        <Grid media={media} />
      )}
    </Section>
  )
}

/**
 * The page's focal point.
 *
 * One recommendation at hero scale with the rest of its shelf underneath. The
 * title says exactly where it came from — "Recommended Because You Loved X" —
 * which is information, not personality, and it is the one line on the page
 * that earns its place.
 */
function BecauseLead({
  mediaId,
  source,
  language,
}: {
  mediaId: number
  source: MediaSummary | undefined
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
}) {
  const { data, isLoading } = useRecommendations(mediaId, 16)

  if (isLoading) return <RailSkeleton />
  if (!data || data.length === 0) return null

  const [first, ...rest] = data.map((r) => r.media)

  return (
    <Section>
      {/* The provenance moved into the eyebrow.
          "Recommended Because You Loved Re:ZERO -Starting Life in Another
          World-" set at display-md is eleven words of headline that runs the
          full width of the page and shoves the section rule off the end. The
          heading is the claim; *why* is a caption. */}
      <SectionHeader
        eyebrow={source ? <>Because you loved {displayTitle(source, language)}</> : undefined}
        title="Recommended For You"
      />
      <FeatureCard media={first} height="lg" layered={rest.slice(0, 3)} />
      {rest.length > 0 && (
        <div className="pt-1">
          <ShelfBody media={rest} form="rail" />
        </div>
      )}
    </Section>
  )
}

function BecauseShelf({
  mediaId,
  source,
  language,
}: {
  mediaId: number
  source: MediaSummary | undefined
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
}) {
  const { data, isLoading } = useRecommendations(mediaId, 16)

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <Shelf
      title={source ? `More Like ${displayTitle(source, language)}` : 'More Like Your Favorites'}
      loading={isLoading}
      media={(data ?? []).map((r) => r.media)}
      form="lean"
    />
  )
}

function ComfortZone({
  genre,
  kind,
  score,
}: {
  genre: string
  kind: MediaKind
  score: number | null
}) {
  const { data, isLoading } = useMediaSearch({ genres: [genre], kind, sort: 'score', perPage: 16 })
  const media = data?.media ?? []

  // The page's one art-wash band. It sits on the shelf that is *about* the
  // user's taste rather than about a catalog slice, and it takes its color
  // from the best title in that genre — so the section is literally tinted by
  // the thing it is recommending.
  if (!isLoading && media.length === 0) return null

  return (
    <ArtBand src={media[0]?.coverImage} bleed>
      <Section>
        <SectionHeader
          title={`Best in ${genre}`}
          size="sm"
          action={
            score != null ? (
              <span className="label-cat label-cat-plain">you average {scoreText(score)}</span>
            ) : undefined
          }
        />
        {isLoading ? <RailSkeleton /> : <ShelfBody media={media} form="lean" />}
      </Section>
    </ArtBand>
  )
}

/**
 * Well-reviewed and barely watched: sorted by score, then skipping the front
 * table entirely — which is the whole point of the shelf, and something a
 * popularity chart can never show you.
 */
function HiddenGems({ genre, kind }: { genre: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ genres: [genre], kind, sort: 'score', perPage: 50 })

  const gems = useMemo(
    () => (data?.media ?? []).filter((m) => (m.averageScore ?? 0) >= 72).slice(6, 22),
    [data],
  )

  return (
    <Shelf title="Hidden Gems" meta={genre.toLowerCase()} loading={isLoading} media={gems} form="grid" />
  )
}

function SeasonalShelf({ kind, genre }: { kind: MediaKind; genre?: string }) {
  const { season, year } = currentSeason()
  const isAnime = kind === 'anime'

  // Only the single strongest genre. AniList treats `genre_in` as a conjunction
  // here, so stacking two of them against one 12-week season reliably returns
  // nothing — a personalized shelf that is always empty is worse than no shelf.
  const { data, isLoading } = useMediaSearch({
    kind,
    genres: genre ? [genre] : undefined,
    season: isAnime ? season : undefined,
    seasonYear: isAnime ? year : undefined,
    sort: 'popularity',
    perPage: 16,
    enabled: isAnime,
  })

  if (!isAnime) return null

  return (
    <Shelf
      title="Airing This Season"
      meta={genre?.toLowerCase()}
      loading={isLoading}
      media={data?.media ?? []}
    />
  )
}

/** Short runs and films — the shelf for a free evening rather than a project. */
function ShortEnough({ kind, genre }: { kind: MediaKind; genre?: string }) {
  const { data, isLoading } = useMediaSearch({
    kind,
    genres: genre ? [genre] : undefined,
    sort: 'score',
    perPage: 50,
  })

  const short = useMemo(() => {
    const list = data?.media ?? []
    if (kind === 'anime') {
      return list.filter((m) => m.format === 'MOVIE' || (m.episodes != null && m.episodes <= 13))
    }
    if (kind === 'novel') return list.filter((m) => m.volumes != null && m.volumes <= 5)
    return list.filter((m) => m.chapters != null && m.chapters <= 60)
  }, [data, kind])

  return (
    <Shelf
      title="Short Enough to Finish Tonight"
      loading={isLoading}
      media={short.slice(0, 16)}
      form="lean"
    />
  )
}

/** The third-favorite genre, sorted by score — the one you forgot you liked. */
function DeepCut({ genre, kind }: { genre: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ genres: [genre], kind, sort: 'score', perPage: 16 })

  return <Shelf title={`More ${genre}`} loading={isLoading} media={data?.media ?? []} form="grid" />
}

/** Your own planning list, surfaced so it stops being a graveyard. */
function ReadyToStart({ kind }: { kind: MediaKind }) {
  const entries = useEntriesOfKind(kind)
  const planning = useMemo(
    () => entries.filter((e) => e.status === 'planning').sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  )
  const { map } = useMediaMap(useMemo(() => planning.map((e) => e.mediaId), [planning]))

  if (planning.length === 0) return null

  const media = planning.map((e) => map.get(e.mediaId)).filter(Boolean) as MediaSummary[]

  return (
    <Shelf
      title="On Your Planning List"
      loading={media.length === 0}
      media={media}
    />
  )
}

/* -------------------------------------------------------------------------- */

/**
 * One shelf, in one of three forms.
 *
 * Every section on this page used to be the same thing: a title over a rail of
 * identical 34-wide posters. Nine of those in a column is a feed, and a feed is
 * exactly what this page is not supposed to be — the brief for Discover is
 * "walking past differently-arranged tables in a bookshop".
 *
 * So a shelf now declares its `form`, and the page alternates:
 *
 *   rail   graduated widths on a shelf line — the lead cover is largest, so
 *          the row has a reading direction instead of being a table
 *   lean   covers tucked behind each other, spreading on hover
 *   grid   a staggered wall, for shelves deep enough to browse rather than scan
 *
 * The forms are visually distinct at a glance, which is the entire point: you
 * can tell one section from the next without reading either heading.
 */
type ShelfForm = 'rail' | 'lean' | 'grid'

function Shelf({
  title,
  meta,
  media,
  loading,
  form = 'rail',
}: {
  title: ReactNode
  /** A quiet aside in the catalog voice — a genre, an average. Never a sentence. */
  meta?: string
  media: MediaSummary[]
  loading?: boolean
  form?: ShelfForm
}) {
  // A header over an empty rail reads as a bug, not as "nothing matched".
  if (!loading && media.length === 0) return null

  return (
    <Section>
      <SectionHeader
        title={title}
        size="sm"
        action={meta ? <span className="label-cat label-cat-plain">{meta}</span> : undefined}
      />
      {loading ? <RailSkeleton /> : <ShelfBody media={media} form={form} />}
    </Section>
  )
}

function ShelfBody({ media, form }: { media: MediaSummary[]; form: ShelfForm }) {
  if (media.length === 0) return null

  if (form === 'lean') {
    // Capped: the lean only reads when the whole row is visible leaning, and
    // an eight-cover row is already wider than most of the column.
    return (
      <LeanRow aria-label="Recommendations" size="md">
        {media.slice(0, 8).map((m) => (
          <MediaCard key={m.id} media={m} showProgress={false} bare />
        ))}
      </LeanRow>
    )
  }

  if (form === 'grid') {
    return (
      <div className="poster-grid grid-stagger">
        {media.slice(0, 12).map((m, i) => (
          <MediaCard key={m.id} media={m} showProgress={false} index={i} className="cv-auto" />
        ))}
      </div>
    )
  }

  return (
    <ShelfRail aria-label="Recommendations" size="md" gap="sm">
      {media.map((m, i) => (
        <MediaCard key={m.id} media={m} showProgress={false} index={i} />
      ))}
    </ShelfRail>
  )
}

/**
 * A wall of results that opens with a hero.
 *
 * The lead used to be the same poster as everything else, spanning two grid
 * cells. That was wrong twice over. Visually it made the page one shape at two
 * sizes, which is the definition of a boxy grid. And technically it rendered a
 * 430px-wide cover at 370 CSS pixels — 555 device pixels on a normal laptop —
 * so the one image the eye landed on first was the softest thing on the page.
 * There is no larger poster upstream; the fix is to stop asking a poster to be
 * a billboard.
 *
 * `FeatureCard` uses the landscape banner instead, which is 1900px wide and
 * therefore genuinely sharp at hero scale, and keeps the poster at its native
 * size in front of it. Different shape, different artwork, correct resolution —
 * one change that answers the rhythm problem and the sharpness problem.
 */
function Grid({ media }: { media: MediaSummary[] }) {
  const [lead, ...rest] = media

  // Below five results a hero is just a big first row — there is no wall for
  // it to lead, and the page reads as though the search half-failed.
  if (!lead || media.length < 5) {
    return (
      <div className="poster-grid">
        {media.map((m, i) => (
          <MediaCard key={m.id} media={m} showProgress={false} index={i} className="cv-auto" />
        ))}
      </div>
    )
  }

  // Three tiers, not one wall. The ranker already knows which results are
  // strong and which are the tail, and rendering all of them at identical size
  // throws that information away — the wall was the same shape whether the
  // fourth result was a perfect match or a fuzzy guess.
  const strong = rest.slice(0, 6)
  const tail = rest.slice(6)

  return (
    <div className="space-y-10">
      <FeatureCard media={lead} eyebrow="Best match" layered={rest.slice(0, 3)} />

      {strong.length > 0 && (
        <Section>
          <SectionHeader title="Also matching" size="sm" bare />
          <LeanRow aria-label="Strong matches" size="md">
            {strong.map((m) => (
              <MediaCard key={m.id} media={m} showProgress={false} bare />
            ))}
          </LeanRow>
        </Section>
      )}

      {tail.length > 0 && (
        <Section>
          <SectionHeader
            title="Everything else"
            size="sm"
            action={<span className="label-cat label-cat-plain">{tail.length} more</span>}
          />
          <div className="poster-grid grid-stagger">
            {tail.map((m, i) => (
              <MediaCard key={m.id} media={m} showProgress={false} index={i} className="cv-auto" />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="poster-grid">
      {Array.from({ length: 12 }, (_, i) => (
        <CoverSkeleton key={i} />
      ))}
    </div>
  )
}

function RailSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="w-30 shrink-0 md:w-34">
          <CoverSkeleton />
        </div>
      ))}
    </div>
  )
}
