import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { MediaKind, MediaSummary } from '@/data/anilist/types'
import { startOfDay } from '@/lib/dates'
import { useLibrary } from './library'
import type { ActivityEvent, Collection, EntryStatus, LibraryEntry } from './types'

/* ---------------------------------------------------------------- entries -- */

export function useEntry(mediaId: number | null | undefined): LibraryEntry | undefined {
  return useLibrary((s) => (mediaId ? s.entries[mediaId] : undefined))
}

export function useAllEntries(): LibraryEntry[] {
  const entries = useLibrary((s) => s.entries)
  return useMemo(() => Object.values(entries), [entries])
}

export function useEntriesOfKind(kind: MediaKind): LibraryEntry[] {
  const entries = useAllEntries()
  return useMemo(() => entries.filter((e) => e.kind === kind), [entries, kind])
}

export function useStatusCounts(kind: MediaKind): Record<EntryStatus, number> {
  const entries = useEntriesOfKind(kind)
  return useMemo(() => {
    const counts: Record<EntryStatus, number> = {
      current: 0,
      completed: 0,
      planning: 0,
      paused: 0,
      dropped: 0,
    }
    for (const e of entries) counts[e.status] += 1
    return counts
  }, [entries])
}

/**
 * The dashboard's "Continue" rail. Ordered by most recently touched, because
 * the thing you watched last night is the thing you want tonight.
 */
export function useContinueList(limit = 12): LibraryEntry[] {
  const entries = useAllEntries()
  return useMemo(
    () =>
      entries
        .filter((e) => e.status === 'current')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit),
    [entries, limit],
  )
}

export function useRecentlyCompleted(limit = 12): LibraryEntry[] {
  const entries = useAllEntries()
  return useMemo(
    () =>
      entries
        .filter((e) => e.status === 'completed')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit),
    [entries, limit],
  )
}

/**
 * Titles within a few units of the end.
 *
 * The dashboard leads with this because "two episodes left" is the single most
 * actionable thing a tracker knows about you — far more useful than a count of
 * everything in progress.
 */
export function almostDone(
  entries: LibraryEntry[],
  media: Map<number, MediaSummary>,
  within = 3,
): { entry: LibraryEntry; media: MediaSummary; left: number }[] {
  const out: { entry: LibraryEntry; media: MediaSummary; left: number }[] = []

  for (const entry of entries) {
    if (entry.status !== 'current') continue
    const m = media.get(entry.mediaId)
    if (!m) continue

    const total = m.kind === 'anime' ? m.episodes : m.kind === 'novel' ? m.volumes : m.chapters
    if (total == null || total <= 1) continue

    const left = total - entry.progress
    if (left > 0 && left <= within) out.push({ entry, media: m, left })
  }

  return out.sort((a, b) => a.left - b.left || b.entry.updatedAt - a.entry.updatedAt)
}

/** Everything you're watching that AniList says has an episode on the way. */
export function airingQueue(
  entries: LibraryEntry[],
  media: Map<number, MediaSummary>,
): { entry: LibraryEntry; media: MediaSummary; airingAt: number; episode: number }[] {
  const out: { entry: LibraryEntry; media: MediaSummary; airingAt: number; episode: number }[] = []

  for (const entry of entries) {
    if (entry.status !== 'current' && entry.status !== 'planning') continue
    const m = media.get(entry.mediaId)
    const next = m?.nextAiringEpisode
    if (!m || !next) continue
    out.push({ entry, media: m, airingAt: next.airingAt, episode: next.episode })
  }

  return out.sort((a, b) => a.airingAt - b.airingAt)
}

/**
 * Recently scored titles, newest verdict first.
 *
 * Prefers the activity log, because "the order you made up your mind" is more
 * interesting than "the order the rows were touched". Falls back to the entries
 * themselves so an imported library — which has scores but no history — still
 * fills the shelf instead of showing nothing.
 */
