/**
 * Normalized media types. Raw AniList shapes stop at `normalize.ts` — nothing
 * above this file ever sees a GraphQL response, which is what makes the media
 * source swappable.
 */

/**
 * Light novels are a client-side concept: AniList files them under
 * `type: MANGA` with `format: NOVEL`. See `resolveKind`.
 */
export type MediaKind = 'anime' | 'manga' | 'novel'

export interface MediaTitle {
  romaji: string
  english: string | null
  native: string | null
}

export interface FuzzyDate {
  year: number | null
  month: number | null
  day: number | null
}

export interface Studio {
  id: number
  name: string
  isMain: boolean
}

export interface MediaTag {
  id: number
  name: string
  rank: number
  isSpoiler: boolean
  category: string | null
}

export interface Character {
  id: number
  name: string
  image: string | null
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND'
  voiceActor: { id: number; name: string; image: string | null } | null
}

export interface StaffMember {
  id: number
  name: string
  image: string | null
  role: string
}

export interface Relation {
  relationType: string
  media: MediaSummary
}

export interface Recommendation {
  rating: number
  media: MediaSummary
}

export interface AiringEpisode {
  episode: number
  airingAt: number
  timeUntilAiring: number
}

/** Everything a card needs. Detail queries return a superset. */
export interface MediaSummary {
  id: number
  kind: MediaKind
  format: string | null
  status: string | null
  title: MediaTitle
  coverImage: string | null
  coverImageLarge: string | null
  color: string | null
  bannerImage: string | null
  seasonYear: number | null
  episodes: number | null
  chapters: number | null
  volumes: number | null
  averageScore: number | null
  genres: string[]
  isAdult: boolean
  nextAiringEpisode: AiringEpisode | null
}

export interface Media extends MediaSummary {
  description: string | null
  season: string | null
  duration: number | null
  source: string | null
  countryOfOrigin: string | null
  popularity: number
  favorites: number
  meanScore: number | null
  siteUrl: string | null
  startDate: FuzzyDate | null
  endDate: FuzzyDate | null
  studios: Studio[]
  tags: MediaTag[]
  characters: Character[]
  staff: StaffMember[]
  relations: Relation[]
  recommendations: Recommendation[]
}

/**
 * The total a progress bar counts toward, or null when it isn't known yet.
 *
 * Each kind counts in the unit people actually talk about: anime in episodes,
 * manga in chapters, light novels in **volumes**. Novels are published and
 * discussed by volume — nobody says "I'm on chapter 112 of Spice and Wolf" —
 * and AniList's chapter counts for novels are usually null anyway.
 */
export function totalUnits(
  media: Pick<MediaSummary, 'kind' | 'episodes' | 'chapters' | 'volumes'>,
): number | null {
  if (media.kind === 'anime') return media.episodes
  if (media.kind === 'novel') return media.volumes
  return media.chapters
}

/** "Episode" / "Chapter" / "Volume" — the unit the stepper counts. */
export function unitName(kind: MediaKind): string {
  if (kind === 'anime') return 'Episode'
  return kind === 'novel' ? 'Volume' : 'Chapter'
}

export function unitNamePlural(kind: MediaKind): string {
  if (kind === 'anime') return 'episodes'
  return kind === 'novel' ? 'volumes' : 'chapters'
}

/**
 * A *secondary* volume counter. Only manga gets one — novels already count in
 * volumes, and AniList has no volume data for anime.
 */
export function tracksVolumes(kind: MediaKind): boolean {
  return kind === 'manga'
}

export const KIND_LABEL: Record<MediaKind, string> = {
  anime: 'Anime',
  manga: 'Manga',
  novel: 'Light novels',
}

export const KIND_LABEL_SINGULAR: Record<MediaKind, string> = {
  anime: 'Anime',
  manga: 'Manga',
  novel: 'Light novel',
}

/**
 * "15 anime", "4 manga", "2 light novels".
 *
 * As loanwords, anime and manga take no English plural — the generic
 * pluralize() helper produces "15 animes", which is exactly the kind of detail
 * that makes an app feel machine-written.
 */
export function kindCount(kind: MediaKind, n: number): string {
  if (kind === 'novel') return `${n} light novel${n === 1 ? '' : 's'}`
  return `${n} ${kind}`
}
