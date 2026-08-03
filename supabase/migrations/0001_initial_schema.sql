-- ============================================================================
-- Shelf — initial schema
--
-- Design notes:
--
--  * This database stores ONLY personal data. Canonical media metadata
--    (titles, art, episode counts, characters) is never copied here — it lives
--    on AniList and is joined client-side on `media_id`. Copying it would mean
--    owning a stale mirror of someone else's catalogue for no benefit.
--
--  * Ordering everywhere uses a fractional index (`position double precision`)
--    rather than a contiguous integer rank. Dragging one row between two
--    neighbours writes ONE row (the midpoint) instead of renumbering the whole
--    list. Display rank is derived with row_number(), so it is always 1..n even
--    though the stored positions are sparse.
--
--  * `user_id` is denormalised onto collection_items so its RLS policy is a
--    plain column comparison instead of a subquery on every row.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.media_kind as enum ('anime', 'manga', 'novel');

create type public.entry_status as enum (
  'current',    -- watching / reading
  'completed',
  'planning',
  'paused',
  'dropped'
);

create type public.collection_privacy as enum ('private', 'unlisted', 'public');

-- How a collection renders. Part of the collection's identity, not a viewer pref.
create type public.collection_layout as enum ('grid', 'ranked', 'showcase');

create type public.activity_type as enum (
  'added',
  'progress',
  'status',
  'score',
  'rank',
  'collection',
  'note',
  'removed'
);

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  handle         text not null,
  display_name   text not null default 'Reader',
  bio            text,
  avatar_url     text,
  banner_url     text,
  accent         text,                            -- optional custom theme accent (hex)
  is_public      boolean not null default true,
  -- Ordered widget layout for the profile page, e.g.
  -- [{"id":"top-ranked","visible":true}, {"id":"stats","visible":true}, ...]
  widgets        jsonb not null default '[]'::jsonb,
  favourite_genres text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_accent_hex check (accent is null or accent ~* '^#[0-9a-f]{6}$')
);

create unique index profiles_handle_key on public.profiles (handle);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile automatically on signup so the app never has to handle a
-- signed-in user with no profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, 'reader@shelf'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Visibility helper. SECURITY DEFINER so that policies ON profiles can call it
-- without re-entering profiles' own RLS (which would recurse infinitely).
create or replace function public.profile_is_public(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_public from public.profiles where id = uid), false);
$$;

-- ---------------------------------------------------------------------------
-- entries — the library. One row per (user, media).
-- ---------------------------------------------------------------------------

create table public.entries (
  user_id          uuid not null references auth.users (id) on delete cascade,
  media_id         integer not null,               -- AniList media id
  kind             public.media_kind not null,
  status           public.entry_status not null default 'planning',
  progress         integer not null default 0,     -- episodes watched / chapters read
  progress_volumes integer not null default 0,     -- manga & light novels only
  score            numeric(3, 1),                  -- 0.5 .. 10.0 in 0.5 steps
  repeats          integer not null default 0,     -- rewatches / rereads
  note             text,                           -- one short reaction, not a review
  favourite        boolean not null default false,
  started_at       date,
  finished_at      date,
  -- Which browser wrote this row last. Realtime subscribers drop broadcasts
  -- carrying their own device id; without it, the echo of your own write can
  -- land after a newer local edit and visibly rewind the progress number.
  device_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  primary key (user_id, media_id),

  -- One rating scale, viewed two ways: 5 stars at 2 points each == 10-point
  -- scale in half steps. Enforced here so no client can invent a third scale.
  constraint entries_score_range check (
    score is null or (score >= 0.5 and score <= 10.0 and (score * 2) = trunc(score * 2))
  ),
  constraint entries_progress_positive check (progress >= 0 and progress_volumes >= 0),
  constraint entries_repeats_positive check (repeats >= 0),
  constraint entries_note_length check (note is null or char_length(note) <= 280)
);

create index entries_user_status_idx on public.entries (user_id, kind, status);
create index entries_user_updated_idx on public.entries (user_id, updated_at desc);
create index entries_user_score_idx on public.entries (user_id, score desc nulls last);

create trigger entries_touch
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- rankings — the global personal top list, one ordering per media kind.
--
-- Deliberately independent of `score`: a shelf of five 10/10s still has a #1.
-- ---------------------------------------------------------------------------

create table public.rankings (
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       public.media_kind not null,
  media_id   integer not null,
  position   double precision not null,
  updated_at timestamptz not null default now(),

  primary key (user_id, kind, media_id)
);

create index rankings_order_idx on public.rankings (user_id, kind, position);

create trigger rankings_touch
  before update on public.rankings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- collections — the signature feature. Not folders: personal expression.
-- ---------------------------------------------------------------------------

