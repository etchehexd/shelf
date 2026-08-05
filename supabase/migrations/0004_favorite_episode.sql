-- ============================================================================
-- entries.favorite_episode
--
-- The one episode of a series you would point at. Stored as JSON rather than
-- as two integers because the episode *name* is kept alongside the numbers:
-- names come from a second catalog (TMDB) that is optional and may not be
-- configured on the device reading the row, so "S2E18" alone would be
-- unreadable to a client without a key. Denormalizing the name is what makes
-- the field survive that.
--
-- Nullable with no default. Most entries will never have one, and an empty
-- object would be a lie about a decision nobody made.
--
-- Safe to re-run.
-- ============================================================================

alter table public.entries
  add column if not exists favorite_episode jsonb;

comment on column public.entries.favorite_episode is
  'Denormalized favorite episode: { season, episode, name, stillPath }. Null when unset.';
