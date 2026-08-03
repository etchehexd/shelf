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
}

export interface Media extends MediaSummary {
  description: string | null
  season: string | null
  duration: number | null
  source: string | null
  countryOfOrigin: string | null
  popularity: number
  favourites: number
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
  nextAiringEpisode: AiringEpisode | null
}

/** The total a progress bar counts toward, or null when it isn't known yet. */
export function totalUnits(media: Pick<MediaSummary, 'kind' | 'episodes' | 'chapters'>): number | null {
  return media.kind === 'anime' ? media.episodes : media.chapters
}

/** "Episode" / "Chapter" — the unit the stepper counts. */
export function unitName(kind: MediaKind): string {
  return kind === 'anime' ? 'Episode' : 'Chapter'
}

export function unitNamePlural(kind: MediaKind): string {
  return kind === 'anime' ? 'episodes' : 'chapters'
}

/** Only manga and light novels track volumes; AniList has no such field for anime. */
export function tracksVolumes(kind: MediaKind): boolean {
  return kind !== 'anime'
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
