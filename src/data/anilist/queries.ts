/**
 * GraphQL documents.
 *
 * Two fragments only: `MediaCard` (everything a grid needs) and `MediaFull`
 * (the detail page). Keeping the card fragment small matters — library
 * hydration fetches 50 media at a time and the response is the largest payload
 * in the app.
 */

export const MEDIA_CARD_FRAGMENT = `
  fragment MediaCard on Media {
    id
    type
    format
    status
    isAdult
    genres
    episodes
    chapters
    volumes
    seasonYear
    averageScore
    # Rides along on the card fragment because search ranking needs it as a
    # tiebreaker — "one" has to put One Piece first — and refetching it
    # separately would double the request count on every keystroke.
    popularity
    bannerImage
    title { romaji english native }
    # The alternate spellings a title is known by — "Attack on Titan" is filed
    # under its romaji name, and "AoT" is a synonym. The local ranker matches
    # against these too, which is most of why search stopped missing things.
    synonyms
    coverImage { extraLarge large color }
    # Small enough to ride along on the 50-at-a-time library hydration, and it
    # is what lets the dashboard say 'episode 8 lands on Friday'.
    nextAiringEpisode { episode airingAt timeUntilAiring }
  }
`

export const MEDIA_FULL_FRAGMENT = `
  fragment MediaFull on Media {
    ...MediaCard
    description(asHtml: false)
    season
    duration
    source(version: 3)
    countryOfOrigin
    # Aliased on the wire: the upstream schema spells this the British way and
    # the app spells everything the American way. Renaming it here is the one
    # place the two conventions have to meet, so nothing downstream — the raw
    # shape, the normalized type, the UI — ever carries the other spelling.
    favorites: favourites
    meanScore
    siteUrl
    startDate { year month day }
    endDate { year month day }
    studios { edges { isMain node { id name } } }
    tags { id name rank isGeneralSpoiler isMediaSpoiler category }
    characters(sort: [ROLE, RELEVANCE], perPage: 14) {
      edges {
        role
        node { id name { full } image { large } }
        voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
          id
          name { full }
          image { large }
        }
      }
    }
    staff(sort: [RELEVANCE], perPage: 10) {
      edges { role node { id name { full } image { large } } }
    }
    relations {
      edges { relationType(version: 2) node { ...MediaCard } }
    }
    recommendations(sort: [RATING_DESC], perPage: 14) {
      nodes { rating mediaRecommendation { ...MediaCard } }
    }
  }
`

export const MEDIA_DETAIL_QUERY = `
  query MediaDetail($id: Int!) {
    Media(id: $id) { ...MediaFull }
  }
  ${MEDIA_FULL_FRAGMENT}
  ${MEDIA_CARD_FRAGMENT}
`

/**
 * Library hydration. One request per 50 entries, which is why the library can
 * render a 400-title collection in eight requests instead of four hundred.
 */
export const MEDIA_BY_IDS_QUERY = `
  query MediaByIds($ids: [Int], $page: Int = 1, $perPage: Int = 50) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage }
      media(id_in: $ids) { ...MediaCard }
    }
  }
  ${MEDIA_CARD_FRAGMENT}
`

export const SEARCH_QUERY = `
  query Search(
    $search: String
    $type: MediaType
    $formats: [MediaFormat]
    $genres: [String]
    $season: MediaSeason
    $seasonYear: Int
    $yearFrom: FuzzyDateInt
    $yearTo: FuzzyDateInt
    $scoreFrom: Int
    $scoreTo: Int
    $statuses: [MediaStatus]
    $sort: [MediaSort]
    $page: Int = 1
    $perPage: Int = 24
    $isAdult: Boolean = false
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage total }
      media(
        search: $search
        type: $type
        format_in: $formats
        genre_in: $genres
        season: $season
        seasonYear: $seasonYear
        # Year is a *range* filter rather than a single season year, so
        # "2010–2015" is one request. Upstream stores these as FuzzyDateInt —
        # yyyymmdd packed into an integer — hence 20100101 / 20151231.
        startDate_greater: $yearFrom
        startDate_lesser: $yearTo
        averageScore_greater: $scoreFrom
        averageScore_lesser: $scoreTo
        status_in: $statuses
        sort: $sort
        isAdult: $isAdult
      ) { ...MediaCard }
    }
  }
  ${MEDIA_CARD_FRAGMENT}
`

/**
 * Recommendations hanging off one title. Discover builds its personal rows from
 * these rather than from a global popularity chart — the row is "because you
 * rated Frieren 10", not "trending now".
 */
export const RECOMMENDATIONS_QUERY = `
  query Recommendations($id: Int!, $perPage: Int = 16) {
    Media(id: $id) {
      id
      recommendations(sort: [RATING_DESC], perPage: $perPage) {
        nodes { rating mediaRecommendation { ...MediaCard } }
      }
    }
  }
  ${MEDIA_CARD_FRAGMENT}
`

export const GENRES_QUERY = `
  query Genres {
    GenreCollection
  }
`

/* -------------------------------------------------------------------------- */

import type { MediaKind } from './types'

/**
 * Maps our three-way media kind onto AniList's `type` + `format` filters.
 * Light novels are `MANGA` with `format: NOVEL`; manga is everything else under
 * `MANGA`, which AniList cannot express as a single positive filter — so manga
 * queries list the formats explicitly.
 */
export function kindFilters(kind: MediaKind): { type: 'ANIME' | 'MANGA'; formats?: string[] } {
  switch (kind) {
    case 'anime':
      return { type: 'ANIME' }
    case 'novel':
      return { type: 'MANGA', formats: ['NOVEL'] }
    case 'manga':
      return { type: 'MANGA', formats: ['MANGA', 'ONE_SHOT'] }
  }
}

export const SORT_OPTIONS = {
  trending: ['TRENDING_DESC', 'POPULARITY_DESC'],
  popularity: ['POPULARITY_DESC'],
  score: ['SCORE_DESC'],
  newest: ['START_DATE_DESC'],
  relevance: ['SEARCH_MATCH'],
} as const

export type SortKey = keyof typeof SORT_OPTIONS
