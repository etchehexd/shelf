import type { MediaKind } from '@/data/anilist/types'

export type EntryStatus = 'current' | 'completed' | 'planning' | 'paused' | 'dropped'

export const STATUS_ORDER: EntryStatus[] = ['current', 'completed', 'planning', 'paused', 'dropped']

/** Status labels read differently for watching vs reading. */
export function statusLabel(status: EntryStatus, kind: MediaKind): string {
  if (status === 'current') return kind === 'anime' ? 'Watching' : 'Reading'
  return { completed: 'Completed', planning: 'Planning', paused: 'Paused', dropped: 'Dropped' }[status]
}

export interface LibraryEntry {
  mediaId: number
  kind: MediaKind
  status: EntryStatus
  progress: number
  progressVolumes: number
  /** 0.5 – 10.0 in 0.5 steps. The only rating field in the app. */
  score: number | null
  repeats: number
  note: string | null
  favourite: boolean
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
  | 'top-ranked'
  | 'featured-collections'
  | 'currently'
  | 'statistics'
  | 'rating-distribution'
  | 'genre-affinity'
  | 'recent-activity'
  | 'favourites'

export interface WidgetConfig {
  id: WidgetId
  visible: boolean
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'currently', visible: true },
  { id: 'top-ranked', visible: true },
  { id: 'featured-collections', visible: true },
  { id: 'statistics', visible: true },
  { id: 'genre-affinity', visible: true },
  { id: 'rating-distribution', visible: true },
  { id: 'recent-activity', visible: true },
  { id: 'favourites', visible: false },
]

export const WIDGET_LABEL: Record<WidgetId, string> = {
  'top-ranked': 'Top ranked',
  'featured-collections': 'Featured collections',
  currently: 'Currently watching & reading',
  statistics: 'Statistics',
  'rating-distribution': 'Rating distribution',
  'genre-affinity': 'Genre affinity',
  'recent-activity': 'Recent activity',
  favourites: 'Favourites',
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
  favouriteGenres: string[]
  updatedAt: number
}