create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  cover_url   text,
  banner_url  text,
  tags        text[] not null default '{}',
  privacy     public.collection_privacy not null default 'private',
  layout      public.collection_layout not null default 'grid',
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint collections_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  constraint collections_name_length check (char_length(name) between 1 and 80),
  constraint collections_description_length check (
    description is null or char_length(description) <= 1000
  ),
  constraint collections_tags_limit check (cardinality(tags) <= 12)
);

create unique index collections_user_slug_key on public.collections (user_id, slug);
create index collections_user_position_idx on public.collections (user_id, position);
-- Partial index: the sharing lookup only ever touches non-private rows.
create index collections_public_idx on public.collections (privacy) where privacy <> 'private';

create trigger collections_touch
  before update on public.collections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- collection_items
-- ---------------------------------------------------------------------------

create table public.collection_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  media_id      integer not null,
  kind          public.media_kind not null,
  note          text,                              -- renders as a pull-quote in showcase layout
  position      double precision not null default 0,
  added_at      timestamptz not null default now(),

  constraint collection_items_note_length check (note is null or char_length(note) <= 280)
);

create unique index collection_items_unique on public.collection_items (collection_id, media_id);
create index collection_items_order_idx on public.collection_items (collection_id, position);
create index collection_items_media_idx on public.collection_items (user_id, media_id);

-- ---------------------------------------------------------------------------
-- activity — append-only event log.
--
-- This is the ONLY history store. The dashboard timeline, per-media history,
-- weekly stats, rating-change feed and profile activity widget are all derived
-- from this table, which is why they can never disagree with each other.
-- Events carry `from` in the payload, which is what makes Undo possible.
-- ---------------------------------------------------------------------------

create table public.activity (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          public.activity_type not null,
  media_id      integer,
  kind          public.media_kind,
  collection_id uuid references public.collections (id) on delete set null,
  payload       jsonb not null default '{}'::jsonb, -- { from, to, ... }
  created_at    timestamptz not null default now()
);

create index activity_user_time_idx on public.activity (user_id, created_at desc);
create index activity_media_idx on public.activity (user_id, media_id, created_at desc);

-- ---------------------------------------------------------------------------
-- follows — powers friend activity. Intentionally minimal: no feed table,
-- no counters, no engagement mechanics.
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),

  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

-- ============================================================================
-- Row level security
--
-- Rule of thumb: you can always read and write your own rows. Other people can
-- read your rows only when you have made them public — profile-level for the
-- library and activity, collection-level for collections.
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.entries          enable row level security;
alter table public.rankings         enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;
alter table public.activity         enable row level security;
alter table public.follows          enable row level security;

-- profiles ------------------------------------------------------------------

create policy "profiles are readable when public or own"
  on public.profiles for select
  using (is_public or id = (select auth.uid()));

create policy "insert own profile"
  on public.profiles for insert
  with check (id = (select auth.uid()));

create policy "update own profile"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- entries -------------------------------------------------------------------

create policy "read own or public entries"
  on public.entries for select
  using (user_id = (select auth.uid()) or public.profile_is_public(user_id));

create policy "write own entries"
  on public.entries for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- rankings ------------------------------------------------------------------

create policy "read own or public rankings"
  on public.rankings for select
  using (user_id = (select auth.uid()) or public.profile_is_public(user_id));

create policy "write own rankings"
  on public.rankings for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- collections ---------------------------------------------------------------

-- 'unlisted' is readable by anyone holding the link; it is simply excluded
-- from listing queries client-side. 'private' is owner-only.
create policy "read own or shared collections"
  on public.collections for select
  using (user_id = (select auth.uid()) or privacy <> 'private');

create policy "write own collections"
  on public.collections for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- collection_items ----------------------------------------------------------

create policy "read items of visible collections"
  on public.collection_items for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.collections c
      where c.id = collection_id and c.privacy <> 'private'
    )
  );

create policy "write own collection items"
  on public.collection_items for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- activity ------------------------------------------------------------------

create policy "read own or public activity"
  on public.activity for select
  using (user_id = (select auth.uid()) or public.profile_is_public(user_id));

create policy "insert own activity"
  on public.activity for insert
  with check (user_id = (select auth.uid()));

-- The log is append-only by design; there is no update policy. Deletion is
-- allowed so a user can erase their own history.
create policy "delete own activity"
  on public.activity for delete
  using (user_id = (select auth.uid()));

-- follows -------------------------------------------------------------------

create policy "read follows involving me or public profiles"
  on public.follows for select
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    or public.profile_is_public(following_id)
  );

create policy "manage own follows"
  on public.follows for all
  using (follower_id = (select auth.uid()))
  with check (follower_id = (select auth.uid()));

-- ============================================================================
-- Realtime — lets a second device (or tab) reflect changes without a refetch.
-- ============================================================================

alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.rankings;
alter publication supabase_realtime add table public.collections;
alter publication supabase_realtime add table public.collection_items;
alter publication supabase_realtime add table public.activity;
