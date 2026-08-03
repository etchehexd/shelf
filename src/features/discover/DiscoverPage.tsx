import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Compass, Search } from 'lucide-react'
import {
  Chip,
  CoverSkeleton,
  EmptyState,
  Input,
  Rail,
  SegmentedControl,
  Section,
  SectionHeader,
} from '@/design'
import { useMediaMap, useMediaSearch, useRecommendations } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { genreAffinity, useAllEntries, useEntriesOfKind, useTrackedIds } from '@/data/store/selectors'
import { MediaCard } from '@/features/tracking/cards'
import { scoreText } from '@/lib/format'

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const

function currentSeason(): { season: (typeof SEASONS)[number]; year: number } {
  const now = new Date()
  return { season: SEASONS[Math.floor(now.getMonth() / 3)], year: now.getFullYear() }
}

/**
 * No global popularity chart anywhere on this page. Every row is generated from
 * the user's own library and titled to say exactly why it's being shown — the
 * feeling should be "it knows what I like", not "here's what's trending".
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

  const affinity = useMemo(() => genreAffinity(allEntries, map, 6), [allEntries, map])

  /* The three highest-rated titles seed the "because you loved X" rows. Hooks
     can't be called in a loop over variable length, so three fixed slots. */
  const favourites = useMemo(
    () =>
      entries
        .filter((e) => e.score != null && e.score >= 8)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3),
    [entries],
  )

  const searching = query.trim().length >= 2

  return (
    <div className="space-y-14">
      <header className="space-y-6 pt-2">
        <div>
          <h1 className="font-display text-display-lg text-ink">Discover</h1>
          <p className="mt-1 max-w-prose text-body text-ink-3">
            Built from what you've already rated — not from what's popular this week.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Search all ${KIND_LABEL[kind].toLowerCase()} on AniList`}
              aria-label="Search AniList"
              className="pl-9"
            />
          </div>

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
          <div className="flex flex-wrap gap-2">
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
                  <span className="tnum ml-1.5 opacity-60">{scoreText(g.averageScore)}</span>
                )}
              </Chip>
            ))}
          </div>
        )}
      </header>

      {searching ? (
        <SearchResults query={query} kind={kind} />
      ) : genreFilter ? (
        <GenreRow genre={genreFilter} kind={kind} />
      ) : (
        <>
          {favourites[0] && (
            <BecauseRow
              mediaId={favourites[0].mediaId}
              title={map.get(favourites[0].mediaId)}
              score={favourites[0].score}
              language={language}
            />
          )}

          <ReadyToStart kind={kind} />

          {favourites[1] && (
            <BecauseRow
              mediaId={favourites[1].mediaId}
              title={map.get(favourites[1].mediaId)}
              score={favourites[1].score}
              language={language}
            />
          )}

          {affinity[0] && <ComfortZone genre={affinity[0].genre} kind={kind} score={affinity[0].averageScore} />}

          <SeasonalRow kind={kind} genres={affinity.slice(0, 2).map((g) => g.genre)} />

          {favourites[2] && (
            <BecauseRow
              mediaId={favourites[2].mediaId}
              title={map.get(favourites[2].mediaId)}
              score={favourites[2].score}
              language={language}
            />
          )}

          {favourites.length === 0 && affinity.length === 0 && (
            <EmptyState
              icon={<Compass className="size-7" strokeWidth={1.5} />}
              title="Rate a few things first"
              description="Recommendations here are built entirely from your own scores and genres, so this page fills in as your library does."
            />
          )}
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function SearchResults({ query, kind }: { query: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ search: query, kind, perPage: 30 })

  if (isLoading) return <GridSkeleton />

  if (!data || data.media.length === 0) {
    return (
      <EmptyState
        title={`Nothing found for "${query}"`}
        description="Try a different spelling, or the original romaji title."
      />
    )
  }

  return (
    <Section>
      <SectionHeader eyebrow="Results" title={`"${query}"`} description={`${data.total} on AniList`} />
      <Grid media={data.media} />
    </Section>
  )
}

function GenreRow({ genre, kind }: { genre: string; kind: MediaKind }) {
  const { data, isLoading } = useMediaSearch({ genres: [genre], kind, sort: 'score', perPage: 30 })

  return (
    <Section>
      <SectionHeader
        eyebrow="Your taste"
        title={genre}
        description={`The best-rated ${KIND_LABEL[kind].toLowerCase()} in a genre you keep coming back to.`}
      />
      {isLoading ? <GridSkeleton /> : <Grid media={data?.media ?? []} />}
    </Section>
  )
}

function BecauseRow({
  mediaId,
  title,
  score,
  language,
}: {
  mediaId: number
  title: MediaSummary | undefined
  score: number | null
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
}) {
  const { data, isLoading } = useRecommendations(mediaId, 16)

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <Section>
      <SectionHeader
        eyebrow="Because you rated"
        title={
          title ? (
            <>
              {displayTitle(title, language)}
              {score != null && <span className="ml-3 text-ink-3">{scoreText(score)}</span>}
            </>
          ) : (
            'a favourite'
          )
        }
        size="sm"
      />
      {isLoading ? <RailSkeleton /> : <MediaRail media={(data ?? []).map((r) => r.media)} />}
    </Section>
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

  // A header over an empty rail reads as a bug, not as "nothing matched".
  if (!isLoading && !data?.media.length) return null

  return (
    <Section>
      <SectionHeader
        eyebrow="Your comfort zone"
        title={genre}
        description={
          score != null
            ? `You average ${scoreText(score)} on these — the highest of any genre you track.`
            : undefined
        }
        size="sm"
      />
      {isLoading ? <RailSkeleton /> : <MediaRail media={data?.media ?? []} />}
    </Section>
  )
}

function SeasonalRow({ kind, genres }: { kind: MediaKind; genres: string[] }) {
  const { season, year } = currentSeason()
  const isAnime = kind === 'anime'

  // Only the single strongest genre. AniList treats `genre_in` as a conjunction
  // here, so stacking two of them against one 12-week season reliably returns
  // nothing — a personalised row that is always empty is worse than no row.
  const topGenre = genres[0]

  const { data, isLoading } = useMediaSearch({
    kind,
    genres: topGenre ? [topGenre] : undefined,
    season: isAnime ? season : undefined,
    seasonYear: isAnime ? year : undefined,
    sort: 'popularity',
    perPage: 16,
    enabled: isAnime,
  })

  if (!isAnime) return null
  if (!isLoading && !data?.media.length) return null

  return (
    <Section>
      <SectionHeader
        eyebrow="Airing now"
        title="This season, in your genres"
        description={topGenre ? `Filtered to ${topGenre} — the genre you rate highest.` : undefined}
        size="sm"
      />
      {isLoading ? <RailSkeleton /> : <MediaRail media={data?.media ?? []} />}
    </Section>
  )
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
    <Section>
      <SectionHeader
        eyebrow="From your planning list"
        title="Ready when you are"
        description="You already said you'd get to these."
        size="sm"
      />
      {media.length === 0 ? <RailSkeleton /> : <MediaRail media={media} />}
    </Section>
  )
}

/* -------------------------------------------------------------------------- */

function MediaRail({ media }: { media: MediaSummary[] }) {
  if (media.length === 0) return null
  return (
    <Rail aria-label="Recommendations" gap="sm">
      {media.map((m) => (
        <div key={m.id} className="w-32 shrink-0 md:w-36">
          <MediaCard media={m} showProgress={false} />
        </div>
      ))}
    </Rail>
  )
}

function Grid({ media }: { media: MediaSummary[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
      {media.map((m) => (
        <MediaCard key={m.id} media={m} showProgress={false} className="cv-auto" />
      ))}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
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
        <div key={i} className="w-32 shrink-0 md:w-36">
          <CoverSkeleton />
        </div>
      ))}
    </div>
  )
}
