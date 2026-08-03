import type {
  AiringEpisode,
  Character,
  FuzzyDate,
  Media,
  MediaKind,
  MediaSummary,
  MediaTag,
  Recommendation,
  Relation,
  StaffMember,
  Studio,
} from './types'

/**
 * The boundary between AniList's shapes and ours. Everything above this file
 * sees only `Media` / `MediaSummary`.
 */

/* Raw shapes — loose on purpose. AniList returns null for almost any field, and
 * pretending otherwise just moves the crash somewhere less obvious. */

interface RawImage {
  extraLarge?: string | null
  large?: string | null
  color?: string | null
}

interface RawName {
  full?: string | null
}

interface RawNode {
  id?: number | null
  name?: RawName | string | null
  image?: { large?: string | null } | null
}

export interface RawMedia {
  id: number
  type?: string | null
  format?: string | null
  status?: string | null
  isAdult?: boolean | null
  genres?: (string | null)[] | null
  episodes?: number | null
  chapters?: number | null
  volumes?: number | null
  season?: string | null
  seasonYear?: number | null
  averageScore?: number | null
  meanScore?: number | null
  popularity?: number | null
  favourites?: number | null
  duration?: number | null
  source?: string | null
  countryOfOrigin?: string | null
  siteUrl?: string | null
  description?: string | null
  bannerImage?: string | null
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null
  coverImage?: RawImage | null
  startDate?: FuzzyDate | null
  endDate?: FuzzyDate | null
  studios?: { edges?: ({ isMain?: boolean | null; node?: RawNode | null } | null)[] | null } | null
  tags?:
    | ({
        id?: number | null
        name?: string | null
        rank?: number | null
        isGeneralSpoiler?: boolean | null
        isMediaSpoiler?: boolean | null
        category?: string | null
      } | null)[]
    | null
  nextAiringEpisode?: AiringEpisode | null
  characters?: {
    edges?:
      | ({ role?: string | null; node?: RawNode | null; voiceActors?: (RawNode | null)[] | null } | null)[]
      | null
  } | null
  staff?: { edges?: ({ role?: string | null; node?: RawNode | null } | null)[] | null } | null
  relations?: {
    edges?: ({ relationType?: string | null; node?: RawMedia | null } | null)[] | null
  } | null
  recommendations?: {
    nodes?: ({ rating?: number | null; mediaRecommendation?: RawMedia | null } | null)[] | null
  } | null
}

/**
 * The three-way split the library uses. AniList has no "light novel" type —
 * novels are `MANGA` with `format: NOVEL`.
 */
export function resolveKind(raw: Pick<RawMedia, 'type' | 'format'>): MediaKind {
  if (raw.type === 'ANIME') return 'anime'
  if (raw.format === 'NOVEL') return 'novel'
  return 'manga'
}

const compact = <T>(list: (T | null | undefined)[] | null | undefined): T[] =>
  (list ?? []).filter((x): x is T => x != null)

function nameOf(node: RawNode | null | undefined): string {
  if (!node?.name) return 'Unknown'
  return typeof node.name === 'string' ? node.name : (node.name.full ?? 'Unknown')
}

export function normalizeSummary(raw: RawMedia): MediaSummary {
  return {
    id: raw.id,
    kind: resolveKind(raw),
    format: raw.format ?? null,
    status: raw.status ?? null,
    title: {
      // AniList guarantees romaji; english and native are frequently missing.
      romaji: raw.title?.romaji ?? `Media #${raw.id}`,
      english: raw.title?.english ?? null,
      native: raw.title?.native ?? null,
    },
    coverImage: raw.coverImage?.large ?? raw.coverImage?.extraLarge ?? null,
    coverImageLarge: raw.coverImage?.extraLarge ?? raw.coverImage?.large ?? null,
    color: raw.coverImage?.color ?? null,
    bannerImage: raw.bannerImage ?? null,
    seasonYear: raw.seasonYear ?? null,
    episodes: raw.episodes ?? null,
    chapters: raw.chapters ?? null,
    volumes: raw.volumes ?? null,
    averageScore: raw.averageScore ?? null,
    genres: compact(raw.genres),
    isAdult: raw.isAdult ?? false,
  }
}

