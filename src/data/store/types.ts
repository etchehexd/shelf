import type { MediaKind } from '@/data/anilist/types'

export type EntryStatus = 'current' | 'completed' | 'planning' | 'paused' | 'dropped'

export const STATUS_ORDER: EntryStatus[] = ['current', 'completed', 'planning', 'paused', 'dropped']

/** Status labels read differently for watching vs reading. */
export function statusLabel(status: EntryStatus, kind: MediaKind): string {
  if (status === 'current') return kind === 'anime' ? 'Watching' : 'Reading'
  return { completed: 'Completed', planning: 'Planning', paused: 'Paused', dropped: 'Dropped' }[status]
}

/**
 * A score is a verdict on the whole work, so it only unlocks once the work is
 * finished. Every rating affordance in the app is gated on this — there is no
 * second path to a score.
 */
export function canRate(status: EntryStatus | null | undefined): boolean {
  return status === 'completed'
}

export interface LibraryEntry {
  mediaId: number
  kind: MediaKind
  status: EntryStatus
  progress: number
  progressVolumes: number
  /** Whole numbers 1–10. The only rating field in the app. */
  score: number | null
  repeats: number
  note: string | null
  favorite: boolean
  startedAt: string | null
  finishedAt: string | null
  createdAt: number
  updatedAt: number
}

export interface RankingEntry {
  kind: MediaKind
  mediaId: number
  /** Fractional index — see lib/ids.ts positionBetween(). */
  position: number
  updatedAt: number
}

export type CollectionPrivacy = 'private' | 'unlisted' | 'public'
export type CollectionLayout = 'grid' | 'ranked' | 'showcase'

export interface Collection {
  id: string
  slug: string
  name: string
  description: string | null
  coverUrl: string | null
  bannerUrl: string | null
  tags: string[]
  privacy: CollectionPrivacy
  layout: CollectionLayout
  position: number
  createdAt: number
  updatedAt: number
}

export interface CollectionItem {
  id: string
  collectionId: string
  mediaId: number
  kind: MediaKind
  /** A short reaction. Renders as a pull-quote in showcase layout. */
  note: string | null
  position: number
  addedAt: number
}

export type ActivityType =
  | 'added'
  | 'progress'
  | 'status'
  | 'score'
  | 'rank'
  | 'collection'
  | 'note'
  | 'removed'

/**
 * The only history store in the app. Every derived history view — dashboard
 * timeline, per-media history, weekly stats, rating changes, profile activity —
 * is a selector over this list. `from` is what makes Undo possible.
 */
export interface ActivityEvent {
  id: string
  type: ActivityType
  mediaId: number | null
  kind: MediaKind | null
  collectionId: string | null
  payload: {
    from?: unknown
    to?: unknown
    collectionName?: string
    [key: string]: unknown
  }
  createdAt: number
}

export type WidgetId =
  | 'obsession'
  | 'top-ranked'
  | 'featured-collections'
  | 'currently'
  | 'statistics'
  | 'rating-distribution'
  | 'genre-affinity'
  | 'eras'
  | 'year-in-review'
  | 'recent-activity'
  | 'favorites'

export interface WidgetConfig {
  id: WidgetId
  visible: boolean
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'obsession', visible: true },
  { id: 'currently', visible: true },
  { id: 'top-ranked', visible: true },
  { id: 'featured-collections', visible: true },
  { id: 'favorites', visible: true },
  { id: 'statistics', visible: true },
  { id: 'genre-affinity', visible: true },
  { id: 'rating-distribution', visible: true },
  { id: 'eras', visible: true },
  { id: 'year-in-review', visible: true },
  { id: 'recent-activity', visible: true },
]

/** Labels for the arrange screen. Each one names its section, exactly. */
export const WIDGET_LABEL: Record<WidgetId, string> = {
  obsession: 'Most watched lately',
  'top-ranked': 'Your ranking',
  'featured-collections': 'Collections',
  currently: 'Watching & reading',
  statistics: 'Statistics',
  'rating-distribution': 'Your scores',
  'genre-affinity': 'Genres',
  eras: 'By year',
  'year-in-review': 'This year',
  'recent-activity': 'Activity',
  favorites: 'Favorites',
}

/**
 * Widget lists are persisted per profile, so a release that adds a widget has
 * to fold it into lists written before it existed — otherwise new furniture is
 * invisible to everyone who already has a room.
 */
export function mergeWidgets(saved: WidgetConfig[]): WidgetConfig[] {
  const known = new Set(DEFAULT_WIDGETS.map((w) => w.id))
  const seen = new Set(saved.map((w) => w.id))

  return [
    ...saved.filter((w) => known.has(w.id)),
    ...DEFAULT_WIDGETS.filter((w) => !seen.has(w.id)),
  ]
}

export interface Profile {
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  accent: string | null
  isPublic: boolean
  widgets: WidgetConfig[]
  favoriteGenres: string[]
  updatedAt: number
}
