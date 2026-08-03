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

/** AniList allows 90/min. 80 leaves headroom for anything else on the page. */
const BUDGET = 80
const WINDOW_MS = 60_000

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
    if (issued.length < BUDGET) {
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
  if (existing) return existing as Promise<T>

  const promise = (async () => {
    // Two attempts: one to discover a 429, one after parking for it.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await acquire()

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      })

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') ?? '60')
        parkedUntil = Date.now() + retryAfter * 1000
        if (attempt === 0) continue
        throw new AniListError('AniList rate limit reached', 429, true)
      }

      if (res.status >= 500) {
        throw new AniListError('AniList is unavailable', res.status, true)
      }

      const json = (await res.json()) as GraphQLResponse<T>

      if (json.errors?.length) {
        const first = json.errors[0]
        // 404 from AniList means "no such media", which is not retryable.
        throw new AniListError(first.message, first.status ?? res.status, false)
      }

      if (!json.data) {
        throw new AniListError('Empty response from AniList', res.status, true)
      }

      return json.data
    }

    throw new AniListError('AniList rate limit reached', 429, true)
  })()

  inFlight.set(key, promise)
  try {
    return await promise
  } finally {
    inFlight.delete(key)
  }
}

/** Exposed for the sync/status UI in Settings. */
export function rateLimitState() {
  prune(Date.now())
  return {
    used: issued.length,
    budget: BUDGET,
    parkedUntil: parkedUntil > Date.now() ? parkedUntil : null,
  }
}