export function useRecentlyRated(limit = 12, minScore = 1): LibraryEntry[] {
  const activity = useActivity()
  const entries = useLibrary((s) => s.entries)

  return useMemo(() => {
    const seen = new Set<number>()
    const out: LibraryEntry[] = []

    for (const event of activity) {
      if (event.type !== 'score' || event.payload.to == null || event.mediaId == null) continue
      if (seen.has(event.mediaId)) continue
      seen.add(event.mediaId)

      const entry = entries[event.mediaId]
      if (entry?.score != null && entry.score >= minScore) out.push(entry)
      if (out.length >= limit) break
    }

    if (out.length >= limit) return out

    for (const entry of Object.values(entries)) {
      if (out.length >= limit) break
      if (entry.score == null || entry.score < minScore || seen.has(entry.mediaId)) continue
      seen.add(entry.mediaId)
      out.push(entry)
    }

    return out
  }, [activity, entries, limit, minScore])
}

/** Your best, by score — the shelf you'd point at. */
export function useHighestRated(limit = 12, kind?: MediaKind): LibraryEntry[] {
  const entries = useAllEntries()
  return useMemo(
    () =>
      entries
        .filter((e) => e.score != null && (!kind || e.kind === kind))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.updatedAt - a.updatedAt)
        .slice(0, limit),
    [entries, limit, kind],
  )
}

/** Everything you marked a favorite, newest first. */
export function useFavorites(limit = 12): LibraryEntry[] {
  const entries = useAllEntries()
  return useMemo(
    () =>
      entries
        .filter((e) => e.favorite)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit),
    [entries, limit],
  )
}

/* --------------------------------------------------------------- rankings -- */

export function useRankedIds(kind: MediaKind): number[] {
  return useLibrary(
    useShallow((s) =>
      s.rankings
        .filter((r) => r.kind === kind)
        .sort((a, b) => a.position - b.position)
        .map((r) => r.mediaId),
    ),
  )
}

/** Display rank is derived from order, so it always reads 1..n. */
export function useRank(kind: MediaKind, mediaId: number): number | null {
  const ids = useRankedIds(kind)
  const index = ids.indexOf(mediaId)
  return index === -1 ? null : index + 1
}

/* ------------------------------------------------------------ collections -- */

export function useCollections(): Collection[] {
  return useLibrary(useShallow((s) => [...s.collections].sort((a, b) => a.position - b.position)))
}

export function useCollection(id: string | undefined) {
  return useLibrary((s) => s.collections.find((c) => c.id === id || c.slug === id))
}

export function useCollectionItems(collectionId: string | undefined) {
  return useLibrary(
    useShallow((s) =>
      s.collectionItems
        .filter((i) => i.collectionId === collectionId)
        .sort((a, b) => a.position - b.position),
    ),
  )
}

/** Which collections contain this title — shown high on the media page. */
export function useCollectionsContaining(mediaId: number): Collection[] {
  return useLibrary(
    useShallow((s) => {
      const ids = new Set(
        s.collectionItems.filter((i) => i.mediaId === mediaId).map((i) => i.collectionId),
      )
      return s.collections.filter((c) => ids.has(c.id))
    }),
  )
}

/** First four covers, used for a collection card's fanned mosaic. */
export function useCollectionCoverIds(collectionId: string, limit = 4): number[] {
  return useLibrary(
    useShallow((s) =>
      s.collectionItems
        .filter((i) => i.collectionId === collectionId)
        .sort((a, b) => a.position - b.position)
        .slice(0, limit)
        .map((i) => i.mediaId),
    ),
  )
}

/* -------------------------------------------------------------- activity -- */

export function useActivity(limit?: number): ActivityEvent[] {
  return useLibrary(useShallow((s) => (limit ? s.activity.slice(0, limit) : s.activity)))
}

export function useMediaActivity(mediaId: number, limit = 40): ActivityEvent[] {
  return useLibrary(
    useShallow((s) => s.activity.filter((e) => e.mediaId === mediaId).slice(0, limit)),
  )
}

export interface ActivityDay {
  day: number
  events: ActivityEvent[]
}

export function groupByDay(events: ActivityEvent[]): ActivityDay[] {
  const groups = new Map<number, ActivityEvent[]>()
  for (const event of events) {
    const day = startOfDay(event.createdAt)
    const list = groups.get(day)
    if (list) list.push(event)
    else groups.set(day, [event])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, dayEvents]) => ({ day, events: dayEvents }))
}

/* ------------------------------------------------------------------ stats -- */

export interface WeekStats {
  episodes: number
  chapters: number
  completed: number
  rated: number
}

