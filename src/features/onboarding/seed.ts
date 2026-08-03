import { useEffect, useRef } from 'react'
import { anilist } from '@/data/anilist/client'
import { resolveKind } from '@/data/anilist/normalize'
import { totalUnits, type MediaKind } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { enqueue } from '@/data/sync/outbox'
import { deviceId, positionBetween, slugify, uuid } from '@/lib/ids'
import type {
  ActivityEvent,
  Collection,
  CollectionItem,
  EntryStatus,
  LibraryEntry,
  RankingEntry,
} from '@/data/store/types'

/**
 * First-run library.
 *
 * Titles are resolved by *search* rather than hardcoded AniList ids. Hardcoded
 * ids look tidier but are unverifiable — one wrong digit seeds someone's shelf
 * with the wrong show and nothing in the type system catches it. One aliased
 * query resolves every title at once and asks for three fields, so the cost is
 * a single small request.
 */

interface SeedTitle {
  search: string
  kind: MediaKind
  status: EntryStatus
  /**
   * Pinning the format matters more than it looks. A bare search for
   * "Frieren: Beyond Journey's End" resolves to a spin-off special, and
   * "Hunter x Hunter" resolves to the 1999 series rather than the 2011 one —
   * both of which seed a shelf with quietly wrong data.
   */
  format?: string
  /** In the kind's own unit: episodes, chapters, or volumes for novels. */
  progress?: number
  /** Secondary volume counter — manga only. */
  volumes?: number
  score?: number
  favourite?: boolean
  note?: string
  /** Position in the global top list for its kind, 1-based. */
  rank?: number
  /** How many days ago this was last touched — spreads the activity feed out. */
  daysAgo: number
}

const SEED: SeedTitle[] = [
  // anime
  { search: 'Sousou no Frieren', kind: 'anime', format: 'TV', status: 'completed', progress: 28, score: 10, rank: 1, favourite: true, note: 'The quietest possible epic. Nothing else is close.', daysAgo: 2 },
  { search: 'Steins;Gate', kind: 'anime', format: 'TV', status: 'completed', progress: 24, score: 10, rank: 2, favourite: true, daysAgo: 34 },
  { search: 'Cowboy Bebop', kind: 'anime', format: 'TV', status: 'completed', progress: 26, score: 10, rank: 3, note: 'Best soundtrack ever committed to animation.', daysAgo: 61 },
  { search: 'Monster', kind: 'anime', format: 'TV', status: 'completed', progress: 74, score: 9.5, rank: 4, daysAgo: 88 },
  { search: 'Vinland Saga', kind: 'anime', format: 'TV', status: 'completed', progress: 24, score: 9.5, rank: 5, daysAgo: 12 },
  { search: 'Mushishi', kind: 'anime', format: 'TV', status: 'completed', progress: 26, score: 9, favourite: true, note: 'Puts me to sleep in the best way.', daysAgo: 40 },
  { search: 'Violet Evergarden', kind: 'anime', format: 'TV', status: 'completed', progress: 13, score: 9.5, daysAgo: 20 },
  { search: 'Mob Psycho 100', kind: 'anime', format: 'TV', status: 'completed', progress: 12, score: 9, daysAgo: 55 },
  { search: 'Koe no Katachi', kind: 'anime', format: 'MOVIE', status: 'completed', progress: 1, score: 9, daysAgo: 71 },
  { search: 'Nichijou', kind: 'anime', format: 'TV', status: 'completed', progress: 26, score: 8.5, note: 'Genuinely the funniest thing ever animated.', daysAgo: 96 },
  { search: 'Hunter x Hunter 2011', kind: 'anime', format: 'TV', status: 'current', progress: 84, daysAgo: 0 },
  { search: 'Chainsaw Man', kind: 'anime', format: 'TV', status: 'current', progress: 7, daysAgo: 1 },
  { search: 'Made in Abyss', kind: 'anime', format: 'TV', status: 'paused', progress: 9, daysAgo: 47 },
  { search: 'Ping Pong the Animation', kind: 'anime', format: 'TV', status: 'planning', daysAgo: 5 },
  { search: 'Hibike! Euphonium', kind: 'anime', format: 'TV', status: 'planning', daysAgo: 9 },

  // manga — progress counts chapters, with volumes as a secondary marker
  { search: 'Oyasumi Punpun', kind: 'manga', status: 'completed', progress: 147, volumes: 13, score: 10, rank: 1, daysAgo: 26 },
  { search: 'Vagabond', kind: 'manga', status: 'current', progress: 220, volumes: 24, score: 9.5, rank: 2, daysAgo: 3 },
  { search: 'Berserk', kind: 'manga', status: 'current', progress: 364, volumes: 41, daysAgo: 6 },
  { search: 'Blame!', kind: 'manga', status: 'planning', daysAgo: 14 },

  // light novels — progress counts volumes, the unit they're published in
  { search: 'Ookami to Koushinryou', kind: 'novel', status: 'current', progress: 6, score: 9, daysAgo: 4 },
  { search: 'Mushoku Tensei', kind: 'novel', status: 'planning', daysAgo: 17 },
]

