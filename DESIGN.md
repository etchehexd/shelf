# Shelf — Design System

> A cozy digital bookshelf that understands my taste.

The whole system follows one rule: **the UI is a quiet room; the artwork is the light.**
Every surface is a warm neutral. Every accent is borrowed from the cover art on screen.
Nothing in the chrome competes with a poster.

---

## 1. Foundations

### 1.1 Colour

Colour is split into three layers, and they never mix responsibilities.

| Layer | Owns | Changes with theme | Changes with content |
|---|---|---|---|
| **Neutrals** | surfaces, text, borders | yes | no |
| **Accent** | one brand hue for focus, stars, active nav | yes | no |
| **Artwork accent** | per-media page tinting | yes | **yes** |

#### Neutrals — warm, paper-like

Pure grey reads clinical. Every neutral carries a small amount of warmth (hue ≈ 40°) so
the app feels like paper and cloth rather than a control panel. Dark mode cools slightly
(hue ≈ 260°) because near-black with a blue cast makes saturated cover art pop.

**Light — "Paper"**

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#FBFAF8` | app background |
| `--surface` | `#FFFFFF` | cards, panels |
| `--surface-2` | `#F4F2ED` | inset wells, hover fills |
| `--surface-3` | `#EAE7E0` | pressed, track fills |
| `--border` | `#E4E0D8` | hairlines |
| `--border-strong` | `#D2CCC0` | inputs, dividers under emphasis |
| `--ink` | `#191714` | primary text |
| `--ink-2` | `#57524A` | secondary text |
| `--ink-3` | `#8C857A` | tertiary, metadata |

**Dark — "Midnight"**

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#0E0E11` | app background |
| `--surface` | `#161619` | cards, panels |
| `--surface-2` | `#1E1E23` | inset wells, hover fills |
| `--surface-3` | `#27272E` | pressed, track fills |
| `--border` | `#26262C` | hairlines |
| `--border-strong` | `#34343C` | inputs, dividers under emphasis |
| `--ink` | `#F3F1EE` | primary text |
| `--ink-2` | `#A8A29A` | secondary text |
| `--ink-3` | `#6F6A63` | tertiary, metadata |

Contrast: `ink` on `canvas` ≥ 15:1, `ink-2` ≥ 6:1, `ink-3` ≥ 4.5:1 in both themes.
`ink-3` is never used for anything a user must read to act.

#### Accent — amber

One hue, used sparingly. Amber is the colour of lamplight and of a filled star, which is
exactly the two jobs it has here.

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#A9631C` | `#E0A052` |
| `--accent-hover` | `#8E5316` | `#EFB369` |
| `--accent-quiet` | `#F5EADC` | `#2A2118` |
| `--accent-ink` | `#FFFFFF` | `#191510` |

#### Status hues — desaturated, never shouty

Statuses appear as 6px dots and thin pills, never as filled blocks.

| Status | Light | Dark | Meaning |
|---|---|---|---|
| `current` | `#3F7D5C` | `#6BB58C` | Watching / Reading |
| `completed` | `#4A6FA5` | `#8AA9DA` | Completed |
| `planning` | `#8C857A` | `#7C776F` | Planning |
| `paused` | `#A07A2B` | `#CBA35C` | Paused |
| `dropped` | `#9A5A5E` | `#C08A8D` | Dropped |

#### Artwork accent

AniList returns a dominant hex for every cover (`coverImage.color`). We use it directly —
no canvas pixel-reading, no extra bytes, no CORS problem.

Raw cover colours are unusable as UI colour: they range from near-white to near-black and
from grey to fluorescent. Every artwork colour passes through one clamp
(`lib/accent.ts`) before touching a surface:

- **Light theme** → lightness clamped to `28–46%`, saturation to `20–62%`
- **Dark theme** → lightness clamped to `62–78%`, saturation to `18–58%`

This guarantees text-on-accent contrast regardless of the source poster, while preserving
the *identity* of the colour — a Frieren page stays sage-green, a Chainsaw Man page stays
blood-orange. The clamped value is published as `--art-accent` on the page root, so any
descendant can opt into it without prop drilling.

