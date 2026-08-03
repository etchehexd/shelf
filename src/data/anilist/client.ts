/**
 * A small hand-rolled GraphQL client for AniList.
 *
 * Not Apollo/urql: the app issues about eight distinct queries and what it
 * actually needs is precise control over AniList's rate limit, which is far
 * less code than configuring a full client would be.
 *
 * Provides a token bucket, `Retry-After` compliance, in-flight de-duplication
 * and typed errors.
 */

const ENDPOINT = 'https://graphql.anilist.co'

/**
 * AniList *documents* 90 requests/minute, but the enforced value has been 30
 * for a long time and it is only discoverable from the `x-ratelimit-limit`
 * response header. Hardcoding the documented number quietly breaks the app:
 * requests sail past the real ceiling, come back 429, and whole rows of the UI
 * vanish with no visible error.
 *
 * So the budget starts pessimistic and re-derives itself from every response.
 * If AniList raises the limit again, the client picks it up on the next call.
 */
const DEFAULT_BUDGET = 28
const WINDOW_MS = 60_000

let budget = DEFAULT_BUDGET

export class AniListError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'AniListError'
  }
}

/** Timestamps of requests issued inside the current window. */
let issued: number[] = []
/** When rate-limited, the whole queue parks until this time. */
let parkedUntil = 0

const inFlight = new Map<string, Promise<unknown>>()

function prune(now: number) {
  issued = issued.filter((t) => now - t < WINDOW_MS)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Blocks until a token is available. Requests queue rather than fail, so a
 * page that mounts thirty cards degrades to "slightly slower" instead of
 * "half the cards error".
 */
async function acquire(): Promise<void> {
  for (;;) {
    const now = Date.now()

    if (now < parkedUntil) {
      await sleep(parkedUntil - now)
      continue
    }

    prune(now)
    if (issued.length < budget) {
      issued.push(now)
      return
    }

    // Wait until the oldest request falls out of the window.
    await sleep(WINDOW_MS - (now - issued[0]) + 50)
  }
}

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string; status?: number }[]
}

export async function anilist<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const key = JSON.stringify({ query, variables })

  // Ten cards mounting with the same media id should issue one request.
  const existing = inFlight.get(key)
  const promise = (existing as Promise<T> | undefined) ?? startRequest<T>(key, query, variables)

  if (!signal) return promise

  /**
   * Cancellation is per-caller, never shared.
   *
   * The shared promise deliberately does NOT receive anyone's AbortSignal. It
   * used to, and the result was a subtle killer: React StrictMode mounts,
   * TanStack starts a query, StrictMode unmounts and aborts that signal — and
   * because the promise was shared, the abort rejected it for *every* current
   * and future caller. The remount then joined the already-dead promise and the
   * query sat at `fetchStatus: 'paused'` forever, blanking whole sections of the
   * UI with no error to show for it.
   *
   * So an abort only makes *this* caller stop waiting. The underlying request
   * runs to completion and still populates the cache, which is what you want
   * anyway — the work is already paid for.
   */
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(abortError())

    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })

    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

function abortError() {
  return new DOMException('Aborted', 'AbortError')
}

function startRequest<T>(key: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const promise = (async () => {
    await acquire()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })

    observeLimit(res.headers)

    if (res.status === 429) {
      // Park the shared bucket, then fail fast. Sleeping out the Retry-After
      // in-band would hold the request open for up to a minute with no way for
      // the caller to give up; the retry will queue behind the park anyway.
      const retryAfter = Number(res.headers.get('Retry-After') ?? '60')
      parkedUntil = Date.now() + Math.min(retryAfter, 60) * 1000
      throw new AniListError('AniList rate limit reached', 429, true)
    }

    if (res.status >= 500) {
      throw new AniListError('AniList is unavailable', res.status, true)
    }

    const json = (await res.json()) as GraphQLResponse<T>

    if (json.errors?.length) {
      const first = json.errors[0]
      // A missing media id fails identically forever; don't retry it.
      throw new AniListError(first.message, first.status ?? res.status, false)
    }

    if (!json.data) {
      throw new AniListError('Empty response from AniList', res.status, true)
    }

    return json.data
  })()

  inFlight.set(key, promise)

  // Free the slot once settled so a later caller starts a fresh request. The
  // trailing catch keeps a rejection here from surfacing as an unhandled one —
  // the real callers still receive and handle it.
  promise
    .finally(() => inFlight.delete(key))
    .catch(() => {})

  return promise
}

/**
 * Re-derive the budget from what the server just told us. Two headroom slots
 * are reserved so a burst that races the window boundary still can't tip over.
 */
function observeLimit(headers: Headers) {
  const limit = Number(headers.get('x-ratelimit-limit'))
  if (Number.isFinite(limit) && limit > 0) {
    budget = Math.max(4, limit - 2)
  }

  // If the server says we're nearly out, stop issuing until the window rolls
  // rather than discovering it with a 429.
  const remaining = Number(headers.get('x-ratelimit-remaining'))
  if (Number.isFinite(remaining) && remaining <= 1) {
    parkedUntil = Math.max(parkedUntil, Date.now() + 5_000)
  }
}

/** Exposed for the sync/status UI in Settings. */
export function rateLimitState() {
  prune(Date.now())
  return {
    used: issued.length,
    budget,
    parkedUntil: parkedUntil > Date.now() ? parkedUntil : null,
  }
}
