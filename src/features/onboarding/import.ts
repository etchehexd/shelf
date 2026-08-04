import { anilist } from '@/data/anilist/client'
import { resolveKind } from '@/data/anilist/normalize'
import { totalUnits, type MediaKind } from '@/data/anilist/types'
import type { EntryStatus, LibraryEntry } from '@/data/store/types'

/**
 * Bringing an existing library in.
 *
 * This is the *only* place in the product that knows other tracking sites
 * exist. It runs during first-run onboarding and nowhere else — once someone
 * has a shelf, the app never mentions where it came from again.
 *
 * Two routes, because they are the two people actually have:
 *
 *   AniList     a username. One request, the whole list, no file handling.
 *   MyAnimeList the XML export. Rows carry MAL ids, which we resolve to
 *               AniList ids in aliased batches so a 500-title list costs
 *               about a dozen requests rather than five hundred.
 */

export interface ImportProgress {
  /** 0–1, or null while the size of the job is still unknown. */
  ratio: number | null
  message: string
}

export type ProgressFn = (progress: ImportProgress) => void

/* ------------------------------------------------------------------ shared -- */

interface RawListMedia {
  id: number
  type?: string | null
  format?: string | null
  episodes?: number | null
  chapters?: number | null
  volumes?: number | null
}

function fuzzyToIso(date: { year?: number | null; month?: number | null; day?: number | null } | null | undefined) {
  if (!date?.year) return null
  return `${date.year}-${String(date.month ?? 1).padStart(2, '0')}-${String(date.day ?? 1).padStart(2, '0')}`
}

/**
 * Builds a library entry from a resolved media row plus whatever the source
 * told us, and enforces the app's own rules on the way in — progress can never
 * exceed the real total, and a score is only kept on something completed.
 */
function toEntry(
  media: RawListMedia,
  input: {
    status: EntryStatus
    progress: number
    progressVolumes: number
    score: number | null
    repeats: number
    note: string | null
    startedAt: string | null
    finishedAt: string | null
    updatedAt: number
  },
): LibraryEntry {
  const kind = resolveKind(media)

  const total = totalUnits({
    kind,
    episodes: media.episodes ?? null,
    chapters: media.chapters ?? null,
    volumes: media.volumes ?? null,
  })

  const progress = Math.max(0, total != null ? Math.min(input.progress, total) : input.progress)

  return {
    mediaId: media.id,
    kind,
    status: input.status,
    progress,
    progressVolumes: Math.max(0, Math.min(input.progressVolumes, media.volumes ?? input.progressVolumes)),
    // The app's scale is whole numbers 1–10, and only on finished titles.
    score:
      input.status === 'completed' && input.score != null && input.score > 0
        ? Math.min(10, Math.max(1, Math.round(input.score)))
        : null,
    repeats: Math.max(0, input.repeats),
    note: input.note?.trim() ? input.note.trim() : null,
    favorite: false,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  }
}

/* ---------------------------------------------------------------- AniList -- */

const ANILIST_STATUS: Record<string, EntryStatus> = {
  CURRENT: 'current',
  PLANNING: 'planning',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PAUSED: 'paused',
  REPEATING: 'current',
}

const LIST_FIELDS = `
    status
    progress
    progressVolumes
    score(format: POINT_10)
    repeat
    notes
    startedAt { year month day }
    completedAt { year month day }
    updatedAt
    media { id type format episodes chapters volumes }`

const IMPORT_QUERY = `
query Import($name: String!) {
  anime: MediaListCollection(userName: $name, type: ANIME) {
    lists { entries {${LIST_FIELDS} } }
  }
  manga: MediaListCollection(userName: $name, type: MANGA) {
    lists { entries {${LIST_FIELDS} } }
  }
}`

interface RawListEntry {
  status?: string | null
  progress?: number | null
  progressVolumes?: number | null
  score?: number | null
  repeat?: number | null
  notes?: string | null
  startedAt?: { year?: number | null; month?: number | null; day?: number | null } | null
  completedAt?: { year?: number | null; month?: number | null; day?: number | null } | null
  updatedAt?: number | null
  media?: RawListMedia | null
}

interface RawCollection {
  lists?: ({ entries?: (RawListEntry | null)[] | null } | null)[] | null
}

export async function importFromAniList(
  username: string,
  onProgress?: ProgressFn,
): Promise<LibraryEntry[]> {
  const name = username.trim()
  if (!name) throw new Error('Enter a username first.')

  onProgress?.({ ratio: null, message: 'Fetching the list…' })

  const data = await anilist<{ anime: RawCollection | null; manga: RawCollection | null }>(
    IMPORT_QUERY,
    { name },
  )

  const rows: RawListEntry[] = []
  for (const collection of [data.anime, data.manga]) {
    for (const list of collection?.lists ?? []) {
      for (const entry of list?.entries ?? []) if (entry?.media?.id) rows.push(entry)
    }
  }

  if (rows.length === 0) {
    throw new Error(`No public list found for “${name}”.`)
  }

  // Custom lists repeat the same title, so the last write wins per media id.
  const byId = new Map<number, LibraryEntry>()

  for (const row of rows) {
    const media = row.media!
    const status = ANILIST_STATUS[row.status ?? ''] ?? 'planning'

    byId.set(
      media.id,
      toEntry(media, {
        status,
        progress: row.progress ?? 0,
        progressVolumes: row.progressVolumes ?? 0,
        score: row.score ?? null,
        repeats: row.repeat ?? 0,
        note: row.notes ?? null,
        startedAt: fuzzyToIso(row.startedAt),
        finishedAt: fuzzyToIso(row.completedAt),
        updatedAt: row.updatedAt ? row.updatedAt * 1000 : Date.now(),
      }),
    )
  }

  onProgress?.({ ratio: 1, message: `${byId.size} titles ready` })
  return [...byId.values()]
}

