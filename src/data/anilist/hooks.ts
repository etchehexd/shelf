import { useMemo } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { anilist } from './client'
import {
  GENRES_QUERY,
  MEDIA_BY_IDS_QUERY,
  MEDIA_DETAIL_QUERY,
  RECOMMENDATIONS_QUERY,
  SEARCH_QUERY,
  SORT_OPTIONS,
  kindFilters,
  type SortKey,
} from './queries'
import { normalizeMedia, normalizeSummary, type RawMedia } from './normalize'
import { queryVariants, rankBy, repairVariants } from '@/lib/search'
import type { Media, MediaKind, MediaSummary } from './types'

export const mediaKeys = {
  detail: (id: number) => ['media', id] as const,
  batch: (ids: number[]) => ['media-batch', ids] as const,
  search: (params: unknown) => ['media-search', params] as const,
  recommendations: (id: number) => ['media-recs', id] as const,
  genres: () => ['genres'] as const,
}

/* -------------------------------------------------------------------------- */

export function useMedia(id: number | null | undefined) {
  return useQuery({
    queryKey: mediaKeys.detail(id ?? 0),
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const data = await anilist<{ Media: RawMedia }>(MEDIA_DETAIL_QUERY, { id }, signal)
      return normalizeMedia(data.Media)
    },
  })
}

/**
 * Warm the detail cache on card hover so opening a media page is instant. Cheap
 * because the client de-duplicates in-flight requests — hovering the same card
 * repeatedly costs one request.
 */
export function usePrefetchMedia() {
  const client = useQueryClient()

  return (id: number) => {
    client.prefetchQuery({
      queryKey: mediaKeys.detail(id),
      queryFn: async ({ signal }) => {
        const data = await anilist<{ Media: RawMedia }>(MEDIA_DETAIL_QUERY, { id }, signal)
        return normalizeMedia(data.Media)
      },
    })
  }
}

/* -------------------------------------------------------------------------- */

const CHUNK = 50

function chunk(ids: number[]): number[][] {
  const out: number[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) out.push(ids.slice(i, i + CHUNK))
  return out
}

/**
 * Library hydration: turns a list of media ids into a lookup map.
 *
 * Chunked at AniList's page size so a 400-title library costs 8 requests rather
 * than 400. Ids are sorted so that adding one entry doesn't invalidate every
 * chunk's cache key.
 */
export function useMediaMap(ids: number[]) {
  const chunks = useMemo(() => chunk([...new Set(ids)].sort((a, b) => a - b)), [ids])

  const results = useQueries({
    queries: chunks.map((group) => ({
      queryKey: mediaKeys.batch(group),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const data = await anilist<{ Page: { media: RawMedia[] } }>(
          MEDIA_BY_IDS_QUERY,
          { ids: group, perPage: CHUNK },
          signal,
        )
        return data.Page.media.map(normalizeSummary)
      },
    })),
  })

  return useMemo(() => {
    const map = new Map<number, MediaSummary>()
    for (const r of results) {
      for (const m of r.data ?? []) map.set(m.id, m)
    }
    return {
      map,
      isLoading: results.some((r) => r.isLoading),
      isError: results.every((r) => r.isError) && results.length > 0,
    }
  }, [results])
}

/** Convenience for a single lookup that reuses whatever the batch already cached. */
export function useMediaSummary(id: number | null | undefined) {
  const { map, isLoading } = useMediaMap(id ? [id] : [])
  return { media: id ? map.get(id) : undefined, isLoading }
}

/* -------------------------------------------------------------------------- */

/**
 * The narrowing controls, in the units the interface speaks.
 *
 * `scoreFrom` / `scoreTo` are on the 0–10 scale the product displays; the
 * conversion to the upstream 0–100 happens once, here, so no screen has to
 * remember which scale it is holding.
 */
export interface MediaFilters {
  genres?: string[]
  /** Upstream format enums — TV, MOVIE, OVA, MANGA, NOVEL… */
  formats?: string[]
  /** Release-year range, inclusive at both ends. */
  yearFrom?: number
  yearTo?: number
  /** Community score range, 0–10, inclusive. */
  scoreFrom?: number
  scoreTo?: number
  statuses?: string[]
}