const COLLECTIONS: { name: string; description: string; layout: Collection['layout']; privacy: Collection['privacy']; tags: string[]; members: string[] }[] = [
  {
    name: 'Comfort shows',
    description: 'For when the day has been too long and I want to be somewhere gentle.',
    layout: 'showcase',
    privacy: 'public',
    tags: ['cozy', 'rewatch'],
    members: ['Mushishi', 'Nichijou', 'Sousou no Frieren', 'Hibike! Euphonium'],
  },
  {
    name: 'Shows that changed how I watch',
    description: 'Each of these moved the ceiling for me.',
    layout: 'ranked',
    privacy: 'public',
    tags: ['formative'],
    members: ['Cowboy Bebop', 'Monster', 'Steins;Gate', 'Oyasumi Punpun', 'Ping Pong the Animation'],
  },
  {
    name: 'Best soundtracks',
    description: 'Scores I put on while working.',
    layout: 'grid',
    privacy: 'unlisted',
    tags: ['music'],
    members: ['Cowboy Bebop', 'Vinland Saga', 'Made in Abyss', 'Violet Evergarden'],
  },
]

const DAY = 86_400_000

/* -------------------------------------------------------------------------- */

interface SeedResult {
  id: number
  type?: string
  format?: string
  episodes?: number | null
  chapters?: number | null
  volumes?: number | null
}

function buildQuery(titles: SeedTitle[]): string {
  const fields = titles.map((t, i) => {
    const type = t.kind === 'anime' ? 'ANIME' : 'MANGA'
    const format = t.format ?? (t.kind === 'novel' ? 'NOVEL' : t.kind === 'manga' ? 'MANGA' : null)

    const filter = [`type: ${type}`, format ? `format: ${format}` : null].filter(Boolean).join(', ')

    // One aliased request for the whole list, asking for six fields.
    // JSON.stringify keeps quoting safe for titles containing punctuation.
    return `  m${i}: Media(search: ${JSON.stringify(t.search)}, ${filter}) { id type format episodes chapters volumes }`
  })

  return `query Seed {\n${fields.join('\n')}\n}`
}

