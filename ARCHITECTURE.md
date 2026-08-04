# Shelf — Architecture

## The one decision everything else follows from

There are **two worlds of data**, and they are never mixed.

| | World A — Canon | World B — Personal |
|---|---|---|
| What | titles, art, episode counts, characters, staff, genres | status, progress, score, rank, collections, notes, history |
| Origin | AniList GraphQL | the user |
| Truth lives | AniList's servers | **Supabase Postgres** |
| Mutability | read-only, effectively immutable | mutated constantly |
| Owner in code | TanStack Query | Zustand store + sync outbox |
| Join key | `mediaId` (AniList numeric id) | `media_id` |

Supabase stores **only World B**. No anime metadata is ever copied into Postgres —
that would mean owning a stale mirror of someone else's catalog in exchange for nothing.
A row in `entries` is `(user_id, media_id, status, progress, score, …)` and that is all.

```
                    ┌──────────────────────────────────┐
                    │           components             │
                    └───────┬──────────────────┬───────┘
                  useMedia()│                  │useEntry(), useTracking()
                            ▼                  ▼
              ┌─────────────────────┐   ┌────────────────────────┐
              │   TanStack Query    │   │  Zustand (authoritative │
              │   cache + persist   │   │  in-session copy)      │
              └──────────┬──────────┘   └───────────┬────────────┘
                         │                          │ every mutation
                normalize│                          ▼
                         │              ┌────────────────────────┐
                         │              │   outbox (IndexedDB)   │
                         │              └───────────┬────────────┘
                         │                          │ flush, batched
                         ▼                          ▼
              ┌─────────────────────┐   ┌────────────────────────┐
              │  AniList GraphQL    │   │  Supabase (Postgres +  │
              │  rate-limited client│   │  RLS + Realtime + Auth)│
              └─────────────────────┘   └────────────────────────┘
```

---

## Why local-first, and not just `await supabase.update()`

Pressing `+1 episode` is the single most repeated action in this app. If it awaits a
round trip it costs 100–400ms, needs a pending state, and has a failure mode — on the
interaction the entire product is built around.

So the write path is:

```
press +1
  → zustand.applyLocal(patch)        ~0ms   UI springs immediately
  → outbox.enqueue(op)               ~0ms   durable in IndexedDB
  ─────────────────────────────────────── the user is already gone
  → flush() → supabase upsert        ~200ms invisible
  → realtime echo arrives → ignored (own device_id)
```

Consequences worth stating, because they are the reason the app feels the way it does:

1. **No network in the write path.** The 280ms spring animation *is* the whole latency
   budget, not a mask over one.
2. **Offline works.** Not as a degraded mode — it is the normal mode, with a sync that
   happens to be running. Close the laptop mid-episode, reopen on a plane, keep tracking.
3. **AniList outages can't touch your data.** The worst case is a card showing a skeleton.
   Progress, scores and collections are unaffected.
4. **Rate limits can't corrupt anything.** Same reason.

### The outbox

`src/data/sync/outbox.ts`. Each queued op is:

```ts
type Op = {
  id: string
  entity: 'entry' | 'ranking' | 'collection' | 'collection_item' | 'activity' | 'profile'
  kind: 'upsert' | 'delete'
  key: string          // dedupe key, e.g. "entry:12345"
  payload: unknown
  updatedAt: number    // client clock, used for conflict resolution
  attempts: number
}
```

- **Coalescing.** Ops are keyed. Tapping `+1` eight times enqueues one op with
  `progress: 8`, not eight ops. This is the difference between a binge session costing 1
  request and costing 40.
- **Ordering.** Flush is sequential per key, parallel across keys. `activity` ops are
  insert-only and never coalesce — the log must keep every event.
- **Retry.** Exponential backoff with jitter, capped at 60s. Permanent failures (RLS
  denial, constraint violation) are dropped to a dead-letter list surfaced in Settings
  rather than retried forever.
- **Durability.** IndexedDB, not memory, so a refresh mid-flush loses nothing.

### Conflict resolution

Row-level last-write-wins on `updated_at`: whichever side touched a row more recently
keeps it. Rows are small and edits are naturally scoped to one at a time — you change
progress on one title and a score on another — so row granularity loses nothing in
practice. Anything finer would be inventing information the schema doesn't carry: there is
one timestamp per row, not one per column.

`activity` never conflicts. It's append-only with UUID primary keys generated on the
client, so replaying a queued op after a flaky flush inserts the same key rather than a
duplicate event.

Realtime updates carry the originating `device_id` in the payload; the store drops echoes
of its own writes so an in-flight local edit is never overwritten by its own round trip.

### Degrading to local-only

If `VITE_SUPABASE_URL` is unset, the client is `null`, the outbox never flushes, and
everything else works unchanged against `localStorage`. This is not a special mode with its
own code path — it is the same code path with sync disabled, which is why it can't rot.

---

## World B: the data model

Full schema in [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql).

