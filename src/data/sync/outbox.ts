import { idb, idbAvailable } from './idb'

/**
 * The write queue. See ARCHITECTURE.md §Why local-first.
 *
 * Ops are keyed, and enqueue is a `put`, so tapping +1 eight times during a
 * binge collapses into ONE op carrying `progress: 8` rather than eight
 * requests. That is the difference between an evening of watching costing a
 * handful of writes and costing hundreds.
 */

export type OpEntity =
  | 'entry'
  | 'ranking'
  | 'collection'
  | 'collection_item'
  | 'activity'
  | 'profile'

export interface Op {
  key: string
  entity: OpEntity
  action: 'upsert' | 'delete'
  payload: Record<string, unknown>
  updatedAt: number
  attempts: number
  lastError?: string
}

type Listener = (pending: number) => void
const listeners = new Set<Listener>()

/** Mirror of the queue depth so the UI can show sync state without hitting IDB. */
let pending = 0

function notify() {
  for (const l of listeners) l(pending)
}

export function onOutboxChange(listener: Listener): () => void {
  listeners.add(listener)
  listener(pending)
  return () => listeners.delete(listener)
}

export function pendingCount() {
  return pending
}

/**
 * Key format is `${entity}:${identity}`. Entities whose rows are mutable share
 * a key per row so later writes replace earlier ones. Activity events are
 * append-only and each carries a unique key so nothing is ever collapsed away.
 */
export async function enqueue(op: Omit<Op, 'attempts' | 'updatedAt'> & { updatedAt?: number }) {
  if (!idbAvailable) return

  const record: Op = {
    ...op,
    updatedAt: op.updatedAt ?? Date.now(),
    attempts: 0,
  }

  try {
    const existing = await peek(record.key)
    await idb.put(
      existing && existing.action === 'upsert' && record.action === 'upsert'
        ? // Merge rather than replace: two edits to different fields of the same
          // row before a flush must both survive.
          { ...existing, payload: { ...existing.payload, ...record.payload }, updatedAt: record.updatedAt, attempts: 0 }
        : record,
    )
    pending = (await idb.all<Op>()).length
    notify()
  } catch {
    // A failed enqueue must never break the interaction that caused it.
  }
}

async function peek(key: string): Promise<Op | undefined> {
  const all = await idb.all<Op>()
  return all.find((o) => o.key === key)
}

export async function drain(): Promise<Op[]> {
  if (!idbAvailable) return []
  try {
    const ops = await idb.all<Op>()
    pending = ops.length
    notify()
    // Oldest first, so a create lands before the update that follows it.
    return ops.sort((a, b) => a.updatedAt - b.updatedAt)
  } catch {
    return []
  }
}

export async function settle(key: string) {
  await idb.delete(key)
  pending = Math.max(0, pending - 1)
  notify()
}

export async function retryLater(op: Op, error: string) {
  await idb.put({ ...op, attempts: op.attempts + 1, lastError: error })
}

/**
 * Permanent failures — an RLS denial, a constraint violation — would otherwise
 * retry forever and block everything behind them. They move to a dead-letter
 * list surfaced in Settings so the data isn't silently lost either.
 */
export async function deadLetter(op: Op, error: string) {
  await idb.put({ ...op, lastError: error }, idb.DEAD)
  await settle(op.key)
}

export async function deadLetters(): Promise<Op[]> {
  if (!idbAvailable) return []
  try {
    return await idb.all<Op>(idb.DEAD)
  } catch {
    return []
  }
}

export async function clearDeadLetters() {
  await idb.clear(idb.DEAD)
}

export async function clearOutbox() {
  await idb.clear()
  pending = 0
  notify()
}

/** Exponential backoff with jitter, capped so a long outage still recovers promptly. */
export function backoffMs(attempts: number): number {
  const base = Math.min(60_000, 1000 * 2 ** attempts)
  return base + Math.random() * base * 0.3
}