### 1.2 Typography

Two families, sharply separated by job. Both are variable fonts, self-hosted via
`@fontsource-variable` — no CDN, no layout shift.

**Fraunces** (display serif, optical sizing) — media titles, page titles, big numbers,
collection names. It carries the "cozy editorial" half of the brief. Used at `wght 400–600`,
`opsz 48`, and always with tightened tracking.

**Inter** (UI sans) — everything else: navigation, labels, body, metadata, all numerals in
tables and stats (`font-variant-numeric: tabular-nums`).

| Token | Size / Line | Family | Use |
|---|---|---|---|
| `display-xl` | 60 / 1.02 | Fraunces 500 | media page title |
| `display-lg` | 40 / 1.08 | Fraunces 500 | page titles, collection hero |
| `display-md` | 28 / 1.15 | Fraunces 500 | section headers |
| `display-sm` | 20 / 1.25 | Fraunces 500 | card titles in showcase |
| `title` | 16 / 1.35 | Inter 600 | card titles, dialog titles |
| `body` | 14.5 / 1.6 | Inter 400 | synopses, descriptions |
| `label` | 13 / 1.4 | Inter 500 | buttons, nav, form labels |
| `meta` | 12 / 1.35 | Inter 500 | metadata rows, counts |
| `micro` | 11 / 1.3 | Inter 600, `0.06em`, uppercase | eyebrows, section kickers |

Rules: display sizes always `letter-spacing: -0.02em`. Micro is the only uppercase style
in the app. No text is centred except inside empty states and stat tiles.

### 1.3 Space

4px base. The layout rhythm is deliberately generous — the brief asks for calm, and calm is
mostly whitespace.

`1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80 · 24=96`

- Card padding: 20 (compact) / 24 (standard)
- Gap between cards in a grid: 20 desktop, 12 mobile
- Gap between page sections: 64 desktop, 40 mobile
- Page gutter: 40 desktop, 20 mobile
- Content max width: 1560px; prose max width: 68ch

### 1.4 Radius & elevation

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 8px | pills, chips, small inputs |
| `--r-md` | 12px | buttons, inputs, cover art |
| `--r-lg` | 16px | cards, panels |
| `--r-xl` | 22px | dialogs, hero panels |
| `--r-full` | 999px | avatars, status dots, toggles |

Elevation is **mostly not shadow**. Light theme separates with a hairline border plus a
whisper of shadow; dark theme separates by raising the surface value instead. Only floating
layers (popover, dialog, toast, drag preview) get a real shadow.

- `--shadow-sm`: hairline lift for hoverable cards
- `--shadow-md`: popovers, menus
- `--shadow-lg`: dialogs, drag previews

### 1.5 Motion

Motion is used to explain change, never to decorate.

| Token | Duration | Curve | Use |
|---|---|---|---|
| `--t-instant` | 110ms | `ease-out` | hover, colour, opacity |
| `--t-quick` | 180ms | `cubic-bezier(.2,0,0,1)` | popovers, tooltips, chips |
| `--t-base` | 280ms | `cubic-bezier(.2,0,0,1)` | dialogs, panel transitions |
| `--t-slow` | 480ms | `cubic-bezier(.16,1,.3,1)` | page/hero entrances |
| spring | — | `stiffness 380, damping 32` | progress bumps, drag, count-ups |

Signature motions:

1. **Progress bump** — pressing `+1` springs the number up 4px while the bar fills; the bar
   overshoots ~2% and settles. This is the app's most-repeated interaction, so it gets the
   most craft.
2. **Star fill sweep** — hovering a rating sweeps fill left-to-right with 18ms stagger per
   half-star.
3. **Cover lift** — cards translate `-3px` and gain `--shadow-sm` over `--t-instant`.
4. **Shelf parallax** — cover art inside a shelf row translates at 0.94× scroll speed.

All of it is wrapped by `prefers-reduced-motion`, which collapses every duration to 0.01ms
and disables parallax and the sweep.