| Table | Holds |
|---|---|
| `profiles` | 1:1 with `auth.users`; handle, bio, avatar, banner, widget layout, public flag |
| `entries` | the library — PK `(user_id, media_id)`, status, progress, volumes, score, note |
| `rankings` | the global personal top list, one ordering per media kind |
| `collections` | name, description, cover, banner, tags, privacy, layout |
| `collection_items` | membership + per-item note + per-collection order |
| `activity` | append-only event log |
| `follows` | friend activity; no feed table, no counters |

### Ratings

One column: `entries.score smallint`, a whole number `1–10`, enforced by a check constraint.
`Rating` renders it as five stars where one star = 2 points, so every score has an exact
picture — 7 is three and a half stars. There is no second scale and no conversion anywhere;
"five stars" and "out of ten" are the same field viewed two ways.

Stars are the *only* rendering of a personal score in the product. A bare numeral in a
poster corner — which is what this used to be — is unreadable at a glance and, worse,
indistinguishable from the community score, the episode count and the rank that share that
artwork. The community number is a different shape, a different scale and one of four cool
color bands (`--score-hi/good/fair/weak`), deliberately never ember, so the two can't be
confused from across the room. See DESIGN.md §The two scores.

A score is a verdict on the finished work, so it is only valid on a completed entry. That
rule is enforced three times over, because each layer can be reached without the others: the
UI gates every affordance on `canRate(status)`, `setScore` clamps and rounds whatever it is
handed, and the database carries `entries_score_needs_completion` for anything arriving from
a bulk import or another client.

### Rankings — global *and* per-collection

Deliberately independent of score, which is the whole point: a shelf of 10/10s still has
a #1.

Both use a **fractional index** (`position double precision`). Dropping a row between two
neighbors writes the midpoint `(prev + next) / 2` — one row updated, not the whole list
renumbered. Display rank comes from `row_number()`, so it always reads 1..n even though
stored positions are sparse. A normalization pass reindexes when gaps get too small for
float precision.

This matters more than it sounds: with contiguous integer ranks, dragging item #90 to #1
in a top-100 is 90 row updates and 90 outbox ops. Here it's one.

### The activity log is the source of truth for history

Nothing else stores history. The dashboard timeline, per-media "your history", weekly
stats, the rating-change feed, the profile activity widget and collection activity are
**all selectors over this one table**. They cannot disagree with each other, and a new kind
of history view is a selector, not a schema change. Every event carries `payload.from`,
which is what makes the Undo affordance in toasts possible.

---

## Auth & sharing

Supabase Auth with row-level security keyed to `auth.uid()`. Every table has RLS on.

The rule: **you can always read and write your own rows; others read yours only where you
made them public.** Profile-level (`profiles.is_public`) governs the library and activity;
collection-level (`collections.privacy`) governs collections independently, so you can keep
a private profile and still share one collection by link.

`unlisted` is readable by anyone holding the link but excluded from listing queries — the
distinction is enforced client-side in *which query runs*, not in RLS, because "hard to
find" is a product behavior and "not allowed" is a security one. Only `private` is a
security boundary.

`profile_is_public()` is `SECURITY DEFINER` specifically so that policies on `profiles` can
call it without re-entering `profiles`' own RLS, which would recurse infinitely.

---

## World A: the AniList client

`src/data/anilist/client.ts` is a small hand-rolled GraphQL client rather than Apollo/urql
— the app issues about eight distinct queries and needs precise control over the rate
limit, which is far less code than configuring a full client.

- **Adaptive token bucket.** AniList *documents* 90 req/min, but the enforced limit has
  been 30 for a long time and is only discoverable from the `x-ratelimit-limit` response
  header. Hardcoding the documented number fails in a nasty way — requests sail past the
  real ceiling, come back 429, and entire rows of Discover vanish with no visible error.
  So the bucket starts at 28 and re-derives itself from every response, reserving two
  slots of headroom. If AniList raises the limit again, the client picks it up on the next
  call. Requests queue rather than fail.
- **Respects `Retry-After`.** A 429 parks the whole queue for the advertised duration.
- **In-flight de-duplication.** Identical `(query, variables)` pairs share one promise, so
  ten cards mounting with the same media id issue one request.
- **Normalized output.** Raw AniList shapes stop at `normalize.ts`; components only ever
  see `Media`, `Character`, `StaffMember`.

