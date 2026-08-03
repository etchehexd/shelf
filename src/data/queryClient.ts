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
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        // A missing media id or a malformed query will fail identically forever.
        if (error instanceof AniListError && !error.retryable) return false
        return failureCount < 2
      },
      retryDelay: (attempt) => Math.min(30_000, 1000 * 2 ** attempt),
    },
  },
})

/**
 * Bumped whenever the normalized shape changes, so a deploy can't leave users
 * reading last week's field names out of localStorage.
 */
const CACHE_VERSION = 'shelf-anilist-v1'

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
