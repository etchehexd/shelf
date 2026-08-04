import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { AniListError } from './anilist/client'

/**
 * World A's cache. Anime metadata does not change during a session, so it is
 * cached hard and persisted — covers and titles survive a reload, which is what
 * lets the library render instantly offline while the sync layer catches up.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,

      /**
       * These queries are read-only enrichment over a local-first app — the
       * library itself never needs the network. The default 'online' mode parks
       * a failed query until an `online` event arrives, which on a flaky link
       * may be never; the failure mode is a section that stays blank with no
       * error to show for it. Attempting and failing fast is strictly better
       * here, so the retry policy below is the only thing deciding when to stop.
       */
      networkMode: 'always',
      retry: (failureCount, error) => {
        // A missing media id or a malformed query will fail identically forever.
        if (error instanceof AniListError && !error.retryable) return false
        return failureCount < 2
      },
      retryDelay: (attempt) => Math.min(30_000, 1000 * 2 ** attempt),
    },
  },
})

// Dev-only handle for inspecting cache state from the console.
if (import.meta.env.DEV) {
  ;(window as unknown as { __queryClient?: QueryClient }).__queryClient = queryClient
}

/**
 * Bumped whenever the normalized shape changes, so a deploy can't leave users
 * reading last week's field names out of localStorage.
 */
// v2: `synonyms` and `popularity` joined the card fragment. Both feed search
// ranking, and a cached v1 record has neither — which silently ranked the most
// popular titles as though nobody watched them.
const CACHE_VERSION = 'shelf-anilist-v2'

export const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: CACHE_VERSION,
  // localStorage is synchronous; throttling keeps large writes off the
  // interaction path.
  throttleTime: 2000,
})

export const persistOptions = {
  persister,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: CACHE_VERSION,
}
