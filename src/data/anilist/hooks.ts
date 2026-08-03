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

export interface SearchParams {
  search?: string
  kind?: MediaKind
  genres?: string[]
  season?: string
  seasonYear?: number
  sort?: SortKey
  page?: number
  perPage?: number
  enabled?: boolean
}

export function useMediaSearch({
  search,
  kind = 'anime',
  genres,
  season,
  seasonYear,
  sort = 'trending',
  page = 1,
  perPage = 24,
  enabled = true,
}: SearchParams) {
  const { type, formats } = kindFilters(kind)

  // A text search must sort by match quality; a browse must not.
  const resolvedSort = search ? SORT_OPTIONS.relevance : SORT_OPTIONS[sort]

  const variables = {
    search: search || undefined,
    type,
    formats,
    genres: genres?.length ? genres : undefined,
    season,
    seasonYear,
    sort: resolvedSort,
    page,
    perPage,
  }

  return useQuery({
    queryKey: mediaKeys.search(variables),
    enabled: enabled && (search == null || search.length === 0 || search.length >= 2),
    // Search results churn; browse results don't.
    staleTime: search ? 5 * 60 * 1000 : 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const data = await anilist<{
        Page: { pageInfo: { hasNextPage: boolean; total: number }; media: RawMedia[] }
      }>(SEARCH_QUERY, variables, signal)

      return {
        media: data.Page.media.map(normalizeSummary),
        hasNextPage: data.Page.pageInfo.hasNextPage,
        total: data.Page.pageInfo.total,
      }
    },
  })
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
