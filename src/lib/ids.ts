/**
 * UUIDs are generated on the client so that append-only rows (activity events,
 * collection items) are idempotent: replaying a queued op after a flaky flush
 * inserts the same primary key rather than a duplicate.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Stable per-browser id, used to drop realtime echoes of our own writes. */
export function deviceId(): string {
  const KEY = 'shelf.device'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = uuid()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'ephemeral'
  }
}

/** "Comfort Shows!" → "comfort-shows" */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents left by NFKD
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')

  // The schema requires a leading alphanumeric and 1..64 chars.
  return base || 'collection'
}

/** Ensure a slug is unique within a set, appending -2, -3, … */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken)
  if (!set.has(base)) return base
  let n = 2
  while (set.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

const STEP = 1024

/**
 * Fractional index between two neighbours. See ARCHITECTURE.md — dragging a row
 * writes one midpoint rather than renumbering the whole list.
 *
 * `prev`/`next` are the positions either side of the drop target; pass null for
 * the ends of the list.
 */
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return STEP
  if (prev == null) return next! - STEP
  if (next == null) return prev + STEP
  return (prev + next) / 2
}

/**
 * Float precision runs out after ~50 consecutive midpoint inserts in the same
 * gap. Callers check this and reindex the list to clean multiples of STEP.
 */
export function needsReindex(positions: number[]): boolean {
  for (let i = 1; i < positions.length; i += 1) {
    if (Math.abs(positions[i] - positions[i - 1]) < 1e-6) return true
  }
  return false
}

export function reindex<T>(items: T[], set: (item: T, position: number) => T): T[] {
  return items.map((item, i) => set(item, (i + 1) * STEP))
}
