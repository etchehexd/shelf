import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase client, or `null`.
 *
 * Null is a first-class state, not an error: with no credentials the app runs
 * in local-only mode where everything works and nothing syncs. Crucially this
 * is the *same* code path with sync disabled rather than a parallel offline
 * implementation, so it cannot rot.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const configured =
  typeof url === 'string' &&
  url.startsWith('http') &&
  typeof anonKey === 'string' &&
  anonKey.length > 20 &&
  // Guard against someone copying .env.example verbatim.
  !url.includes('your-project-ref')

export const supabase: SupabaseClient | null = configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 4 } },
    })
  : null

export const isSyncConfigured = configured

/** Row shapes, kept beside the client so table names live in exactly one place. */
export interface EntryRow {
  user_id: string
  media_id: number
  kind: string
  status: string
  progress: number
  progress_volumes: number
  score: number | null
  repeats: number
  note: string | null
  favorite: boolean
  favorite_episode: { season: number; episode: number; name: string; stillPath: string | null } | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export interface RankingRow {
  user_id: string
  kind: string
  media_id: number
  position: number
  updated_at: string
}

export interface CollectionRow {
  id: string
  user_id: string
  slug: string
  name: string
  description: string | null
  cover_url: string | null
  banner_url: string | null
  tags: string[]
  privacy: string
  layout: string
  position: number
  created_at: string
  updated_at: string
}

export interface CollectionItemRow {
  id: string
  collection_id: string
  user_id: string
  media_id: number
  kind: string
  note: string | null
  position: number
  added_at: string
}

export interface ActivityRow {
  id: string
  user_id: string
  type: string
  media_id: number | null
  kind: string | null
  collection_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export interface ProfileRow {
  id: string
  handle: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  accent: string | null
  is_public: boolean
  widgets: unknown
  favorite_genres: string[]
  created_at: string
  updated_at: string
}