/** True when a filter set would actually narrow anything. */
export function hasFilters(f: MediaFilters | undefined): boolean {
  if (!f) return false
  return Boolean(
    f.genres?.length ||
      f.formats?.length ||
      f.yearFrom != null ||
      f.yearTo != null ||
      f.scoreFrom != null ||
      f.scoreTo != null ||
      f.statuses?.length,
  )
}

export interface SearchParams extends MediaFilters {
  search?: string
  kind?: MediaKind
  season?: string
  seasonYear?: number
  sort?: SortKey
  page?: number
  perPage?: number
  enabled?: boolean
}

/**
 * Turns the app's filter vocabulary into upstream's.
 *
 * `format_in` from the filter wins over the kind's default formats, so
 * "Manga → Light novel" narrows rather than contradicting itself, and an empty
 * selection falls back to whatever the kind implies.
 */
function buildVariables({
  search,
  kind = 'anime',
  genres,
  formats,
  yearFrom,
  yearTo,
  scoreFrom,
  scoreTo,
  statuses,
  season,
  seasonYear,
  sort = 'trending',
  page = 1,
  perPage = 24,
}: SearchParams) {
  const kindDefaults = kindFilters(kind)

  return {
    search: search || undefined,
    type: kindDefaults.type,
    formats: formats?.length ? formats : kindDefaults.formats,
    genres: genres?.length ? genres : undefined,
    season,
    seasonYear,
    // Packed yyyymmdd. `_greater` / `_lesser` are exclusive upstream, so the
    // bounds step one day outside the range the user asked for — otherwise
    // "2015 to 2015" silently excludes all of 2015.
    yearFrom: yearFrom != null ? yearFrom * 10000 : undefined,
    yearTo: yearTo != null ? yearTo * 10000 + 1232 : undefined,
    scoreFrom: scoreFrom != null ? Math.round(scoreFrom * 10) - 1 : undefined,
    scoreTo: scoreTo != null ? Math.round(scoreTo * 10) + 1 : undefined,
    statuses: statuses?.length ? statuses : undefined,
    // A text search must sort by match quality; a browse must not.
    sort: search ? SORT_OPTIONS.relevance : SORT_OPTIONS[sort],
    page,
    perPage,
  }
}

async function runSearch(variables: ReturnType<typeof buildVariables>, signal: AbortSignal) {
  const data = await anilist<{
    Page: { pageInfo: { hasNextPage: boolean; total: number }; media: RawMedia[] }
  }>(SEARCH_QUERY, variables, signal)

  return {
    media: data.Page.media.map(normalizeSummary),
    hasNextPage: data.Page.pageInfo.hasNextPage,
    total: data.Page.pageInfo.total,
  }
}

export function useMediaSearch(params: SearchParams) {
  const { search, enabled = true } = params
  const variables = buildVariables(params)

  return useQuery({
    queryKey: mediaKeys.search(variables),
    enabled: enabled && (search == null || search.length === 0 || search.length >= 2),
    // Search results churn; browse results don't.
    staleTime: search ? 5 * 60 * 1000 : 60 * 60 * 1000,
    queryFn: ({ signal }) => runSearch(variables, signal),
  })
}

/* ------------------------------------------------------------ title search -- */

/**
 * The search people actually use.
 *
 * Four things happen here that a single upstream query cannot do:
 *
 *  1. **Several spellings at once.** "rezero" returns nothing upstream because
 *     nothing is stored under that string; "re zero" returns everything.
 *     `queryVariants` produces the plausible spellings and all of them are
 *     fetched in parallel.
 *  2. **One merged candidate pool.** Results are unioned by id, so a title
 *     found by only one variant still competes.
 *  3. **Local ranking.** The pool is ordered by `rankBy` against every name a
 *     record answers to — romaji, english, native and synonyms — which is what
 *     puts One Piece at the top of "one" instead of whatever upstream's
 *     relevance sort happened to return first.
 *  4. **Spelling repair, on failure only.** Upstream finds nothing at all for
 *     a mistyped single word, so an empty first wave triggers a second one
 *     built from `repairVariants` — transpositions, deletions and doublings of
 *     the longest token. "shigneki" comes back as Shingeki no Kyojin.
 *
 * Over-fetched on purpose: ranking 50 candidates well beats ranking 20 badly,
 * and the requests are cached per variant.
 */
