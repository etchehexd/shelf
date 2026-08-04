# Shelf

A cozy digital bookshelf that understands your taste.

Shelf is a personal library for anime, manga and light novels — tracking, rating, ranking,
collecting. It is not a MAL or AniList clone. The reference points are Letterboxd (media
diary, ratings, identity), Pinterest (visual collections, personal taste) and Spotify
(polished interactions, personalization, statistics).

The design rule the whole app follows: **the UI is a quiet room; the artwork is the light.**

---

## Status

Early build. See the task list in the commit history for what's landed.

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript + Vite | |
| Styling | Tailwind CSS v4 | CSS-first `@theme`, tokens as custom properties so themes flip at runtime |
| Animation | Motion | compositor-driven layout animations |
| Server state | TanStack Query | AniList cache + `localStorage` persistence |
| Client state | Zustand | the personal library, authoritative in-session |
| Backend | Supabase (Postgres + Auth + Realtime) | personal data, row-level security, sharing |
| Media metadata | AniList GraphQL | the only free API with art, characters, staff and relations in one request, CORS-enabled |

Media metadata is **never** copied into Postgres. Supabase stores only your data —
`(user_id, media_id, status, progress, score, …)` — and joins to AniList client-side.

## Local development

```bash
npm install
npm run dev
```

The app runs without a backend. With no Supabase credentials it operates in local-only
mode: everything works, nothing syncs, sharing is disabled.

### Wiring up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the example env file and fill it in from **Project Settings → API**:

```bash
cp .env.example .env.local
```

3. Run [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql)
   in the SQL editor (or `supabase db push` with the CLI). It creates the schema, the
   constraints, the triggers and every row-level security policy.

The anon key is designed to be shipped to browsers — RLS is what protects the data, and it
is enabled on every table. It stays in `.env.local` anyway so rotating it never means
rewriting git history.

## Documentation

- [DESIGN.md](DESIGN.md) — the design system: color, type, space, motion, component
  inventory, and a layout sketch for every page.
- [ARCHITECTURE.md](ARCHITECTURE.md) — the two-world data model, why writes are local-first
  with a sync outbox, fractional indexing for rankings, and the RLS model.

## Scripts

```bash
npm run dev        # vite dev server
npm run build      # typecheck + production build
npm run typecheck  # tsc, no emit
npm run preview    # serve the production build
```
