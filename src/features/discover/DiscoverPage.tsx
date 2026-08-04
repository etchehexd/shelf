import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Compass } from 'lucide-react'
import {
  Chip,
  CoverSkeleton,
  EmptyState,
  Rail,
  SearchInput,
  SegmentedControl,
  Section,
  SectionHeader,
} from '@/design'
import { useMediaMap, useMediaSearch, useRecommendations } from '@/data/anilist/hooks'
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
  const genreFilter = params.get('genre')

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
              merged.delete('genre')
              setParams(merged, { replace: true })
            }}
            segments={(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => ({
              value: k,
              label: KIND_LABEL[k],
            }))}
          />
        </div>

        {affinity.length > 0 && !searching && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-cat mr-1">Genres</span>
            {affinity.map((g) => (
              <Chip
                key={g.genre}
                active={genreFilter === g.genre}
                onClick={() => {
                  const merged = new URLSearchParams(params)
                  if (genreFilter === g.genre) merged.delete('genre')
                  else merged.set('genre', g.genre)
                  setParams(merged, { replace: true })
                }}
              >
                {g.genre}
                {g.averageScore != null && (
                  <span className="font-mono-num ml-1.5 opacity-60">
                    {scoreText(g.averageScore)}
                  </span>
                )}
              </Chip>
            ))}
          </div>
        )}
      </header>

      {searching ? (
        <SearchResults query={query} kind={kind} />
      ) : genreFilter ? (
        <GenreShelf genre={genreFilter} kind={kind} />
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

function SearchResults({ query, kind }: { query: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ search: query, kind, perPage: 30 })

  if (isLoading) return <GridSkeleton />

  if (!data || data.media.length === 0) {
    return <EmptyState title={`Nothing found for “${query}”`} />
  }

  return (
    <Section>
      <SectionHeader
        title={`“${query}”`}
        action={<span className="label-cat label-cat-plain">{data.total} results</span>}
      />
      <Grid media={data.media} />
    </Section>
  )
}

function GenreShelf({ genre, kind }: { genre: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ genres: [genre], kind, sort: 'score', perPage: 30 })

  return (
    <Section>
      <SectionHeader title={genre} />
      {isLoading ? <GridSkeleton /> : <Grid media={data?.media ?? []} />}
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
      <SectionHeader
        title={
          source ? (
            <>
              Recommended Because You Loved{' '}
              <span className="text-accent">{displayTitle(source, language)}</span>
            </>
          ) : (
            'Recommended For You'
          )
        }
      />
      <FeatureCard media={first} height="lg" layered={rest.slice(0, 3)} />
      {rest.length > 0 && (
        <div className="pt-1">
          <MediaRail media={rest} />
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

  return (
    <Shelf
      title={`Best in ${genre}`}
      meta={score != null ? `you average ${scoreText(score)}` : undefined}
      loading={isLoading}
      media={data?.media ?? []}
    />
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

  return <Shelf title="Hidden Gems" meta={genre.toLowerCase()} loading={isLoading} media={gems} />
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
    />
  )
}

/** The third-favorite genre, sorted by score — the one you forgot you liked. */
function DeepCut({ genre, kind }: { genre: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ genres: [genre], kind, sort: 'score', perPage: 16 })

  return <Shelf title={`More ${genre}`} loading={isLoading} media={data?.media ?? []} />
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
 * One shelf: a plain title, an optional word of provenance in the catalog
 * voice, and a rail of covers standing on a hairline. Every section on this
 * page is one of these.
 */
function Shelf({
  title,
  meta,
  media,
  loading,
}: {
  title: ReactNode
  /** A quiet aside in the catalog voice — a genre, an average. Never a sentence. */
  meta?: string
  media: MediaSummary[]
  loading?: boolean
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
      {loading ? <RailSkeleton /> : <MediaRail media={media} />}
    </Section>
  )
}

function MediaRail({ media }: { media: MediaSummary[] }) {
  if (media.length === 0) return null
  return (
    <Rail aria-label="Recommendations" gap="sm">
      {media.map((m, i) => (
        <div key={m.id} className="w-30 shrink-0 md:w-34">
          <MediaCard media={m} showProgress={false} index={i} />
        </div>
      ))}
    </Rail>
  )
}

/** The first cell spans two columns, so a wall of results opens with a hero. */
function Grid({ media }: { media: MediaSummary[] }) {
  return (
    <div className="poster-grid poster-grid-lead">
      {media.map((m, i) => (
        <MediaCard key={m.id} media={m} showProgress={false} index={i} className="cv-auto" />
      ))}
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