export function useTitleSearch({
  query,
  kind = 'anime',
  filters,
  perPage = 50,
  limit = 40,
  enabled = true,
}: {
  query: string
  kind?: MediaKind
  filters?: MediaFilters
  perPage?: number
  limit?: number
  enabled?: boolean
}) {
  const trimmed = query.trim()
  const active = enabled && trimmed.length >= 2

  const variants = useMemo(() => (active ? queryVariants(trimmed) : []), [trimmed, active])
  const repairs = useMemo(() => (active ? repairVariants(trimmed) : []), [trimmed, active])

  // Serialized so the memo below has a stable dependency — filter objects are
  // rebuilt on every render of the page that owns them.
  const filterKey = JSON.stringify(filters ?? {})

  const buildQuery = (variant: string, enabledFlag: boolean) => {
    const variables = buildVariables({ search: variant, kind, perPage, ...(filters ?? {}) })
    return {
      queryKey: mediaKeys.search(variables),
      enabled: enabledFlag,
      staleTime: 5 * 60 * 1000,
      queryFn: ({ signal }: { signal: AbortSignal }) => runSearch(variables, signal),
    }
  }

  const primary = useQueries({ queries: variants.map((v) => buildQuery(v, true)) })

  const primaryLoading = primary.length > 0 && primary.some((r) => r.isLoading)
  const primaryMedia = primary.flatMap((r) => r.data?.media ?? [])

  /**
   * The repair wave only runs when the first one settled with nothing.
   *
   * That ordering is the whole point: a correctly spelled query costs the same
   * two or three requests it always did, and only a search that has already
   * failed pays for the spelling repairs.
   */
  const needsRepair = active && !primaryLoading && primaryMedia.length === 0
  const repaired = useQueries({ queries: repairs.map((v) => buildQuery(v, needsRepair)) })

  const results = [...primary, ...repaired]
  const isLoading = primaryLoading || (needsRepair && repaired.some((r) => r.isLoading))
  const isError = results.length > 0 && results.every((r) => r.isError)

  const pooled = [...primaryMedia, ...repaired.flatMap((r) => r.data?.media ?? [])]
  const poolKey = pooled.map((m) => m.id).join(',')

  const media = useMemo(() => {
    if (!active) return []

    const byId = new Map<number, MediaSummary>()
    for (const m of pooled) if (!byId.has(m.id)) byId.set(m.id, m)

    return rankBy(
      trimmed,
      [...byId.values()],
      (m) => ({
        names: [m.title.english, m.title.romaji, m.title.native],
        aliases: m.synonyms,
        popularity: m.popularity,
      }),
    )
      .slice(0, limit)
      .map((r) => r.item)
    // `poolKey` and `filterKey` stand in for the pool and the filters, both of
    // which are new object identities on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey, filterKey, trimmed, active, limit])

  return { media, isLoading, isError, isActive: active }
}

/* -------------------------------------------------------------------------- */

/** Powers Discover's "because you rated X" rows. */
export function useRecommendations(id: number | null | undefined, perPage = 16) {
  return useQuery({
    queryKey: mediaKeys.recommendations(id ?? 0),
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const data = await anilist<{
        Media: { recommendations: { nodes: { rating: number; mediaRecommendation: RawMedia }[] } }
      }>(RECOMMENDATIONS_QUERY, { id, perPage }, signal)

      return data.Media.recommendations.nodes
        .filter((n) => n.mediaRecommendation?.id)
        .map((n) => ({ rating: n.rating ?? 0, media: normalizeSummary(n.mediaRecommendation) }))
    },
  })
}

export function useGenres() {
  return useQuery({
    queryKey: mediaKeys.genres(),
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const data = await anilist<{ GenreCollection: string[] }>(GENRES_QUERY, {}, signal)
      // AniList's list includes Hentai; the app filters adult content out.
      return data.GenreCollection.filter((g) => g && g !== 'Hentai')
    },
  })
}

export type { Media, MediaSummary }