/* ------------------------------------------------------------ MyAnimeList -- */

const MAL_STATUS: Record<string, EntryStatus> = {
  watching: 'current',
  reading: 'current',
  completed: 'completed',
  'on-hold': 'paused',
  onhold: 'paused',
  dropped: 'dropped',
  'plan to watch': 'planning',
  'plan to read': 'planning',
  plantowatch: 'planning',
  plantoread: 'planning',
}

interface MalRow {
  malId: number
  type: 'ANIME' | 'MANGA'
  status: EntryStatus
  progress: number
  progressVolumes: number
  score: number
  repeats: number
  note: string | null
  startedAt: string | null
  finishedAt: string | null
}

const text = (parent: Element, tag: string): string =>
  parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''

const num = (parent: Element, tag: string): number => {
  const n = Number.parseInt(text(parent, tag), 10)
  return Number.isNaN(n) ? 0 : n
}

/** MAL writes "0000-00-00" for "never". */
const malDate = (parent: Element, tag: string): string | null => {
  const value = text(parent, tag)
  return !value || value.startsWith('0000') ? null : value
}

/**
 * Parses a MyAnimeList XML export. Pure — no network, so a malformed file
 * fails immediately and locally rather than halfway through an import.
 */
export function parseMalExport(xml: string): MalRow[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error("That file isn't valid XML. Export it again from MyAnimeList.")
  }

  const rows: MalRow[] = []

  const read = (tag: 'anime' | 'manga', idTag: string) => {
    for (const node of [...doc.getElementsByTagName(tag)]) {
      const malId = num(node, idTag)
      if (!malId) continue

      const rawStatus = text(node, tag === 'anime' ? 'my_status' : 'my_status')
        .toLowerCase()
        .replace(/\s+/g, ' ')

      rows.push({
        malId,
        type: tag === 'anime' ? 'ANIME' : 'MANGA',
        status: MAL_STATUS[rawStatus] ?? 'planning',
        progress: tag === 'anime' ? num(node, 'my_watched_episodes') : num(node, 'my_read_chapters'),
        progressVolumes: tag === 'anime' ? 0 : num(node, 'my_read_volumes'),
        score: num(node, 'my_score'),
        repeats: num(node, tag === 'anime' ? 'my_times_watched' : 'my_times_read'),
        note: text(node, 'my_comments') || null,
        startedAt: malDate(node, 'my_start_date'),
        finishedAt: malDate(node, 'my_finish_date'),
      })
    }
  }

  read('anime', 'series_animedb_id')
  read('manga', 'series_mangadb_id')

  if (rows.length === 0) {
    throw new Error('No titles found in that file.')
  }

  return rows
}

/** How many MAL ids to resolve per request. Comfortably inside AniList's limits. */
const RESOLVE_CHUNK = 40

/**
 * MAL ids → AniList ids, in aliased batches.
 *
 * Titles AniList doesn't know are simply dropped: a shelf missing three obscure
 * entries is a far better outcome than an import that refuses to finish.
 */
export async function importFromMal(xml: string, onProgress?: ProgressFn): Promise<LibraryEntry[]> {
  const rows = parseMalExport(xml)
  const out: LibraryEntry[] = []

  for (let i = 0; i < rows.length; i += RESOLVE_CHUNK) {
    const batch = rows.slice(i, i + RESOLVE_CHUNK)

    onProgress?.({
      ratio: i / rows.length,
      message: `Matching titles — ${Math.min(i + batch.length, rows.length)} of ${rows.length}`,
    })

    const query = `query Resolve {\n${batch
      .map(
        (row, n) =>
          `  r${n}: Media(idMal: ${row.malId}, type: ${row.type}) { id type format episodes chapters volumes }`,
      )
      .join('\n')}\n}`

    let data: Record<string, RawListMedia | null>
    try {
      data = await anilist<Record<string, RawListMedia | null>>(query)
    } catch {
      // A whole batch failing shouldn't lose the batches that worked.
      continue
    }

    batch.forEach((row, n) => {
      const media = data[`r${n}`]
      if (!media?.id) return

      out.push(
        toEntry(media, {
          status: row.status,
          progress: row.progress,
          progressVolumes: row.progressVolumes,
          score: row.score,
          repeats: row.repeats,
          note: row.note,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          updatedAt: Date.now(),
        }),
      )
    })
  }

  if (out.length === 0) {
    throw new Error("None of those titles could be matched. Check it's the right export file.")
  }

  onProgress?.({ ratio: 1, message: `${out.length} titles ready` })
  return out
}

export type { MediaKind }