/** Everything on the dashboard's "this week" tiles, derived from the log alone. */
export function useWeekStats(days = 7): WeekStats {
  const activity = useActivity()

  return useMemo(() => {
    const since = startOfDay(Date.now()) - (days - 1) * 86_400_000
    const stats: WeekStats = { episodes: 0, chapters: 0, completed: 0, rated: 0 }

    for (const e of activity) {
      if (e.createdAt < since) break // activity is newest-first

      if (e.type === 'progress' && e.payload.unit !== 'volume') {
        const from = Number(e.payload.from ?? 0)
        const to = Number(e.payload.to ?? 0)
        const delta = Math.max(0, to - from)
        if (e.kind === 'anime') stats.episodes += delta
        else stats.chapters += delta
      }

      if (e.type === 'status' && e.payload.to === 'completed') stats.completed += 1
      if (e.type === 'score' && e.payload.to != null) stats.rated += 1
    }

    return stats
  }, [activity, days])
}

/** Buckets scores 1..10, folding halves into the integer below. */
export function useRatingDistribution(kind?: MediaKind): number[] {
  const entries = useAllEntries()

  return useMemo(() => {
    const buckets = new Array<number>(10).fill(0)
    for (const e of entries) {
      if (kind && e.kind !== kind) continue
      if (e.score == null) continue
      buckets[Math.min(9, Math.max(0, Math.ceil(e.score) - 1))] += 1
    }
    return buckets
  }, [entries, kind])
}

export interface GenreAffinity {
  genre: string
  count: number
  averageScore: number | null
}

/**
 * Genre affinity weighted by *your* scores, not by how many you've watched —
 * "I rate slice-of-life highly" is a stronger signal than "I've seen a lot of
 * action". Discover uses the same shape to title its rows.
 */
export function genreAffinity(
  entries: LibraryEntry[],
  media: Map<number, MediaSummary>,
  limit = 8,
): GenreAffinity[] {
  const totals = new Map<string, { count: number; scoreSum: number; scored: number }>()

  for (const entry of entries) {
    const m = media.get(entry.mediaId)
    if (!m) continue

    for (const genre of m.genres) {
      const t = totals.get(genre) ?? { count: 0, scoreSum: 0, scored: 0 }
      t.count += 1
      if (entry.score != null) {
        t.scoreSum += entry.score
        t.scored += 1
      }
      totals.set(genre, t)
    }
  }

  return [...totals.entries()]
    .map(([genre, t]) => ({
      genre,
      count: t.count,
      averageScore: t.scored > 0 ? t.scoreSum / t.scored : null,
    }))
    .sort((a, b) => {
      // Rank by average score, but require a couple of titles so one 10/10
      // doesn't crown a genre you've barely touched.
      const aScore = a.count >= 2 && a.averageScore != null ? a.averageScore : 0
      const bScore = b.count >= 2 && b.averageScore != null ? b.averageScore : 0
      return bScore - aScore || b.count - a.count
    })
    .slice(0, limit)
}

export interface LibraryTotals {
  titles: number
  episodes: number
  chapters: number
  volumes: number
  minutes: number
  meanScore: number | null
}

export function libraryTotals(entries: LibraryEntry[], media: Map<number, MediaSummary>): LibraryTotals {
  let episodes = 0
  let chapters = 0
  let volumes = 0
  let minutes = 0
  let scoreSum = 0
  let scored = 0

  for (const e of entries) {
    const m = media.get(e.mediaId)

    if (e.kind === 'anime') {
      const watched = e.progress + (m?.episodes ?? 0) * e.repeats
      episodes += watched
      // AniList omits duration on the card fragment; 24m is the standard
      // TV-episode assumption and is only used for a soft "time spent" stat.
      minutes += watched * 24
    } else {
      chapters += e.progress
      volumes += e.progressVolumes
    }

    if (e.score != null) {
      scoreSum += e.score
      scored += 1
    }
  }

  return {
    titles: entries.length,
    episodes,
    chapters,
    volumes,
    minutes,
    meanScore: scored > 0 ? scoreSum / scored : null,
  }
}

/** The ids the library needs hydrated from AniList — everything we track. */
export function useTrackedIds(): number[] {
  return useLibrary(
    useShallow((s) => {
      const ids = new Set<number>()
      for (const id of Object.keys(s.entries)) ids.add(Number(id))
      for (const item of s.collectionItems) ids.add(item.mediaId)
      for (const rank of s.rankings) ids.add(rank.mediaId)
      return [...ids]
    }),
  )
}
