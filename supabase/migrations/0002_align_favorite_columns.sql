-- ============================================================================
-- Align the favorite columns with the code
--
-- The app spells everything the American way — `favorite`, `favorite_genres` —
-- and 0001 declares those names. Databases provisioned before that rename
-- still carry the British originals:
--
--     entries.favourite          →  entries.favorite
--     profiles.favourite_genres  →  profiles.favorite_genres
--
-- This is not cosmetic. The sync layer writes the American names (see
-- `EntryRow` and `ProfileRow` in src/data/supabase/client.ts), so against an
-- un-renamed database *every* push carrying a favorite is rejected by
-- PostgREST with "column does not exist". The failure is quiet from inside the
-- app — the outbox retries, the row never lands, and the local copy looks
-- correct because it is.
--
-- Safe to run on a database that is already correct: each rename is guarded on
-- the old column existing and the new one not, so this is a no-op the second
-- time and on any install created from 0001 as written.
--
-- No data moves. `alter table ... rename column` preserves the values, the
-- type, the constraints and the indexes — this only changes the name.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entries' and column_name = 'favourite'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entries' and column_name = 'favorite'
  ) then
    alter table public.entries rename column favourite to favorite;
    raise notice 'renamed entries.favourite -> entries.favorite';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'favourite_genres'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'favorite_genres'
  ) then
    alter table public.profiles rename column favourite_genres to favorite_genres;
    raise notice 'renamed profiles.favourite_genres -> profiles.favorite_genres';
  end if;
end
$$;