---

## 2. Component inventory

Primitives live in `src/design/` and know nothing about anime.

| Component | Notes |
|---|---|
| `Button` | variants `primary · secondary · ghost · quiet · danger`, sizes `sm · md · lg`, optional `icon`, loading state |
| `IconButton` | square, sizes `sm · md`, requires `label` for a11y |
| `Card` | `interactive` prop adds lift + focus ring |
| `Pill` | status pills, tag chips, count badges; `tone` maps to status hues |
| `Stars` | 5 stars / 10 points / half steps. Read-only and interactive modes, keyboard-driven (←/→ = ½ point, Home/End) |
| `ProgressBar` | determinate; `accent` prop accepts artwork accent |
| `ProgressStepper` | −/＋ around a large tabular number, hold-to-repeat, direct entry on click |
| `SegmentedControl` | view modes, type tabs; animated thumb via shared layout id |
| `Select` / `Menu` | roving-tabindex listbox, no native `<select>` |
| `Popover` | anchored, focus-trapped, dismiss on outside click / Escape |
| `Dialog` | modal, focus-trapped, scroll-locked, `sm · md · lg` |
| `Tooltip` | 400ms open delay, 0ms between neighbours |
| `Toast` | bottom-centre stack, 4s, with Undo affordance |
| `Skeleton` | shimmer respects reduced motion |
| `Rail` | horizontal scroller with edge fades and keyboard arrows |
| `CoverImage` | aspect-locked 2:3, blur-up placeholder from artwork colour, `sm→xl` |
| `EmptyState` | icon, line, single action |
| `StatTile` | label / value / delta, tabular numerals |
| `SectionHeader` | eyebrow + display heading + trailing action |

---

## 3. Page layouts

### Shell

```
desktop ≥1100px                             mobile <760px
┌──────┬───────────────────────────────┐    ┌─────────────────┐
│ rail │ topbar: search · theme · you  │    │ topbar          │
│ 232  ├───────────────────────────────┤    ├─────────────────┤
│      │                               │    │                 │
│ Dash │  content                      │    │ content         │
│ Libr │  max-w 1560, gutter 40        │    │ gutter 20       │
│ Disc │                               │    │                 │
│ Prof │                               │    ├─────────────────┤
│      │                               │    │ ▣ ▤ ✦ ◍  tabs   │
└──────┴───────────────────────────────┘    └─────────────────┘
```

Between 760–1100px the rail collapses to a 72px icon-only rail.
`⌘K` opens the command palette from anywhere.

### Dashboard — "here is my media journey"

```
┌────────────────────────────────────────────────────────┐
│ Good evening, Elly.            Tuesday, 3 August       │  greeting
├────────────────────────────────────────────────────────┤
│ CONTINUE                                               │  eyebrow
│ ┌────────┐┌────────┐┌────────┐┌────────┐              │  wide cards:
│ │ cover  ││        ││        ││        │  →  rail     │  cover + title
│ │ ep 8/28││        ││        ││        │              │  + bar + [+1]
│ └────────┘└────────┘└────────┘└────────┘              │
├──────────────────────────────┬─────────────────────────┤
│ ACTIVITY                     │ THIS WEEK               │  2-col:
│  Today                       │ ┌────┐┌────┐┌────┐      │  8fr / 4fr
│   ▸ watched ep 8 Frieren     │ │ 14 ││  6 ││ 5.2││     │
│   ▸ rated Vinland 9.0        │ └────┘└────┘└────┘      │
│  Yesterday                   │                         │
│   ▸ added 3 to Comfort       │ RATINGS                 │
│   ▸ completed Monster        │  ▁▂▃▅█▇▃  histogram     │
│                              │                         │
│                              │ TOP GENRES              │
│                              │  Slice of Life ████     │
├──────────────────────────────┴─────────────────────────┤
│ RECENTLY FINISHED     shelf rail of covers + score     │
└────────────────────────────────────────────────────────┘
```

### Library

