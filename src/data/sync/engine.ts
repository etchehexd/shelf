import { supabase } from '@/data/supabase/client'
import type { LibraryEntry } from '@/data/store/types'
import { useLibrary } from '@/data/store/library'
import { deviceId } from '@/lib/ids'
import { backoffMs, deadLetter, drain, onOutboxChange, retryLater, settle, type Op } from './outbox'
import { pushOp } from './push'
import { pullSnapshot } from './pull'

/**
 * Drives the outbox.
 *
 * Flush is sequential — ops for the same row must land in order, and the
 * volume is low enough (one op per changed row, coalesced) that parallelism
 * would buy nothing but race conditions.
 */

const MAX_ATTEMPTS = 8
const IDLE_INTERVAL = 30_000

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error' | 'disabled'

type StatusListener = (status: SyncStatus, pending: number) => void

let flushing = false
let stopped = true
let userId: string | null = null
let timer: number | null = null
let status: SyncStatus = 'disabled'

const statusListeners = new Set<StatusListener>()
let pendingMirror = 0

function setStatus(next: SyncStatus) {
  if (status === next) return
  status = next
  for (const l of statusListeners) l(status, pendingMirror)
}

export function onSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  listener(status, pendingMirror)
  return () => statusListeners.delete(listener)
}

export function syncStatus() {
  return { status, pending: pendingMirror }
}

/* -------------------------------------------------------------------------- */

export async function flush(): Promise<void> {
  if (flushing || stopped || !userId || !supabase) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus('offline')
    return
  }

  flushing = true
  setStatus('syncing')

  try {
    const ops = await drain()
    if (ops.length === 0) {
      setStatus('idle')
      return
    }

    let failed = false

    for (const op of ops) {
      if (stopped) break

      const result = await pushOp(op, userId)

      if (result === 'ok') {
        await settle(op.key)
      } else if (result === 'dead') {
        await deadLetter(op, op.lastError ?? 'Rejected by the server')
      } else {
        failed = true
        if (op.attempts + 1 >= MAX_ATTEMPTS) {
          await deadLetter(op, 'Gave up after repeated failures')
        } else {
          await retryLater(op, 'Retrying')
          scheduleRetry(op)
        }
        // Stop the pass: if one write is failing, the rest almost certainly
        // will too, and hammering a dead endpoint helps nobody.
        break
      }
    }

    setStatus(failed ? 'error' : 'idle')
  } finally {
    flushing = false
  }
}

function scheduleRetry(op: Op) {
  if (timer != null) window.clearTimeout(timer)
  timer = window.setTimeout(() => void flush(), backoffMs(op.attempts))
}

/* -------------------------------------------------------------------------- */

let unsubscribeOutbox: (() => void) | null = null
let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

export async function startSync(id: string) {
  if (!supabase) {
    setStatus('disabled')
    return
  }

  userId = id
  stopped = false
  setStatus('idle')

  // Remote wins for anything the local copy has never seen; see pull.ts for the
  // conflict rule.
  await pullSnapshot(id)

  unsubscribeOutbox?.()
  unsubscribeOutbox = onOutboxChange((pending) => {
    pendingMirror = pending
    if (pending > 0) void flush()
  })

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  if (timer != null) window.clearInterval(timer)
  timer = window.setInterval(() => void flush(), IDLE_INTERVAL)

  subscribeRealtime(id)
  void flush()
}

export function stopSync() {
  stopped = true
  userId = null
  unsubscribeOutbox?.()
  unsubscribeOutbox = null

  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)

  if (timer != null) {
    window.clearInterval(timer)
    timer = null
  }

  if (realtimeChannel && supabase) {
    void supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  setStatus('disabled')
}

function onOnline() {
  setStatus('idle')
  void flush()
}

function onOffline() {
  setStatus('offline')
}

/* -------------------------------------------------------------------------- */

/**
 * Realtime keeps a second device (or a second tab) current.
 *
 * Echoes of our own writes are dropped by device id — without this, an in-flight
 * local edit gets overwritten by the round trip of the edit before it, and the
 * progress number visibly jumps backwards.
 */
function subscribeRealtime(id: string) {
  if (!supabase) return

  const me = deviceId()

  realtimeChannel = supabase
    .channel(`shelf:${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${id}` },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null
        if (!row || row.device_id === me) return
        applyRemoteEntry(row)
      },
    )
    .subscribe()
}

function applyRemoteEntry(row: Record<string, unknown>) {
  const mediaId = Number(row.media_id)
  const remoteUpdated = Date.parse(String(row.updated_at))
  const local = useLibrary.getState().entries[mediaId]

  // Row-level last-write-wins on updated_at. A local edit that is newer than
  // the broadcast is a pending write that hasn't flushed yet — keep it.
  if (local && local.updatedAt >= remoteUpdated) return

  useLibrary.setState((s) => ({
    entries: {
      ...s.entries,
      [mediaId]: {
        mediaId,
        kind: row.kind as never,
        status: row.status as never,
        progress: Number(row.progress ?? 0),
        progressVolumes: Number(row.progress_volumes ?? 0),
        score: row.score == null ? null : Number(row.score),
        repeats: Number(row.repeats ?? 0),
        note: (row.note as string) ?? null,
        favorite: Boolean(row.favorite),
        favoriteEpisode: (row.favorite_episode as LibraryEntry['favoriteEpisode']) ?? null,
        startedAt: (row.started_at as string) ?? null,
        finishedAt: (row.finished_at as string) ?? null,
        createdAt: Date.parse(String(row.created_at)) || Date.now(),
        updatedAt: remoteUpdated || Date.now(),
      },
    },
  }))
}
