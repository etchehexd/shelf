import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MediaKind } from '@/data/anilist/types'
import { deviceId, positionBetween, slugify, uniqueSlug, uuid } from '@/lib/ids'
import { todayISO } from '@/lib/dates'
import { enqueue } from '@/data/sync/outbox'
import {
  DEFAULT_WIDGETS,
  type ActivityEvent,
  type ActivityType,
  type Collection,
  type CollectionItem,
  type EntryStatus,
  type LibraryEntry,
  type Profile,
  type RankingEntry,
  type WidgetConfig,
} from './types'

const ACTIVITY_CAP = 1000

interface LibraryState {
  entries: Record<number, LibraryEntry>
  rankings: RankingEntry[]
  collections: Collection[]
  collectionItems: CollectionItem[]
  activity: ActivityEvent[]
  profile: Profile

  /* entries */
  addEntry: (media: { id: number; kind: MediaKind }, status?: EntryStatus) => void
  removeEntry: (mediaId: number) => void
  setProgress: (mediaId: number, progress: number, total?: number | null) => void
  setVolumes: (mediaId: number, volumes: number, total?: number | null) => void
  setStatus: (mediaId: number, status: EntryStatus, total?: number | null) => void
  setScore: (mediaId: number, score: number | null) => void
  setNote: (mediaId: number, note: string | null) => void
  toggleFavourite: (mediaId: number) => void
  addRepeat: (mediaId: number) => void
  restoreEntry: (entry: LibraryEntry) => void

  /* rankings */
  moveRank: (kind: MediaKind, mediaId: number, toIndex: number) => void
  removeRank: (kind: MediaKind, mediaId: number) => void

  /* collections */
  createCollection: (input: Partial<Collection> & { name: string }) => string
  updateCollection: (id: string, patch: Partial<Collection>) => void
  deleteCollection: (id: string) => void
  addToCollection: (collectionId: string, media: { id: number; kind: MediaKind }) => void
  removeFromCollection: (collectionId: string, mediaId: number) => void
  setItemNote: (itemId: string, note: string | null) => void
  moveCollectionItem: (collectionId: string, itemId: string, toIndex: number) => void

  /* profile */
  updateProfile: (patch: Partial<Profile>) => void
  setWidgets: (widgets: WidgetConfig[]) => void

  /* bulk */
  hydrateFromRemote: (snapshot: Partial<Pick<LibraryState,
    'entries' | 'rankings' | 'collections' | 'collectionItems' | 'activity' | 'profile'>>) => void
  reset: () => void
}

const emptyProfile: Profile = {
  handle: 'reader',
  displayName: 'Reader',
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  accent: null,
  isPublic: true,
  widgets: DEFAULT_WIDGETS,
  favouriteGenres: [],
  updatedAt: Date.now(),
}

/* -------------------------------------------------------------------------- */
/* Outbox payload mappers. These are the only place camelCase meets snake_case. */

const entryOp = (e: LibraryEntry) =>
  enqueue({
    key: `entry:${e.mediaId}`,
    entity: 'entry',
    action: 'upsert',
    payload: {
      media_id: e.mediaId,
      kind: e.kind,
      status: e.status,
      progress: e.progress,
      progress_volumes: e.progressVolumes,
      score: e.score,
      repeats: e.repeats,
      note: e.note,
      favourite: e.favourite,
      started_at: e.startedAt,
      finished_at: e.finishedAt,
      device_id: deviceId(),
    },
    updatedAt: e.updatedAt,
  })

const rankOp = (r: RankingEntry) =>
  enqueue({
    key: `ranking:${r.kind}:${r.mediaId}`,
    entity: 'ranking',
    action: 'upsert',
    payload: { kind: r.kind, media_id: r.mediaId, position: r.position },
    updatedAt: r.updatedAt,
  })

const collectionOp = (c: Collection) =>
  enqueue({
    key: `collection:${c.id}`,
    entity: 'collection',
    action: 'upsert',
    payload: {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      cover_url: c.coverUrl,
      banner_url: c.bannerUrl,
      tags: c.tags,
      privacy: c.privacy,
      layout: c.layout,
      position: c.position,
    },
    updatedAt: c.updatedAt,
  })

const itemOp = (i: CollectionItem) =>
  enqueue({
    key: `collection_item:${i.id}`,
    entity: 'collection_item',
    action: 'upsert',
    payload: {
      id: i.id,
      collection_id: i.collectionId,
      media_id: i.mediaId,
      kind: i.kind,
      note: i.note,
      position: i.position,
    },
  })

