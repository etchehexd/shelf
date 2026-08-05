/**
 * TMDB — episode data.
 *
 * The main catalog knows a show has 25 episodes; it does not know that episode
 * 18 is called "Zero". TMDB does, so it is used for exactly that: episode
 * numbers, names, air dates and stills. Nothing else in the product depends on
 * it, and nothing else should — the media source stays swappable because this
 * is a leaf.
 *
 * ----------------------------------------------------------------- no key?
 *
 * `VITE_TMDB_API_KEY` is optional, and its absence is a first-class state
 * rather than an error. With no key `tmdb` is null, `isEpisodeDataConfigured`
 * is false, and every surface that would show episodes explains how to turn it
 * on instead of rendering a broken panel. This mirrors exactly how Supabase is
 * handled, for the same reason: a feature that cannot be configured should
 * degrade to an explanation, not to a spinner that never stops.
 */

const key = import.meta.env.VITE_TMDB_API_KEY

export const isEpisodeDataConfigured =
  typeof key === 'string' && key.length > 10 && !key.includes('your-')

const BASE = 'https://api.themoviedb.org/3'

/** TMDB serves stills from a separate image host, sized by path segment. */
export const tmdbImage = (path: string | null | undefined, size: 'w300' | 'w780' = 'w300') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'TmdbError'
  }
}

export async function tmdb<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  if (!isEpisodeDataConfigured) throw new TmdbError('Episode data is not configured.', 0)

  const url = new URL(BASE + path)
  url.searchParams.set('api_key', String(key))
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new TmdbError(
      res.status === 401
        ? 'That TMDB key was rejected.'
        : `Episode data request failed (${res.status}).`,
      res.status,
    )
  }
  return (await res.json()) as T
}

/* ------------------------------------------------------------------ shapes -- */

export interface TmdbSearchResult {
  id: number
  name: string
  original_name?: string
  first_air_date?: string
  popularity?: number
}

export interface TmdbEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string | null
  still_path: string | null
  vote_average: number
}

export interface TmdbSeason {
  season_number: number
  episode_count: number
  name: string
}