Type tabs (Anime · Manga · Light novels) → status segmented control → toolbar
(search, genre, format, year, sort, view mode). Three view modes:

- **Grid** — 2:3 posters, responsive `minmax(168px, 1fr)`, hover reveals `+1` and rating
- **Shelf** — one horizontal row per status, larger covers, wooden-shelf baseline via a
  single hairline + gradient; reads like a bookcase
- **List** — dense rows: cover 40px, title, inline progress stepper, score, rank, updated

### Media page — the centrepiece

```
┌────────────────────────────────────────────────────────┐
│  banner image, 340px, scrim to canvas                  │
│                                                        │
├───────┬────────────────────────────────────────────────┤
│ ┌───┐ │  MEDIA · TV · 2023 · MADHOUSE                  │  cover overlaps
│ │cvr│ │  Frieren: Beyond Journey's End                 │  banner by 96px
│ │   │ │  葬送のフリーレン                               │  accent = artwork
│ └───┘ │  ★★★★★ 10.0   #1 of anime   ● Watching         │
│       │  ┌──────────────────────────────────────────┐  │
│ ⊕ Add │  │  ‹ −    Episode  8 / 28    +  ›  ▓▓▓░░░  │  │  quick actions
│ ⤴ Share│ └──────────────────────────────────────────┘  │
│       │  [ Rate ] [ Rank ] [ + Collection ] [ Status ▾]│
├───────┴────────────────────────────────────────────────┤
│ Overview · Characters · Staff · Stats · History        │  sticky tabs
├────────────────────────────────────────────────────────┤
│ synopsis (68ch)              │ Information             │
│ genres, tags                 │ format, source, studio  │
│ ── In your collections ──    │ season, status, dates   │
│ ── Relations rail ──         │ episodes, duration      │
│ ── Recommended for you ──    │                         │
└────────────────────────────────────────────────────────┘
```

Not a Wikipedia page: the synopsis is capped and collapsible, information is a quiet
sidebar, and the first thing under the fold is *your* relationship with the title
(collections, history), not the metadata.

### Collections

- **Index** — cards with a 4-cover fanned mosaic, display-serif name, count, privacy dot.
  "New collection" is a dashed-outline card in the same grid.
- **Detail** — banner, display-xl name, description in prose width, then the items in the
  collection's chosen layout (`grid · ranked · showcase`). Ranked shows a large tabular
  numeral beside each cover; drag to reorder with `@dnd-kit`, order persists per collection.
  Each item can carry a one-line note that renders as a pull-quote in showcase layout.
- **Editor** — a dialog: name, description, cover picker (choose any member's art), banner
  picker, tags, privacy (`private · unlisted · public`), layout.

### Discover

No global popularity chart. Every row is generated from the user's own data and titled to
say so:

- "Because you rated **Frieren** 10" → AniList recommendations for their top-rated titles
- "More from **MADHOUSE**" → studio of their highest-scored anime
- "Your comfort zone: **Slice of Life**" → top genre by average score
- "Ready to start" → planning list sorted by predicted fit
- "This season, matched to your taste" → current season filtered by their genre affinities

Plus a live AniList search with a debounce and inline "add to library" on each result.

### Profile

A customisable canvas. Header (banner, avatar, name, bio, joined, favourite genres) then a
reorderable widget column. Widgets: `Top ranked · Featured collections · Currently watching ·
Statistics · Rating distribution · Genre affinity · Recent activity · Favourites`.
Edit mode reveals drag handles and visibility toggles; layout persists.

---

## 4. Accessibility

- Focus is always visible: 2px `--accent` ring at 2px offset, never removed.
- Every icon-only control has an accessible name.
- Dialogs and popovers trap focus and restore it on close.
- Star ratings, progress steppers, segmented controls and sortable lists are all fully
  keyboard operable (`@dnd-kit` keyboard sensor included).
- Status is never communicated by colour alone — dots always sit next to a text label.
- All motion respects `prefers-reduced-motion`.
- Targets are ≥ 36×36 desktop, ≥ 44×44 touch.
