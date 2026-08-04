import { supabase, type ActivityRow, type CollectionItemRow, type CollectionRow, type EntryRow, type ProfileRow, type RankingRow } from '@/data/supabase/client'
import { useLibrary } from '@/data/store/library'
import { DEFAULT_WIDGETS, type ActivityEvent, type Collection, type CollectionItem, type LibraryEntry, type RankingEntry, type WidgetConfig } from '@/data/store/types'

/**
 * Initial hydration on sign-in.
 *
 * Conflict rule is row-level last-write-wins on `updated_at`: whichever side
 * touched a row more recently keeps it. Rows are small and edits are naturally
 * scoped to one row at a time (you change progress on one title, a score on
 * another), so row granularity loses nothing in practice — and the schema
 * carries one timestamp per row, not per column, so anything finer would be
 * inventing information we don't have.
 *
 * Activity is append-only and union-merged by id rather than compared.
 */
export async function pullSnapshot(userId: string): Promise<void> {
  if (!supabase) return

  const [entries, rankings, collections, items, activity, profile] = await Promise.all([
    supabase.from('entries').select('*').eq('user_id', userId),
    supabase.from('rankings').select('*').eq('user_id', userId),
    supabase.from('collections').select('*').eq('user_id', userId),
    supabase.from('collection_items').select('*').eq('user_id', userId),
    supabase.from('activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1000),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ])

  const local = useLibrary.getState()

  /* entries ---------------------------------------------------------------- */

  const mergedEntries = { ...local.entries }
  for (const row of (entries.data ?? []) as EntryRow[]) {
    const remote = toEntry(row)
    const mine = mergedEntries[remote.mediaId]
    if (!mine || remote.updatedAt > mine.updatedAt) mergedEntries[remote.mediaId] = remote
  }

  /* rankings --------------------------------------------------------------- */

  const rankKey = (r: { kind: string; mediaId: number }) => `${r.kind}:${r.mediaId}`
  const mergedRanks = new Map(local.rankings.map((r) => [rankKey(r), r]))
  for (const row of (rankings.data ?? []) as RankingRow[]) {
    const remote: RankingEntry = {
      kind: row.kind as RankingEntry['kind'],
      mediaId: row.media_id,
      position: row.position,
      updatedAt: Date.parse(row.updated_at) || 0,
    }
    const mine = mergedRanks.get(rankKey(remote))
    if (!mine || remote.updatedAt > mine.updatedAt) mergedRanks.set(rankKey(remote), remote)
  }

  /* collections ------------------------------------------------------------ */

  const mergedCollections = new Map(local.collections.map((c) => [c.id, c]))
  for (const row of (collections.data ?? []) as CollectionRow[]) {
    const remote = toCollection(row)
    const mine = mergedCollections.get(remote.id)
    if (!mine || remote.updatedAt > mine.updatedAt) mergedCollections.set(remote.id, remote)
  }

  // Items have no updated_at — they are effectively immutable apart from note
  // and position, both of which flush immediately. Union by id, remote first.
  const mergedItems = new Map(local.collectionItems.map((i) => [i.id, i]))
  for (const row of (items.data ?? []) as CollectionItemRow[]) {
    if (!mergedItems.has(row.id)) mergedItems.set(row.id, toItem(row))
  }

  /* activity --------------------------------------------------------------- */

  const mergedActivity = new Map(local.activity.map((e) => [e.id, e]))
  for (const row of (activity.data ?? []) as ActivityRow[]) {
    if (!mergedActivity.has(row.id)) mergedActivity.set(row.id, toActivity(row))
  }

  /* profile ---------------------------------------------------------------- */

  const profileRow = profile.data as ProfileRow | null
  const remoteProfile = profileRow ? toProfile(profileRow) : null
  const keepLocalProfile = remoteProfile == null || local.profile.updatedAt > remoteProfile.updatedAt

  useLibrary.getState().hydrateFromRemote({
    entries: mergedEntries,
    rankings: [...mergedRanks.values()],
    collections: [...mergedCollections.values()],
    collectionItems: [...mergedItems.values()],
    activity: [...mergedActivity.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 1000),
    ...(keepLocalProfile ? {} : { profile: remoteProfile! }),
  })
}

/* ------------------------------------------------------------- row mappers -- */

function toEntry(row: EntryRow): LibraryEntry {
  return {
    mediaId: row.media_id,
    kind: row.kind as LibraryEntry['kind'],
    status: row.status as LibraryEntry['status'],
    progress: row.progress,
    progressVolumes: row.progress_volumes,
    score: row.score == null ? null : Number(row.score),
    repeats: row.repeats,
    note: row.note,
    favorite: row.favorite,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: Date.parse(row.created_at) || Date.now(),
    updatedAt: Date.parse(row.updated_at) || Date.now(),
  }
}

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverUrl: row.cover_url,
    bannerUrl: row.banner_url,
    tags: row.tags ?? [],
    privacy: row.privacy as Collection['privacy'],
    layout: row.layout as Collection['layout'],
    position: row.position,
    createdAt: Date.parse(row.created_at) || Date.now(),
    updatedAt: Date.parse(row.updated_at) || Date.now(),
  }
}

function toItem(row: CollectionItemRow): CollectionItem {
  return {
    id: row.id,
    collectionId: row.collection_id,
    mediaId: row.media_id,
    kind: row.kind as CollectionItem['kind'],
    note: row.note,
    position: row.position,
    addedAt: Date.parse(row.added_at) || Date.now(),
  }
}

function toActivity(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type as ActivityEvent['type'],
    mediaId: row.media_id,
    kind: row.kind as ActivityEvent['kind'],
    collectionId: row.collection_id,
    payload: (row.payload ?? {}) as ActivityEvent['payload'],
    createdAt: Date.parse(row.created_at) || Date.now(),
  }
}

function toProfile(row: ProfileRow) {
  return {
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    accent: row.accent,
    isPublic: row.is_public,
    widgets: normalizeWidgets(row.widgets),
    favoriteGenres: row.favorite_genres ?? [],
    updatedAt: Date.parse(row.updated_at) || Date.now(),
  }
}

/** The column is jsonb, so it can hold anything; fall back to defaults. */
function normalizeWidgets(value: unknown): WidgetConfig[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_WIDGETS
  const known = new Set(DEFAULT_WIDGETS.map((w) => w.id))
  const parsed = value.filter(
    (w): w is WidgetConfig =>
      typeof w === 'object' && w != null && 'id' in w && known.has((w as WidgetConfig).id),
  )
  return parsed.length > 0 ? parsed : DEFAULT_WIDGETS
}
