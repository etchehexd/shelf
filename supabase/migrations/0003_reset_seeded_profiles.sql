-- ============================================================================
-- Reset seeded profile identities
--
-- DESTRUCTIVE. Read this before running it.
-- Requires 0002 to have run first — it references `favorite_genres`.
--
-- Early builds of this app created every profile pre-filled: a display name
-- derived from the email's local part and a hand-picked handle. The schema no
-- longer does that (see `handle_new_user` in 0001 — new rows arrive empty with
-- a machine identifier), but rows created *before* that change still carry the
-- persona, and signing in pulls it straight back down onto a freshly wiped
-- client. Fixing the trigger cannot fix data that already exists.
--
-- So this clears the identity fields on existing rows, in place:
--
--   handle          → user_<first 12 hex of the row's own uuid>
--   display_name    → ''
--   bio             → null
--   avatar_url      → null
--   banner_url      → null
--   accent          → null
--   is_public       → false
--   favorite_genres → {}
--
-- What it does NOT touch: the auth user, entries, rankings, collections,
-- collection items, activity, or the widget layout. Nobody loses a library
-- over this — only the name on the door.
--
-- Scope: EVERY row in public.profiles. On a single-user install that is the
-- point. If this database has other people's accounts in it, narrow the WHERE
-- clause to your own id before running:
--
--     where id = '00000000-0000-0000-0000-000000000000'
--
-- Run it once, from the SQL editor, then sign out and back in.
-- ============================================================================

update public.profiles
set
  -- Matches `handle_new_user` exactly. The column is `not null` and checked
  -- against '^[a-z0-9_]{3,24}$', so it cannot simply be emptied — an
  -- identifier is unavoidable here. It is not an identity: every screen that
  -- renders a name asks `display_name` first and shows nothing when it is
  -- blank.
  handle = 'user_' || substr(replace(id::text, '-', ''), 1, 12),
  display_name = '',
  bio = null,
  avatar_url = null,
  banner_url = null,
  accent = null,
  is_public = false,
  favorite_genres = '{}';

-- The `profiles_touch` trigger moves `updated_at` forward on its own, which
-- matters: the client keeps whichever copy of a profile is newer, so without a
-- bumped timestamp a stale local copy of the old identity would win the merge
-- on the next pull and write the persona straight back to the server.