/* -------------------------------------------------------------------------- */

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => {
      /** Append an activity event and queue it. Never coalesced — see outbox.ts. */
      function log(
        type: ActivityType,
        fields: {
          mediaId?: number | null
          kind?: MediaKind | null
          collectionId?: string | null
          payload?: ActivityEvent['payload']
        },
      ) {
        const event: ActivityEvent = {
          id: uuid(),
          type,
          mediaId: fields.mediaId ?? null,
          kind: fields.kind ?? null,
          collectionId: fields.collectionId ?? null,
          payload: fields.payload ?? {},
          createdAt: Date.now(),
        }

        set((s) => ({ activity: [event, ...s.activity].slice(0, ACTIVITY_CAP) }))

        enqueue({
          key: `activity:${event.id}`,
          entity: 'activity',
          action: 'upsert',
          payload: {
            id: event.id,
            type: event.type,
            media_id: event.mediaId,
            kind: event.kind,
            collection_id: event.collectionId,
            payload: event.payload,
            created_at: new Date(event.createdAt).toISOString(),
          },
          updatedAt: event.createdAt,
        })
      }

      /** Apply a patch to one entry, stamp it, and queue it. */
      function patchEntry(mediaId: number, patch: Partial<LibraryEntry>): LibraryEntry | null {
        const current = get().entries[mediaId]
        if (!current) return null

        const next: LibraryEntry = { ...current, ...patch, updatedAt: Date.now() }
        set((s) => ({ entries: { ...s.entries, [mediaId]: next } }))
        entryOp(next)
        return next
      }

      function rankingsFor(kind: MediaKind): RankingEntry[] {
        return get()
          .rankings.filter((r) => r.kind === kind)
          .sort((a, b) => a.position - b.position)
      }

      function itemsFor(collectionId: string): CollectionItem[] {
        return get()
          .collectionItems.filter((i) => i.collectionId === collectionId)
          .sort((a, b) => a.position - b.position)
      }

      return {
        entries: {},
        rankings: [],
        collections: [],
        collectionItems: [],
        activity: [],
        profile: emptyProfile,

        /* ---------------------------------------------------------------- */

        addEntry: (media, status = 'planning') => {
          if (get().entries[media.id]) return

          const now = Date.now()
          const entry: LibraryEntry = {
            mediaId: media.id,
            kind: media.kind,
            status,
            progress: 0,
            progressVolumes: 0,
            score: null,
            repeats: 0,
            note: null,
            favourite: false,
            startedAt: status === 'current' ? todayISO() : null,
            finishedAt: null,
            createdAt: now,
            updatedAt: now,
          }

          set((s) => ({ entries: { ...s.entries, [media.id]: entry } }))
          entryOp(entry)
          log('added', { mediaId: media.id, kind: media.kind, payload: { to: status } })
        },

        removeEntry: (mediaId) => {
          const entry = get().entries[mediaId]
          if (!entry) return

          set((s) => {
            const entries = { ...s.entries }
            delete entries[mediaId]
            return {
              entries,
              rankings: s.rankings.filter((r) => r.mediaId !== mediaId),
            }
          })

          enqueue({
            key: `entry:${mediaId}`,
            entity: 'entry',
            action: 'delete',
            payload: { media_id: mediaId },
          })

          // `from` carries the whole entry so the toast's Undo can restore it.
          log('removed', { mediaId, kind: entry.kind, payload: { from: entry } })
        },

        restoreEntry: (entry) => {
          set((s) => ({ entries: { ...s.entries, [entry.mediaId]: entry } }))
          entryOp(entry)
        },

        /**
         * Progress carries the app's two bits of quiet intelligence: starting a
         * planned title moves it to Watching, and reaching the last episode
         * completes it. Both are things the user would otherwise have to do by
         * hand every single time.
         */
        setProgress: (mediaId, progress, total) => {
          const entry = get().entries[mediaId]
          if (!entry) return

          const clamped = Math.max(0, total != null ? Math.min(total, progress) : progress)
          if (clamped === entry.progress) return

          const patch: Partial<LibraryEntry> = { progress: clamped }

          if (clamped > 0 && (entry.status === 'planning' || entry.status === 'paused')) {
            patch.status = 'current'
            patch.startedAt = entry.startedAt ?? todayISO()
          }

          if (total != null && clamped >= total && entry.status !== 'completed') {
            patch.status = 'completed'
            patch.finishedAt = todayISO()
          }

          patchEntry(mediaId, patch)
          log('progress', {
            mediaId,
            kind: entry.kind,
            payload: { from: entry.progress, to: clamped, total: total ?? null },
          })

          if (patch.status && patch.status !== entry.status) {
            log('status', {
              mediaId,
              kind: entry.kind,
              payload: { from: entry.status, to: patch.status, automatic: true },
            })
          }
        },

        setVolumes: (mediaId, volumes, total) => {
          const entry = get().entries[mediaId]
          if (!entry) return

          const clamped = Math.max(0, total != null ? Math.min(total, volumes) : volumes)
          if (clamped === entry.progressVolumes) return

          patchEntry(mediaId, { progressVolumes: clamped })
          log('progress', {
            mediaId,
            kind: entry.kind,
            payload: { from: entry.progressVolumes, to: clamped, unit: 'volume' },
          })
        },

        setStatus: (mediaId, status, total) => {
          const entry = get().entries[mediaId]
          if (!entry || entry.status === status) return

          const patch: Partial<LibraryEntry> = { status }

          if (status === 'completed') {
            patch.finishedAt = todayISO()
            // Completing implies you saw all of it.
            if (total != null) patch.progress = total
            patch.startedAt = entry.startedAt ?? todayISO()
          } else if (status === 'current' && !entry.startedAt) {
            patch.startedAt = todayISO()
          }

          patchEntry(mediaId, patch)
          log('status', { mediaId, kind: entry.kind, payload: { from: entry.status, to: status } })
        },

        setScore: (mediaId, score) => {
          const entry = get().entries[mediaId]
          if (!entry || entry.score === score) return

          patchEntry(mediaId, { score })
          log('score', { mediaId, kind: entry.kind, payload: { from: entry.score, to: score } })
        },

        setNote: (mediaId, note) => {
          const entry = get().entries[mediaId]
          if (!entry || entry.note === note) return

          patchEntry(mediaId, { note })
          log('note', { mediaId, kind: entry.kind, payload: { from: entry.note, to: note } })
        },

        toggleFavourite: (mediaId) => {
          const entry = get().entries[mediaId]
          if (!entry) return
          patchEntry(mediaId, { favourite: !entry.favourite })
        },

        addRepeat: (mediaId) => {
          const entry = get().entries[mediaId]
          if (!entry) return
          patchEntry(mediaId, { repeats: entry.repeats + 1, progress: 0, status: 'current' })
        },

        /* ---------------------------------------------------------------- */

        /**
         * Move a title to a position in the global top list. One row is written
         * (the midpoint between its new neighbours), not the whole list.
         */
        moveRank: (kind, mediaId, toIndex) => {
          const ordered = rankingsFor(kind).filter((r) => r.mediaId !== mediaId)
          const index = Math.max(0, Math.min(ordered.length, toIndex))
          const prev = ordered[index - 1]?.position ?? null
          const next = ordered[index]?.position ?? null

          const existing = get().rankings.find((r) => r.kind === kind && r.mediaId === mediaId)
          const from = existing ? rankingsFor(kind).findIndex((r) => r.mediaId === mediaId) : null

          const entry: RankingEntry = {
            kind,
            mediaId,
            position: positionBetween(prev, next),
            updatedAt: Date.now(),
          }

          set((s) => ({
            rankings: [...s.rankings.filter((r) => !(r.kind === kind && r.mediaId === mediaId)), entry],
          }))
          rankOp(entry)

          log('rank', {
            mediaId,
            kind,
            payload: { from: from == null || from < 0 ? null : from + 1, to: index + 1 },
          })
        },

        removeRank: (kind, mediaId) => {
          if (!get().rankings.some((r) => r.kind === kind && r.mediaId === mediaId)) return

          set((s) => ({
            rankings: s.rankings.filter((r) => !(r.kind === kind && r.mediaId === mediaId)),
          }))
          enqueue({
            key: `ranking:${kind}:${mediaId}`,
            entity: 'ranking',
            action: 'delete',
            payload: { kind, media_id: mediaId },
          })
          log('rank', { mediaId, kind, payload: { to: null } })
        },

        /* ---------------------------------------------------------------- */

        createCollection: (input) => {
          const now = Date.now()
          const slug = uniqueSlug(slugify(input.name), get().collections.map((c) => c.slug))
          const last = get().collections.reduce((max, c) => Math.max(max, c.position), 0)

          const collection: Collection = {
            id: input.id ?? uuid(),
            slug,
            name: input.name,
            description: input.description ?? null,
            coverUrl: input.coverUrl ?? null,
            bannerUrl: input.bannerUrl ?? null,
            tags: input.tags ?? [],
            privacy: input.privacy ?? 'private',
            layout: input.layout ?? 'grid',
            position: last + 1024,
            createdAt: now,
            updatedAt: now,
          }

          set((s) => ({ collections: [...s.collections, collection] }))
          collectionOp(collection)
          log('collection', {
            collectionId: collection.id,
            payload: { to: 'created', collectionName: collection.name },
          })

          return collection.id
        },

        updateCollection: (id, patch) => {
          const current = get().collections.find((c) => c.id === id)
          if (!current) return

          // Renaming re-slugs, but only if the slug wasn't hand-edited.
          const shouldReslug = patch.name != null && current.slug === slugify(current.name)
          const next: Collection = {
            ...current,
            ...patch,
            slug: shouldReslug
              ? uniqueSlug(
                  slugify(patch.name!),
                  get().collections.filter((c) => c.id !== id).map((c) => c.slug),
                )
              : (patch.slug ?? current.slug),
            updatedAt: Date.now(),
          }

          set((s) => ({ collections: s.collections.map((c) => (c.id === id ? next : c)) }))
          collectionOp(next)
        },

        deleteCollection: (id) => {
          const collection = get().collections.find((c) => c.id === id)
          if (!collection) return

          set((s) => ({
            collections: s.collections.filter((c) => c.id !== id),
            collectionItems: s.collectionItems.filter((i) => i.collectionId !== id),
          }))

          // Postgres cascades the items, so only the parent needs deleting.
          enqueue({ key: `collection:${id}`, entity: 'collection', action: 'delete', payload: { id } })
          log('collection', {
            collectionId: id,
            payload: { to: 'deleted', collectionName: collection.name },
          })
        },

        addToCollection: (collectionId, media) => {
          const existing = get().collectionItems.find(
            (i) => i.collectionId === collectionId && i.mediaId === media.id,
          )
          if (existing) return

          const items = itemsFor(collectionId)
          const item: CollectionItem = {
            id: uuid(),
            collectionId,
            mediaId: media.id,
            kind: media.kind,
            note: null,
            position: positionBetween(items[items.length - 1]?.position ?? null, null),
            addedAt: Date.now(),
          }

          set((s) => ({ collectionItems: [...s.collectionItems, item] }))
          itemOp(item)

          const collection = get().collections.find((c) => c.id === collectionId)
          log('collection', {
            mediaId: media.id,
            kind: media.kind,
            collectionId,
            payload: { to: 'added', collectionName: collection?.name },
          })
        },

        removeFromCollection: (collectionId, mediaId) => {
          const item = get().collectionItems.find(
            (i) => i.collectionId === collectionId && i.mediaId === mediaId,
          )
          if (!item) return

          set((s) => ({ collectionItems: s.collectionItems.filter((i) => i.id !== item.id) }))
          enqueue({
            key: `collection_item:${item.id}`,
            entity: 'collection_item',
            action: 'delete',
            payload: { id: item.id },
          })
        },

        setItemNote: (itemId, note) => {
          const item = get().collectionItems.find((i) => i.id === itemId)
          if (!item) return

          const next = { ...item, note }
          set((s) => ({ collectionItems: s.collectionItems.map((i) => (i.id === itemId ? next : i)) }))
          itemOp(next)
        },

        moveCollectionItem: (collectionId, itemId, toIndex) => {
          const ordered = itemsFor(collectionId).filter((i) => i.id !== itemId)
          const index = Math.max(0, Math.min(ordered.length, toIndex))
          const prev = ordered[index - 1]?.position ?? null
          const next = ordered[index]?.position ?? null

          const item = get().collectionItems.find((i) => i.id === itemId)
          if (!item) return

          const moved = { ...item, position: positionBetween(prev, next) }
          set((s) => ({ collectionItems: s.collectionItems.map((i) => (i.id === itemId ? moved : i)) }))
          itemOp(moved)
        },

        /* ---------------------------------------------------------------- */

        updateProfile: (patch) => {
          const next = { ...get().profile, ...patch, updatedAt: Date.now() }
          set({ profile: next })
          enqueue({
            key: 'profile:me',
            entity: 'profile',
            action: 'upsert',
            payload: {
              handle: next.handle,
              display_name: next.displayName,
              bio: next.bio,
              avatar_url: next.avatarUrl,
              banner_url: next.bannerUrl,
              accent: next.accent,
              is_public: next.isPublic,
              widgets: next.widgets,
              favourite_genres: next.favouriteGenres,
            },
            updatedAt: next.updatedAt,
          })
        },

        setWidgets: (widgets) => get().updateProfile({ widgets }),

        /* ---------------------------------------------------------------- */

        hydrateFromRemote: (snapshot) => set((s) => ({ ...s, ...snapshot })),

        reset: () =>
          set({
            entries: {},
            rankings: [],
            collections: [],
            collectionItems: [],
            activity: [],
            profile: emptyProfile,
          }),
      }
    },
    {
      name: 'shelf.library',
      version: 1,
      partialize: (s) => ({
        entries: s.entries,
        rankings: s.rankings,
        collections: s.collections,
        collectionItems: s.collectionItems,
        activity: s.activity,
        profile: s.profile,
      }),
    },
  ),
)