Caching: `staleTime` 24h (metadata doesn't change mid-session), `gcTime` 7 days, persisted
to `localStorage` behind a version key that busts on schema change. Media detail queries
prefetch on card hover, so opening a media page is instant.

### Light novels

AniList files them under `MANGA` with `format: NOVEL`. `resolveKind()` maps a raw media
back to `anime | manga | novel` for the library's three-way split, and volume tracking is
enabled from that same resolved kind.

---

## Artwork-driven accent

`lib/accent.ts` takes `coverImage.color` (a hex AniList computes server-side), converts to
HSL, clamps lightness and saturation into a theme-appropriate band, and returns a value
guaranteed to satisfy contrast against the current surfaces. The result is written to
`--art-accent` on the media page root; descendants use `var(--art-accent)` with no props.

A deliberate rejection of client-side pixel extraction (canvas + k-means): that needs
CORS-enabled image loads, costs main-thread time on every card, and produces a *worse*
answer than the one AniList already computed.

---

## Routing

`react-router` v7 declarative, wrapped in one `AppLayout`:

```
/                       Dashboard
/library                Library        ?kind=anime&status=current&view=grid
/rankings               Rankings       ?kind=anime
/media/:id              Media page
/collections            Collections index
/collections/:id        Collection detail
/discover               Discover       ?q=
/profile                Your profile   (signed in only, when sync is configured)
/u/:handle              Someone else's public profile
/settings               Settings + sync status
/auth                   Sign in / sign up
```

`/rankings` is its own route rather than a Library view mode. Ordering by taste and tracking
progress are different activities with different gestures — one is drag-and-drop over a
whole ordered list, the other is `+1` on a single row — and sharing a page meant neither got
the space it needed.

**Every route works signed out.** `/profile` is the sole exception and only when sync is
configured: with no session there is no identity for it to be *of*. Nothing else in the
product is gated, so guest mode is the normal mode rather than a degraded one — the same
principle as local-only sync above, applied to auth.

Filter state lives in the URL query string, not component state, so any library view is
linkable and survives reload and back-navigation.

---

## Project layout

```
src/
  app/            router, providers, AppLayout, NavRail, TopBar, CommandPalette
  design/         tokens.css + every generic primitive (no domain knowledge)
  data/
    anilist/      client · queries · normalize · hooks · types
    supabase/     client · types · auth · repositories
    sync/         outbox · flush · realtime · conflict
    store/        index · entries · collections · rankings · activity · profile · prefs
    selectors/    stats, activity grouping, recommendations, affinity
  features/
    dashboard/  library/  rankings/  media/  collections/  discover/  profile/  tracking/
    onboarding/   first run + the importers
  lib/            accent, dates, format, cn, ids
supabase/
  migrations/     versioned SQL — schema, constraints, RLS
```

`design/` never imports from `features/`. `features/` never imports another feature's
internals — shared pieces move to `design/` or `features/tracking/` (the quick-action
surface every page reuses). Repositories in `data/supabase/` are the only files that know
SQL table names.

### First run

A new account starts **empty** — and empty now means empty. There is no sample library: a
shelf full of someone else's taste is the fastest way to make a personal product feel like a
demo, and every recommendation the app makes is derived from your own scores, so seeded data
poisons the whole page.

The profile is empty on the same principle. `profiles.display_name` defaults to `''` and
`handle_new_user()` inserts `''` rather than deriving a name from the email's local part;
the local `emptyProfile` carries no handle, name, bio or genres either. A generated handle
(`user_<12 hex>`) is unavoidable — it is unique, format-constrained and needed for links —
but it is an identifier, not an identity, and nothing else is guessed on the user's behalf.

Two escape hatches exist for state that predates that rule:

- the persisted store's **v2 → v3 migration discards local state outright** rather than
  translating it. Anything carrying the old seeded `reader` / "Reader" persona is not a
  user's data with a wrong name attached — it accumulated *under* a persona nobody chose.
  Remote rows are untouched, so signing in re-pulls whatever the server still holds.
- `data/sync/wipe.ts` erases everything, local **and** remote, and resets `onboarded`. It
  clears the outbox *first*: a queue still holding upserts for rows about to be deleted
  would helpfully recreate them seconds later, which is the classic way a "delete
  everything" button quietly does nothing.

`features/onboarding/` owns that first screen. Its **import step** — not the welcome copy,
not the confirmation after it — is the only place in the product that names another tracking
site, for exactly one reason: you cannot ask someone for their list from a service without
telling them which service. Every other surface is written as though those services do not
exist.

The one other place the two conventions meet is the wire: the upstream schema spells
`favourites` the British way, so `queries.ts` **aliases it** to `favorites` in the GraphQL
document. Nothing downstream — raw shape, normalized type, store, UI, database column —
carries the other spelling.

- `import.ts` — `importFromAniList(username)` reads a public list in one request;
  `importFromMal(xml)` parses a MyAnimeList export and resolves its MAL ids to AniList ids
  in aliased batches of 40. Both funnel through one `toEntry()` that re-applies the app's
  own rules on the way in (progress clamped to the real total, scores kept only on
  completed titles).
- `library.importEntries()` merges without overwriting: anything already on the shelf
  wins, and no activity is written — three hundred "added" lines would bury the diary on
  day one.

Past onboarding, no screen in the app names where anything came from.

---

## Performance

- Route-level `lazy()` splitting; media page and collection detail are the heavy chunks.
- Long grids use `content-visibility: auto` with `contain-intrinsic-size` rather than a
  virtualizer — most of the win, none of the scroll-restoration bugs.
- Cover images are `loading="lazy"`, `decoding="async"`, aspect-locked to prevent layout
  shift, and blur up from the artwork color.
- Selectors memoized with `useShallow`; the in-memory activity window is capped so derived
  stats stay bounded regardless of how large the table grows.
- Framer Motion's `LayoutGroup` drives the segmented-control thumb and shelf transitions on
  the compositor.