export function normalizeMedia(raw: RawMedia): Media {
  return {
    ...normalizeSummary(raw),
    description: raw.description ?? null,
    season: raw.season ?? null,
    duration: raw.duration ?? null,
    source: raw.source ?? null,
    countryOfOrigin: raw.countryOfOrigin ?? null,
    popularity: raw.popularity ?? 0,
    favourites: raw.favourites ?? 0,
    meanScore: raw.meanScore ?? null,
    siteUrl: raw.siteUrl ?? null,
    startDate: hasDate(raw.startDate) ? raw.startDate! : null,
    endDate: hasDate(raw.endDate) ? raw.endDate! : null,
    studios: normalizeStudios(raw),
    tags: normalizeTags(raw),
    characters: normalizeCharacters(raw),
    staff: normalizeStaff(raw),
    relations: normalizeRelations(raw),
    recommendations: normalizeRecommendations(raw),
    nextAiringEpisode: raw.nextAiringEpisode ?? null,
  }
}

function hasDate(d: FuzzyDate | null | undefined): boolean {
  return Boolean(d?.year)
}

function normalizeStudios(raw: RawMedia): Studio[] {
  return compact(raw.studios?.edges)
    .map((edge) => ({
      id: edge.node?.id ?? 0,
      name: nameOf(edge.node),
      isMain: edge.isMain ?? false,
    }))
    .filter((s) => s.id !== 0)
    // Animation studios first; licensors and producers after.
    .sort((a, b) => Number(b.isMain) - Number(a.isMain))
}

function normalizeTags(raw: RawMedia): MediaTag[] {
  return compact(raw.tags)
    .map((t) => ({
      id: t.id ?? 0,
      name: t.name ?? '',
      rank: t.rank ?? 0,
      isSpoiler: Boolean(t.isGeneralSpoiler || t.isMediaSpoiler),
      category: t.category ?? null,
    }))
    .filter((t) => t.name)
    .sort((a, b) => b.rank - a.rank)
}

function normalizeCharacters(raw: RawMedia): Character[] {
  return compact(raw.characters?.edges).map((edge) => {
    const va = compact(edge.voiceActors)[0]
    return {
      id: edge.node?.id ?? 0,
      name: nameOf(edge.node),
      image: edge.node?.image?.large ?? null,
      role: (edge.role as Character['role']) ?? 'BACKGROUND',
      voiceActor: va ? { id: va.id ?? 0, name: nameOf(va), image: va.image?.large ?? null } : null,
    }
  })
}

function normalizeStaff(raw: RawMedia): StaffMember[] {
  return compact(raw.staff?.edges).map((edge) => ({
    id: edge.node?.id ?? 0,
    name: nameOf(edge.node),
    image: edge.node?.image?.large ?? null,
    role: edge.role ?? '',
  }))
}

function normalizeRelations(raw: RawMedia): Relation[] {
  return compact(raw.relations?.edges)
    .filter((edge) => edge.node?.id)
    .map((edge) => ({
      relationType: edge.relationType ?? 'OTHER',
      media: normalizeSummary(edge.node!),
    }))
    // Sequels and prequels are what people actually navigate to; character
    // cameos and "other" are noise at the top of the list.
    .sort((a, b) => relationWeight(a.relationType) - relationWeight(b.relationType))
}

const RELATION_ORDER = [
  'PREQUEL',
  'SEQUEL',
  'PARENT',
  'SIDE_STORY',
  'ALTERNATIVE',
  'SPIN_OFF',
  'ADAPTATION',
  'SOURCE',
  'SUMMARY',
]

function relationWeight(type: string): number {
  const i = RELATION_ORDER.indexOf(type)
  return i === -1 ? RELATION_ORDER.length : i
}

function normalizeRecommendations(raw: RawMedia): Recommendation[] {
  return compact(raw.recommendations?.nodes)
    .filter((n) => n.mediaRecommendation?.id)
    .map((n) => ({
      rating: n.rating ?? 0,
      media: normalizeSummary(n.mediaRecommendation!),
    }))
}

/* -------------------------------------------------------------------------- */

export type TitleLanguage = 'romaji' | 'english' | 'native'

/** Respects the user's title-language preference, falling back gracefully. */
export function displayTitle(
  media: Pick<MediaSummary, 'title'>,
  language: TitleLanguage = 'english',
): string {
  const { romaji, english, native } = media.title
  if (language === 'native') return native ?? romaji
  if (language === 'romaji') return romaji
  return english ?? romaji
}

/** The secondary line under a title — only shown when it adds something. */
export function subTitle(
  media: Pick<MediaSummary, 'title'>,
  language: TitleLanguage = 'english',
): string | null {
  const primary = displayTitle(media, language)
  const { romaji, native } = media.title
  if (language === 'native') return romaji === primary ? null : romaji
  return native && native !== primary ? native : romaji !== primary ? romaji : null
}