export async function seedLibrary(): Promise<boolean> {
  const query = buildQuery(SEED)

  let data: Record<string, SeedResult | null>
  try {
    data = await anilist<typeof data>(query)
  } catch {
    // A failed seed must leave a usable empty app, not a broken one.
    return false
  }

  const now = Date.now()
  const entries: Record<number, LibraryEntry> = {}
  const rankings: RankingEntry[] = []
  const activity: ActivityEvent[] = []
  const idByTitle = new Map<string, { id: number; kind: MediaKind }>()

  SEED.forEach((seed, i) => {
    const raw = data[`m${i}`]
    if (!raw?.id) return

    const kind = resolveKind(raw)
    const touched = now - seed.daysAgo * DAY
    idByTitle.set(seed.search, { id: raw.id, kind })

    // Clamp to whatever AniList actually reports. A seeded number that exceeds
    // the real total renders as "Episode 84 of 62", and no amount of care in
    // the list above can prevent a search resolving to a shorter cut.
    const total = totalUnits({
      kind,
      episodes: raw.episodes ?? null,
      chapters: raw.chapters ?? null,
      volumes: raw.volumes ?? null,
    })
    const progress =
      total != null ? Math.min(seed.progress ?? 0, total) : (seed.progress ?? 0)

    entries[raw.id] = {
      mediaId: raw.id,
      kind,
      status: seed.status,
      progress,
      progressVolumes: Math.min(seed.volumes ?? 0, raw.volumes ?? seed.volumes ?? 0),
      score: seed.score ?? null,
      repeats: 0,
      note: seed.note ?? null,
      favourite: seed.favourite ?? false,
      startedAt: seed.status === 'planning' ? null : isoDaysAgo(seed.daysAgo + 30),
      finishedAt: seed.status === 'completed' ? isoDaysAgo(seed.daysAgo) : null,
      createdAt: touched - 30 * DAY,
      updatedAt: touched,
    }

    if (seed.rank != null) {
      rankings.push({ kind, mediaId: raw.id, position: seed.rank * 1024, updatedAt: touched })
    }

    // A believable history: added, then progressed, then rated.
    activity.push(event('added', raw.id, kind, touched - 30 * DAY, { to: 'planning' }))

    if (progress) {
      activity.push(
        event('progress', raw.id, kind, touched, {
          from: Math.max(0, progress - 1),
          to: progress,
          ...(kind === 'novel' ? { unit: 'volume' } : {}),
        }),
      )
    }

    if (seed.status === 'completed') {
      activity.push(event('status', raw.id, kind, touched, { from: 'current', to: 'completed' }))
    }

    if (seed.score != null) {
      activity.push(event('score', raw.id, kind, touched - 2 * 3600_000, { from: null, to: seed.score }))
    }
  })

  if (Object.keys(entries).length === 0) return false

  /* collections ----------------------------------------------------------- */

  const collections: Collection[] = []
  const collectionItems: CollectionItem[] = []

  COLLECTIONS.forEach((spec, index) => {
    const id = uuid()
    const createdAt = now - (index + 3) * DAY

    collections.push({
      id,
      slug: slugify(spec.name),
      name: spec.name,
      description: spec.description,
      coverUrl: null,
      bannerUrl: null,
      tags: spec.tags,
      privacy: spec.privacy,
      layout: spec.layout,
      position: (index + 1) * 1024,
      createdAt,
      updatedAt: createdAt,
    })

    let previous: number | null = null
    for (const title of spec.members) {
      const member = idByTitle.get(title)
      if (!member) continue

      const position = positionBetween(previous, null)
      previous = position

      collectionItems.push({
        id: uuid(),
        collectionId: id,
        mediaId: member.id,
        kind: member.kind,
        note: null,
        position,
        addedAt: createdAt,
      })
    }

    activity.push({
      id: uuid(),
      type: 'collection',
      mediaId: null,
      kind: null,
      collectionId: id,
      payload: { to: 'created', collectionName: spec.name },
      createdAt,
    })
  })

  /* commit ---------------------------------------------------------------- */

  activity.sort((a, b) => b.createdAt - a.createdAt)

  useLibrary.getState().hydrateFromRemote({
    entries,
    rankings,
    collections,
    collectionItems,
    activity: activity.slice(0, 1000),
    profile: {
      ...useLibrary.getState().profile,
      bio: 'Slow watcher. Fond of quiet shows and long manga.',
      favouriteGenres: ['Slice of Life', 'Drama', 'Adventure'],
      updatedAt: now,
    },
  })

  // Queue everything so a later sign-in pushes the seeded library up rather
  // than leaving it stranded on this device.
  queueSeed(entries, rankings, collections, collectionItems, activity)

  return true
}

/* -------------------------------------------------------------------------- */

function event(
  type: ActivityEvent['type'],
  mediaId: number,
  kind: MediaKind,
  createdAt: number,
  payload: ActivityEvent['payload'],
): ActivityEvent {
  return { id: uuid(), type, mediaId, kind, collectionId: null, payload, createdAt }
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10)
}

function queueSeed(
  entries: Record<number, LibraryEntry>,
  rankings: RankingEntry[],
  collections: Collection[],
  items: CollectionItem[],
  activity: ActivityEvent[],
) {
  const device = deviceId()

  for (const e of Object.values(entries)) {
    void enqueue({
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
        device_id: device,
      },
      updatedAt: e.updatedAt,
    })
  }

  for (const r of rankings) {
    void enqueue({
      key: `ranking:${r.kind}:${r.mediaId}`,
      entity: 'ranking',
      action: 'upsert',
      payload: { kind: r.kind, media_id: r.mediaId, position: r.position },
      updatedAt: r.updatedAt,
    })
  }

  for (const c of collections) {
    void enqueue({
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
  }

  for (const i of items) {
    void enqueue({
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
  }

  for (const a of activity) {
    void enqueue({
      key: `activity:${a.id}`,
      entity: 'activity',
      action: 'upsert',
      payload: {
        id: a.id,
        type: a.type,
        media_id: a.mediaId,
        kind: a.kind,
        collection_id: a.collectionId,
        payload: a.payload,
        created_at: new Date(a.createdAt).toISOString(),
      },
      updatedAt: a.createdAt,
    })
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Runs once, only when the library is genuinely empty. An empty app can't show
 * what any of this is for, and a first-time user has nothing to look at.
 */
export function useSeedOnFirstRun() {
  const onboarded = usePrefs((s) => s.onboarded)
  const setOnboarded = usePrefs((s) => s.setOnboarded)
  const started = useRef(false)

  useEffect(() => {
    if (onboarded || started.current) return

    const empty = Object.keys(useLibrary.getState().entries).length === 0
    if (!empty) {
      setOnboarded(true)
      return
    }

    started.current = true
    void seedLibrary().then((ok) => {
      if (ok) setOnboarded(true)
    })
  }, [onboarded, setOnboarded])
}
