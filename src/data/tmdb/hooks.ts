import { useQuery } from '@tanstack/react-query'
import {
  isEpisodeDataConfigured,
  tmdb,
  type TmdbEpisode,
  type TmdbSearchResult,
  type TmdbSeason,
} from './client'
import { normalize } from '@/lib/search'
import type { MediaSummary } from '@/data/anilist/types'

export const tmdbKeys = {
  match: (title: string, year: number | null) => ['tmdb-match', title, year] as const,
  season: (showId: number, season: number) => ['tmdb-season', showId, season] as const,
  show: (showId: number) => ['tmdb-show', showId] as const,
}

/**
 * Find the TMDB show that corresponds to a catalog entry.
 *
 * The two catalogs share no identifier, so this matches on title and year —
 * which is genuinely lossy, and the code is written to be honest about that
 * rather than to pretend. Both the romaji and English titles are tried, the
 * results are scored with the same normalizer the app's own search uses, and
 * anything that scores poorly returns null rather than a confident wrong show.
 *
 * A wrong match here is worse than no match: it would attach somebody's
 * favorite episode to a completely different series.
 */
export function useTmdbMatch(media: Pick<MediaSummary, 'title' | 'seasonYear'> | undefined) {
  const romaji = media?.title.romaji ?? ''
  const english = media?.title.english ?? ''
  const year = media?.seasonYear ?? null
  const primary = english || romaji

  return useQuery({
    queryKey: tmdbKeys.match(primary, year),
    enabled: isEpisodeDataConfigured && primary.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const seen = new Map<number, TmdbSearchResult>()

      for (const query of [english, romaji].filter(Boolean)) {
        const data = await tmdb<{ results: TmdbSearchResult[] }>(
          '/search/tv',
          { query, include_adult: 'false' },
          signal,
        )
        for (const r of data.results) if (!seen.has(r.id)) seen.set(r.id, r)
      }

      const candidates = [...seen.values()]
      if (candidates.length === 0) return null

      const wanted = [normalize(english), normalize(romaji)].filter(Boolean)

      const scored = candidates.map((c) => {
        const names = [normalize(c.name), normalize(c.original_name ?? '')].filter(Boolean)
        let score = 0

        for (const n of names) {
          for (const w of wanted) {
            if (n === w) score = Math.max(score, 100)
            else if (n.startsWith(w) || w.startsWith(n)) score = Math.max(score, 70)
            else if (n.includes(w) || w.includes(n)) score = Math.max(score, 45)
          }
        }

        // The air year is the strongest disambiguator in this catalog: a
        // franchise has six entries with near-identical names and one of them
        // is the season you are looking at.
        const airYear = c.first_air_date ? Number(c.first_air_date.slice(0, 4)) : null
        if (year != null && airYear != null) {
          const gap = Math.abs(airYear - year)
          if (gap === 0) score += 25
          else if (gap === 1) score += 10
          else score -= gap * 4
        }

        return { c, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]

      // Below a confident threshold, say nothing. Half a match is not a match.
      return best && best.score >= 45 ? best.c : null
    },
  })
}

/** The show's seasons, so the picker knows what to offer. */
export function useTmdbSeasons(showId: number | null | undefined) {
  return useQuery({
    queryKey: tmdbKeys.show(showId ?? 0),
    enabled: isEpisodeDataConfigured && Boolean(showId),
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const data = await tmdb<{ seasons: TmdbSeason[] }>(`/tv/${showId}`, {}, signal)
      // Season 0 is specials — real, but never what somebody means by "my
      // favorite episode" until they go looking for it, so it sorts last.
      return data.seasons
        .filter((s) => s.episode_count > 0)
        .sort((a, b) => (a.season_number === 0 ? 1 : b.season_number === 0 ? -1 : a.season_number - b.season_number))
    },
  })
}

export function useTmdbEpisodes(showId: number | null | undefined, season: number) {
  return useQuery({
    queryKey: tmdbKeys.season(showId ?? 0, season),
    enabled: isEpisodeDataConfigured && Boolean(showId),
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const data = await tmdb<{ episodes: TmdbEpisode[] }>(
        `/tv/${showId}/season/${season}`,
        {},
        signal,
      )
      return data.episodes
    },
  })
}

export { isEpisodeDataConfigured }
export type { TmdbEpisode }
