# Shelf — Design System

> A cozy digital bookshelf that understands my taste.

The whole system follows one rule: **the UI is a quiet room; the artwork is the light.**
Every surface is a warm neutral. Every accent is borrowed from the cover art on screen.
Nothing in the chrome competes with a poster.

Restraint is not the same as emptiness. The room is quiet, but it is furnished.

---

## The copy rule

**Sections are named, not narrated.**

*Continue Watching. Recently Completed. Airing This Week. Your Collections. Recommended
Because You Loved X.* Four of those are two words long and the fifth is only longer
because it is carrying real information — which title the recommendation came from.

There is no second line under a heading explaining the heading. No "You said you'd get to
these. No pressure." No "Ready when you are." Written personality is the cheapest kind and
it wears out on the second read; a page of it reads as generated, because it is exactly
what a machine writes when asked to sound human.

Where a section genuinely needs a number or a provenance — *"you average 8.4"*, *"466k
tracking"*, *"6 results"* — it goes in the catalog voice at the end of the header rule,
as data. Never as a sentence.

The personality budget is spent on layout, artwork, motion, typography and spacing
instead. The test: **cover every string on the page and it should still be recognizably
this product.**

---

## 0. The visual language

Six motifs. They repeat on every page, and they are the reason a screenshot of this
product is recognizable without the logo in it.

### The frame

Artwork is never an `<img>` in a card. It sits in a **frame**: a 3px radius, a 1px inset
hairline so pale covers don't dissolve into pale paper, and a two-part contact shadow —
tight underneath, wide and soft below that. The result reads as a *printed object standing
on a surface*. A grid of these looks like a collection; a grid of rounded rectangles looks
like a result set.

Corner radii are deliberately mixed and the contrast is the point: **sharp art, soft room.**
Artwork is 3px. Wells are 13px. Panels are 18px. Banners and exhibition cards are 26px.
Pills and steppers are fully round.

### The lift

The signature hover, applied at every size from a 36px thumbnail to a 212px hero. The
poster rises 6px and its shadow spreads underneath it — the gesture of pulling one book
forward off a shelf. 420ms on `--ease-out-expo`. Nothing snaps.

`.frame-lift` on any ancestor drives the `.frame` inside it, so a whole card can be the
hover target while only the artwork moves.

### The shelf

A hairline with a soft pool of shadow *above* it and a short ember end-cap on the left.
Draw it under a row of covers (`<ShelfLine />`) and the row becomes a bookcase. It appears
under every horizontal rail in the app, and the same end-cap shape is reused as the active
marker in the nav rail — chrome and content speaking one language.

### The catalog label

`.label-cat` / `<Eyebrow>`: Geist Mono, 10.5px, `0.14em`, uppercase, `--ink-3`, preceded by
a 4px diamond tick. It is the most repeated mark in the product — more than the logo — and
it is what makes a dense page read as a museum wall label rather than a form.

It is joined to the section's action by a hairline that fills the space between them, which
gives every section a visible top edge without spending a heavy divider on it.

### The stack

Covers layered, rotated and offset like records pulled half out of a crate
(`<CoverStack>`). On hover of the enclosing `group`, the stack **fans open**, each card a
40ms beat after the one before. Collections use it as their identity; the dashboard uses it
for collection strips; the profile uses it for featured shelves. Same motif, three places —
which is how a motif becomes a language.

### The lean

`.overlap-row` — covers shelved too tightly, leaning on each other with a negative margin.
Hover one and the whole row breathes: neighbors slide apart by 12px over 420ms while the
hovered poster lifts. It is the cheapest way to make a row of artwork read as a physical
shelf rather than a list of images, and it is the difference between "browsing" and
"scrolling a table".

### The feature card

One element per page is allowed to be enormous. `FeatureCard` is it: banner artwork
bleeding to the edges and slowly scaling on hover, the poster standing sharp in front of
it, and **two or three more covers layered behind at an angle** so the card reads as a
stack you could pick up. Community score in the header row, one action, nothing else.

Every major page carries exactly one. That rule is what stops the app being the same
rectangle nine times.

### The wash

`.art-wash` — the page's own artwork, blown up, blurred 44px and desaturated behind a
section, so the room takes its color from the thing you love most without a single UI
color being spent. The library's top shelf sits on a wash of its own number one.

### The bleed

Artwork that runs past the page gutter (`.bleed-x`) under a scrim, with sharp artwork
standing in front of it. Media hero, collection exhibition header, profile banner, spotlight
cards. Soft artwork behind, crisp artwork in front, type on top — the app's most identifiable
composition.

### Rhythm

Pages must not settle into one repeating tile:

- There is **one poster grid** in the product (`.poster-grid`), so four pages can't end up
  with four slightly different column widths. `.poster-grid-lead` is its editorial variant:
  the first cell spans two columns and two rows.
- Grids stagger — `.grid-stagger` drops every second poster half a step, so a wall of covers
  looks filled by hand.
- Collection cards rotate through **three** cover treatments (stack, mosaic, split) by
  position, so no two adjacent cards are composed the same way.
- Every page carries exactly one element at hero scale: a spotlight, a banner, an exhibition
  header. Never two, never none.
- The page background carries 3.5–5% of paper grain. You never see it; you only stop noticing
  that the background is a flat rectangle.

---

## 1. Foundations

### 1.1 Color

Color is split into three layers, and they never mix responsibilities.

| Layer | Owns | Changes with theme | Changes with content |
|---|---|---|---|
| **Neutrals** | surfaces, text, borders | yes | no |
| **Accent** | one brand hue for focus, stars, active nav | yes | no |
| **Artwork accent** | per-media page tinting | yes | **yes** |

#### Neutrals — warm, paper-like

Pure gray reads clinical. Every neutral carries warmth (hue ≈ 30–40°) so the app feels like
paper and cloth rather than a control panel. **Dark mode is warm charcoal, not blue-black** —
a cold charcoal UI reads as a developer tool; a warm one reads as a room with a lamp on.

Five surface steps, so depth never has to rely on shadow alone.

**Light — "Paper"**

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#F6F4F0` | app background |
| `--surface` | `#FFFEFC` | cards, panels |
| `--surface-2` | `#F0ECE5` | inset wells, hover fills |
| `--surface-3` | `#E6E0D6` | pressed, track fills |
| `--border` | `#E3DDD2` | hairlines |
| `--border-strong` | `#CEC5B6` | inputs, dividers under emphasis |
| `--shelf-line` | `#D6CEC1` | the hairline a poster stands on |
| `--ink` | `#1B1815` | primary text |
| `--ink-2` | `#55504A` | secondary text |
| `--ink-3` | `#6F685E` | catalog labels, metadata |

**Dark — "Ember"**

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#131110` | app background |
| `--surface` | `#1C1917` | cards, panels |
| `--surface-2` | `#24201D` | inset wells, hover fills |
| `--surface-3` | `#2E2926` | pressed, track fills |
| `--border` | `#2B2622` | hairlines |
| `--border-strong` | `#3D3730` | inputs, dividers under emphasis |
| `--shelf-line` | `#3A332C` | the hairline a poster stands on |
| `--ink` | `#F6F2EC` | primary text |
| `--ink-2` | `#AAA39A` | secondary text |
| `--ink-3` | `#8F887E` | catalog labels, metadata |

Measured contrast, both themes: `ink` on canvas ≥ 16:1, `ink-2` ≥ 7:1, and `ink-3` ≥ 4.5:1
against canvas, surface *and* surface-2. `ink-3` is tuned to that floor rather than to taste,
because it carries the catalog label — which is 10.5px and often the only thing naming a
number ("3 episodes left", "Ep 8 · 01:00").

#### Accent — ember

One hue, used sparingly. Ember is lamplight, a filled star, and the spine of a well-read
book — which is exactly the set of jobs it has here.

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#B0541F` | `#E39A55` |
| `--accent-hover` | `#94441A` | `#F0AF6F` |
| `--accent-quiet` | `#F6E8DC` | `#2A2018` |
| `--accent-line` | `#E3C8AD` | `#4A3826` |
| `--accent-ink` | `#FFFDFA` | `#1A1209` |

No gradients as decoration. Scrims over artwork are the only gradients in the product, and
they exist to make type legible, not to add color.

#### Status hues — desaturated, never shouty

Statuses appear as small dots and thin pills, never as filled blocks.

| Status | Light | Dark | Meaning |
|---|---|---|---|
| `current` | `#3D7A58` | `#6CB28B` | Watching / Reading |
| `completed` | `#4A6B9E` | `#86A3D6` | Completed |
| `planning` | `#6F685E` | `#8F887E` | Planning |
| `paused` | `#A3792A` | `#C99F56` | Paused |
| `dropped` | `#98565A` | `#C08589` | Dropped |

#### Artwork accent

AniList returns a dominant hex for every cover (`coverImage.color`). We use it directly —
no canvas pixel-reading, no extra bytes, no CORS problem.

Raw cover colors are unusable as UI color: they range from near-white to near-black and
from gray to fluorescent. Every artwork color passes through one clamp
(`lib/accent.ts`) before touching a surface:

- **Light theme** → lightness clamped to `28–46%`, saturation to `20–62%`
- **Dark theme** → lightness clamped to `62–78%`, saturation to `18–58%`

This guarantees text-on-accent contrast regardless of the source poster, while preserving
the *identity* of the color — a Frieren page stays sage-green, a Chainsaw Man page stays
blood-orange. The clamped value is published as `--art-accent` on the page root, so any
descendant can opt into it without prop drilling.

### 1.2 Typography

**One sans for everything, one mono for the catalog voice.** No display serif anywhere.
Hierarchy is built out of weight, size, tracking and space — never out of a second
personality. Both are variable fonts, self-hosted via `@fontsource-variable` — no CDN, no
layout shift.

**Geist** — the entire interface. Headings are the same family as body text, just heavier
(600–640) and tracked tighter. A heading should read as *confident*, not dramatic.

**Geist Mono** — the catalog voice, and nothing else: eyebrows, index numbers, scores,
counts, timecodes, progress readouts, stat figures. Every numeral in the product is mono and
tabular, so a count never shimmies when it changes. This is a deliberate, recognizable
choice — it is what gives a dense page the feel of a printed catalog card.

| Token | Size / Line | Family | Use |
|---|---|---|---|
| `display-xl` | 56 / 0.98, `-0.040em` | Geist 640 | media page title |
| `display-lg` | 38 / 1.04, `-0.034em` | Geist 620 | page titles, exhibition headers |
| `display-md` | 26 / 1.12, `-0.028em` | Geist 600 | section headers, spotlight titles |
| `display-sm` | 19 / 1.20, `-0.021em` | Geist 600 | card titles, collection names |
| `title` | 15.5 / 1.35 | Geist 600 | row titles, dialog titles |
| `body` | 14.5 / 1.65 | Geist 400 | synopses, descriptions |
| `label` | 13 / 1.45 | Geist 500 | buttons, nav, form labels |
| `meta` | 12 / 1.4 | Geist 400–500 | metadata rows |
| `micro` / `.label-cat` | 10.5 / 1.2, `0.14em` | **Geist Mono** 600, uppercase | catalog labels |

Rules: `.label-cat` is the only uppercase style in the app. Numerals are always mono
(`.font-mono-num`). No text is centerd except inside empty states.

### 1.3 Space

4px base. The rhythm is **comfortable, not airy**. Editorial layouts fit more on a page than
landing pages do and still feel calm; the calm comes from alignment and consistent rules, not
from empty space. Giant gaps between two things read as unfinished, not as restraint.

`1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80`

- Card padding: 14 (tight) / 20 (compact) / 24 (standard) / 32 (loose)
- Gap between cards in a grid: 20 across, 32 down (the extra vertical room is the caption)
- Gap between page sections: 64 desktop, 40 mobile
- Page gutter: 40 desktop, 20 mobile
- Content max width: 1520px; prose max width: 66ch

### 1.4 Radius & elevation

Radius is mixed on purpose — see §0, *sharp art, soft room*.

| Token | Value | Use |
|---|---|---|
| `--radius-art` | 3px | **all artwork** |
| `--radius-xs` | 6px | corner tabs, kbd |
| `--radius-sm` | 9px | small inputs, chips |
| `--radius-md` | 13px | buttons, inputs, wells |
| `--radius-lg` | 18px | cards, panels, dialogs |
| `--radius-xl` | 26px | exhibition headers, spotlights |
| full | 999px | avatars, pills, steppers, status dots |

Elevation is **mostly not shadow**. Light theme separates with a hairline border plus a
whisper of shadow; dark theme separates by raising the surface value instead. Only artwork
and floating layers get a real shadow.

- `--shadow-poster` / `--shadow-poster-lift`: the frame at rest and lifted. Two-part —
  a tight contact shadow plus a wide soft one, never a single blurry halo.
- `--shadow-sm` → `--shadow-lg`: hoverable panels, popovers, dialogs and drag previews.

### 1.5 Motion

Motion explains change; it never decorates. Nothing snaps.

| Curve | Value | Use |
|---|---|---|
| `--ease-out-soft` | `cubic-bezier(.22,.61,.24,1)` | color, opacity, small moves |
| `--ease-out-expo` | `cubic-bezier(.16,1,.3,1)` | lifts, fans, entrances, bars |
| `--ease-spring` | `cubic-bezier(.34,1.4,.5,1)` | the logo, tactile presses |
| spring | `stiffness 380–560, damping 24–34` | progress bumps, score pops |

Signature motions:

1. **The lift** — a poster rises 6px out of its row and its shadow spreads underneath, 420ms
   on `--ease-out-expo`. The most-repeated motion in the app.
2. **The fan** — a cover stack opens on hover, each card 40ms behind the last, 520ms.
3. **Progress bump** — `+1` springs the number up while the bar fills. On a ticked track the
   individual episode segments light in sequence at 12ms apart.
4. **The rating sweep** — half-stars light as the pointer crosses them, each 25ms behind the
   last, while the numeral pops and the word crossfades.
5. **The peek** — a card's hover panel slides up 12px from under the artwork over 320ms.
6. **The stagger** — grid items enter 26ms apart, capped at 14 so a long list never crawls.

All of it is wrapped by `prefers-reduced-motion`, which collapses every duration to 0.01ms.

---

## 2. Component inventory

Primitives live in `src/design/` and know nothing about anime.

| Component | Notes |
|---|---|
| `Button` | variants `primary · secondary · ghost · quiet · danger`, sizes `sm · md · lg`, optional `icon`, loading state |
| `IconButton` | square, sizes `sm · md`, requires `label` for a11y |
| `Card` | `tone` (raised · sunk · outline) × `radius` (sm→xl) × `padding`; `interactive` adds the lift |
| `Pill` / `Chip` | status pills, tag chips; `tone` maps to status hues; chips fill with ember when active |
| `Rating` | read-only stars, `xs→xl`. Five stars, two points each — see §Rating below |
| `RatingInput` | the interactive form: sweep to aim, click to commit, digits to jump, `←/→`, `Home/End`, `Backspace` to clear |
| `CommunityScore` | everyone else's number: a ring out of 100, never stars, never ember |
| `ContextMenu` | right-click menu anchored to a point; scrolls inside itself rather than off screen |
| `SearchInput` | the one search field — icon, padding and height, decided once |
| `ProgressBar` | **ticked** when the total is ≤ 50 (one segment per episode), continuous above that; `art` borrows the artwork accent |
| `ProgressStepper` | −/＋ around a mono number, hold-to-repeat, click to type, `＋` becomes a tick at the end |
| `SegmentedControl` | view modes, type tabs; animated thumb via shared layout id |
| `Popover` | anchored, focus-trapped, dismiss on outside click / Escape |
| `Dialog` | modal, focus-trapped, scroll-locked, `sm · md · lg` |
| `Tooltip` | 400ms open delay, 0ms between neighbors |
| `Toast` | bottom-center stack, 4s, with Undo affordance |
| `Skeleton` | shimmer respects reduced motion |
| `Rail` | horizontal scroller, arrows appear only when there is somewhere to go |
| `CoverImage` | the frame. Aspect-locked (`poster · wide · square · banner`), blur-up from the artwork color, accepts overlay children |
| `CoverStack` | the fanned stack; opens on hover of the enclosing `group` |
| `ShelfLine` | the hairline + shadow pool + ember end-cap |
| `EmptyState` | drawn as an *empty shelf* — three dashed slots on a rule — not as a dashed box |
| `StatTile` | rule above, mono figure, catalog label below. Never a boxed KPI |
| `Eyebrow` | the catalog label |
| `SectionHeader` | eyebrow — hairline — action, with the heading hanging below |

### The two scores

Every title carries two numbers and they must never be confused, so they are drawn in two
different languages:

| | Yours | Everyone's |
|---|---|---|
| shape | five stars | a solid block |
| color | ember / artwork accent | one of four cool bands |
| scale | out of 10 | out of 100 |
| component | `Rating` · `RatingInput` | `CommunityScore` |

Three independent signals, so telling them apart never depends on reading a label.

**Yours is always stars.** Never a bare numeral in a corner — a digit says nothing at a
glance, looks like every other tracker, and can be mistaken for a community score, an
episode count or a rank. `★★★★☆` is legible at 11px, in peripheral vision, on artwork. On a
poster the stars sit bottom-left on a frosted plate, because five ember stars on an
ember-heavy cover are invisible without a surface of their own.

**Everyone's is a color.** It used to be a hairline ring in `--ink-2` that dissolved into
whatever cover it sat on; a community score exists to be read in the half-second you spend
scanning a shelf, and a gray ring is not. It is now a solid block, top-left, on **every**
poster in the product — library, discover, collections, search results, rankings, the
media page — and it never fades on hover.

The four bands are binned, not interpolated, so the same title is the same color on every
screen and the color carries information rather than decorating:

| band | range | reads as |
|---|---|---|
| `--score-hi` | ≥ 80 | acclaimed |
| `--score-good` | 68–79 | well liked |
| `--score-fair` | 55–67 | mixed |
| `--score-weak` | < 55 | poorly received |

Deliberately cool — never ember — because ember means *yours* everywhere in this product.
On a wall of covers the mass of color reads before any single number does, which is a thing
a row of gray digits could never do.

Three variants, one component: `badge` (solid, on artwork), `pill` (tinted wash, for rows
and flat surfaces), `hero` (a 270° gauge arc and a large numeral, once per media page).

### Rating

One integer, **1–10**. Five stars, each worth two points, so every score has an exact
picture and you can read it without counting: 7 is three and a half stars.

- No half points, no 0–100, no conversion anywhere in the app.
- Fill is drawn *per star*, not as one percentage across the row — the gaps between stars
  would otherwise put "half" in the wrong place.
- Each score carries a word: 1 Awful · 2 Bad · 3 Poor · 4 Weak · 5 Fine · 6 Good ·
  7 Very good · 8 Great · 9 Superb · 10 Masterpiece. The word is what makes the number
  feel like a judgment rather than a data-entry field.
- **Rating unlocks only on completed titles** (`canRate()` in `data/store/types`). A score is
  a verdict on the whole work. Before that, the control explains itself and offers the one
  action that unlocks it — it never sits grayed out with no reason given.
- Enforced at all three layers: `setScore` clamps to 1–10 integers, the UI gates on status,
  and the database has `score between 1 and 10` plus `score is null or status = 'completed'`.

#### Why `RatingInput` holds still

It is the control people judge the app by, so it is built to be motionless while you aim
at it. Everything below is a rule, not a preference:

- **The readout reserves its widest size up front** — `2ch` for the numeral, `7.25rem` for
  the word ("Masterpiece"). The number and the word can change on every pixel of pointer
  movement without the row growing, and therefore without the popover around it resizing.
- **Hover emphasis is a transform inside a fixed box.** Never a size, margin or position
  change. A sweep across five stars cannot reflow the five stars it is sweeping across.
- **Preview state updates only when the derived score changes**, so a slow drag across one
  star costs zero renders.
- **The pointer→score mapping is measured off the rendered stars**, not computed from the
  size tokens. Sub-pixel rounding makes each star a fraction narrower than its token says
  and the error compounds: with arithmetic, "10" ended up living in the last few pixels of
  the control instead of the last half-star.
- **No enter/exit animation anywhere inside it.** Two of those fighting over one node is
  what makes a control flicker.
- Full keyboard: digits jump (`8` is an 8), `←/→` step, `Home/End`, `Enter` commits the
  current aim, `Backspace` clears.

The panel around it obeys the same discipline: one fixed width for both the locked and
unlocked states (it used to be two, so unlocking a title moved the panel out from under
the pointer), and `useAnchoredPosition` returns the *same object* when nothing moved, so a
ResizeObserver firing on inner content can't jitter the whole layer.

Popovers and menus have **no exit animation at all**. A dismissed menu should be gone, not
fading; and an exiting element is rendered from a frozen snapshot of its last props, which
is how a reopened rating panel could briefly show a stale score.

---

## 3. Page layouts

### Shell

```
desktop ≥1024px                             mobile <768px
┌──────┬───────────────────────────────┐    ┌─────────────────┐
│ rail │ topbar: search · theme · you  │    │ topbar          │
│ 236  ├───────────────────────────────┤    ├─────────────────┤
│      │                               │    │                 │
│ Home │  content                      │    │ content         │
│ Shelf│  max-w 1520, gutter 40        │    │ gutter 20       │
│ Coll │                               │    │                 │
│ Wandr│                               │    ├─────────────────┤
│ Room │                               │    │ ▣ ▤ ✦ ◍  tabs   │
└──────┴───────────────────────────────┘    └─────────────────┘
```

Destinations: *Home · Library · Rankings · Collections · Discover*, plus *Profile* once
there is an account behind it. The active item is marked by the ember spine — the same shape
as a shelf's end-cap. `⌘K` opens the command palette.

#### Collapsing the rail

The rail collapses to a 76px icon-only column, and the preference **persists** — it is a
posture, not a mode. Someone who wants the horizontal space back wants it back every time,
not once. `[` toggles it; the control sits at the foot of the rail and reads its own state.

Below 1024px the control disappears and the rail is always icon-only: at that width the
choice belongs to the viewport, not the user. Below 768px there is no rail at all.

Three implementation notes, because this is the kind of component that looks trivial and
then desyncs:

- **One number describes the whole layout.** `--rail-w` is written once, inline, on the
  layout root; the rail's width and the content column's padding both read it. Two elements
  reading one value are guaranteed to agree frame for frame — two elements swapping their
  own classes are not, and that is what a janky collapse always is underneath.
- **The breakpoint is resolved in JS, not in CSS.** Expressing it as `w-[76px] lg:w-(--rail-w)`
  puts a base utility and an `lg:` override on equal specificity, where the winner is decided
  by the order the framework happens to emit them in — the override lost, silently, and the
  rail simply never moved. One authored value and one consumer per property has no such race.
- **Labels leave without reflowing.** `max-width: 0` and `overflow: hidden` rather than
  `display: none`, so the icon beside a label slides to center over the same 380ms instead
  of snapping there the instant a class flips.

### First run — an empty room, on purpose

A new account has nothing in it. No sample library, no borrowed taste — a shelf full of
someone else's shows is the fastest way to make a personal product feel like a demo, and
every recommendation in the app is derived from your own scores anyway.

The first screen is drawn as **the empty-shelf mark at hero size**: five dashed slots
standing on a shelf line, dealt in 70ms apart. Then one heading and three doors, as rows
rather than cards — *Find your first title · Bring a list with you · Start a collection* —
and a quiet "Just look around" underneath.

The import door is the **only** screen in the product that names another tracking site.
Past it, nothing does.

### Dashboard — a story, not a report

The page answers, in order: what should I continue, what is coming, what am I about to
finish, what did I love, and what have I been doing.

```
┌────────────────────────────────────────────────────────┐
│ ◆ TUESDAY, 4 AUGUST                                    │
│ Good evening, Elly.        12 episodes · 2 finished    │  data, not a sentence
├────────────────────────────────────────────────────────┤
│ Continue Watching ───────────────── all in progress    │
│ ┌───────── 7 ──────────┐ ┌───────── 5 ─────────┐       │  asymmetric split
│ │ FEATURE CARD         │ │ side row            │       │  banner bleed, poster
│ │ poster + 3 layered   │ │ side row            │       │  in front, two or
│ │ covers fanned behind │ │ side row            │       │  three covers stacked
│ │ bar + [Continue]     │ │ + N more            │       │  behind it
│ └──────────────────────┘ └─────────────────────┘       │
├────────────────────────────────────────────────────────┤
│ Nearly Finished   "3 episodes left", big ember numeral │
│ Airing This Week  rail, day badge per cover            │  real airing data
│ Recently Completed  shelf rail + finish dates + shelf  │
├──────────────────────────────┬─────────────────────────┤
│ ◆ THIS WEEK   4 stat tiles   │ ◆ YOUR SCORES           │
│ ◆ GENRES YOU RATE HIGHEST    │  ▁▂▃▅█▇  1..10 + mean   │
├──────────────────────────────┼─────────────────────────┤
│ Activity   timeline w/ rule  │ Your Collections        │
│   Watched episode 9 of …     │  stack + name + count   │
└──────────────────────────────┴─────────────────────────┘
```

### Library — "My shelf"

The Library answers two questions and nothing else: **what am I in the middle of**, and
**how far in am I**. Ordering by taste is a different activity and lives in its own section
now — a ranking strip used to sit at the top of this page, competing for the space the
shelves needed and pushing them below the fold on every visit.

So the hero is those two answers: the six titles most recently touched, at generous size,
each standing on its own progress bar, over a blown-up wash of the most recent cover. A
**status ribbon** underneath gives the whole shelf its shape in one line — one segment per
status, sized by proportion. Five count chips can *state* the balance of a library; only the
ribbon *shows* it.

Then type tabs, status chips, and the toolbar. Three views:

- **Shelves** *(default)* — one horizontal row per status, larger covers standing on a
  `ShelfLine`, each row named in plain language ("On the go", "Waiting for you"). This is the
  default because the library should look like a bookcase the first time you open it.
- **Grid** — 2:3 posters, staggered so alternate covers drop half a step; hover reveals the
  progress control and the rating.
- **List** — dense rows with a mono index, ticked progress track, inline stepper, stars,
  community score and last-touched.

Sorts are `updated · added · title · score · progress`. There is no rank sort: half a
feature in a page that no longer explains it is worse than none.

#### Ticking one off

Advancing an episode from a poster is the most repeated action in the product, so the
poster's hover controls are built to feel like a to-do list:

- **The controls are siblings of the card's link, never children of it.** That one
  structural decision removes every "it navigated instead of counting" bug the previous
  version could produce, and every `preventDefault` that used to paper over them.
- **−/＋ stay put and stay hit-able** for as long as the poster is hovered; the panel is
  always mounted and only its opacity and offset animate.
- **The count is a button** — click it and type an exact number.
- **The progress track always occupies its row**, even at zero. Revealing it on the first
  tick used to grow the card and shove the rest of the grid down, which is the exact
  opposite of what ticking something off should feel like.
- `+`/`-` work from anywhere inside the card, so a focused poster is keyboard-operable
  without a single extra tab stop.
- The last episode swaps ＋ for a tick.

**Right-click any poster** for the full set: advance, favorite, status, every collection
as a checkbox, remove. The collections list is inlined rather than nested behind a second
popover — a menu inside a menu dismisses the moment you reach for the inner one.

Every poster also carries a **quick ＋** that files it into a collection without leaving the
shelf — in or out of the library, on every page. Filing is the signature gesture of this
product and it should never require a trip to a detail page.

A popover opened *from* those hover controls keeps them visible for as long as it is open.
The pointer leaves the card the instant it travels to the panel, and controls that fade out
from under an open panel are exactly what makes a rating feel like it flickers and dismisses
itself. (The mechanism matters: the visible/hidden states are written as *branches*, never
as `opacity-0` plus an `opacity-100` override. Two conflicting utilities of equal
specificity are resolved by stylesheet order, not by the order they appear in the class
string, so "just add the override" silently loses.)

### Rankings — a room for deciding

Ordering by taste is not tracking, so it does not live in the Library.

- **Podium** — the top three on plinths of different heights, the winner in the middle on
  wide screens, each numeral set enormous *behind* its poster and bleeding off the edge: a
  plaque on the wall, not a badge on the artwork. Over a wash of number one's cover.
- **The full order** — a drag-to-reorder list. The whole row is the target and the grip
  appears on hover; every row also carries a one-click "make this first", because dragging
  item #90 to #1 with a mouse is a minute of scrolling.
- **Rank a title** — a wall of covers from your own library, not a dropdown of titles. You
  are choosing by memory of the thing, and artwork is the fastest route to that memory. New
  entries land at the bottom.
- A standing prompt names how many titles are still unranked, so the list has an obvious
  next move rather than trailing off.

Ranking stays deliberately independent of score: a shelf of 10/10s still has a #1, and that
judgment is the entire point of the page.

### Media page — the centerpiece

```
┌────────────────────────────────────────────────────────┐
│  banner image, 340px, scrim to canvas                  │
│                                                        │
├───────┬────────────────────────────────────────────────┤
│ ┌───┐ │  ◆ ANIME · TV · 2023 · MADHOUSE                │  cover overlaps
│ │cvr│ │  Frieren: Beyond Journey's End                 │  banner by 96px
│ │   │ │  葬送のフリーレン                               │  accent = artwork
│ └───┘ │  ● Episode 29 · Friday 01:00                   │  live airing pill
│       │  ★★★★★ 10 MASTERPIECE   #1 of anime   ♥        │
│ Shelf │  ┌──────────────────────────────────────────┐  │
│ Coll  │  │ ◆ EPISODE   ( − 8/28 + )   ▍▍▍▍▍▍░░░░░░  │  │  ticked track
│ AniLst│  └──────────────────────────────────────────┘  │
├───────┴────────────────────────────────────────────────┤
│ The story (66ch)             │ ◆ THE RECORD            │
│ genres                       │ format, source, studio  │
│ ── Your verdict ──           │ season, status, dates   │  the rating gets
│ ── In your collections ──    │ ── MADE BY ──           │  its own block,
│ ── You and this one ──       │ ── TAGGED ──            │  once completed
│ ── Who's in it ──            │                         │
│ ── Elsewhere in this world ──│                         │
│ ── Try these next ──         │                         │
└────────────────────────────────────────────────────────┘
```

Not a Wikipedia page: the synopsis is capped and collapsible, the record is a quiet sidebar
in the catalog voice, and everything above it is *your* relationship with the title — your
verdict, your collections, your history — not the metadata.

### Collections — the signature feature

Exhibitions, not folders.

- **Index** — the largest collection takes the top of the page as a **banner**: its own covers
  cropped into a full-width strip under a scrim, the name at `display-lg`. The rest are cards
  that rotate through **three** cover treatments by position — the fanned **stack**, the hard
  **mosaic** (four covers butted together on a 1px grid), and the **split** (one hero cover,
  three spines beside it) — so no two adjacent cards are composed the same way. Every card
  carries a quick **＋** on hover that opens bulk add. A dashed "New collection" card closes
  the grid.
- **Organize** — the index flips into a **board**: your library in the left column, every
  collection beside it, covers you can pick up and drop. Dragging out of the library
  *copies*; dragging between collections *moves*; dropping back on the library *removes*.
  Filing used to be four steps and two screens per title — a whole afternoon of tidying is
  now one screen with no navigation at all.
- **Bulk add** — one dialog, searchable, multi-select, picking from a **wall of covers**
  rather than a list of titles. Reachable from a collection's header, from any card's
  quick ＋, and from every column on the board.
- **Add to Collection** — from any media page, one click opens a dialog that does the three
  things filing actually requires, without ever closing: **search** (nobody scans forty
  rows), **multi-select** (a title belongs to shelves in the plural), and **create inline**
  ("the shelf I want doesn't exist" is the commonest reason filing gets abandoned, and
  sending someone to another screen to fix it loses both the collection and the title).
  Each row shows three of that collection's covers — choosing between "Comfort" and
  "Rewatch" from two words is guesswork; from six covers it isn't. Every toggle applies
  immediately, so there is no Save button to forget.
- **Detail** — a full-bleed **exhibition header**: covers behind a scrim, `display-xl` name,
  the reason in prose width, then a mono meta row (count · privacy · since). Items render in
  the collection's chosen layout:
  - `grid` — staggered posters
  - `ranked` — an enormous mono numeral that turns ember on hover, the plaque beside the exhibit
  - `showcase` — a magazine spread alternating sides, with each item's note set as a
    **pull-quote** against an ember rule on the leading edge
- **Three modes, never two at once** — a page that is simultaneously browsable, draggable
  and selectable is a page where every click is a coin toss:
  - `browse` — read it, open things, write notes
  - `reorder` — **drag in place, in the layout you are already looking at.** Reordering used
    to happen in a stripped-down list beside the collection, which was the wrong trade: you
    order a collection by looking at the artwork, so hiding the artwork removes the only
    information you were using. Grid layouts sort as a grid; ranked layouts sort as rows.
  - `select` — full-tile checkboxes and a floating action bar: **move to**, **copy to**,
    **remove** (with Undo). Pinned to the viewport, not the end of the page — a bulk action
    is something you reach for *while* looking at what you picked.
- **Find in this collection** appears once a collection passes eight titles. A filter box
  over six covers is furniture, not a tool. Filtering and reordering are mutually exclusive
  by construction: dragging inside a filtered view would write positions relative to rows
  that aren't on screen.
- **Editor** — a dialog: name, description, cover, banner, tags, privacy, layout.

### Discover — wandering a bookshop

No global popularity chart anywhere. Nine shelves, each generated from the user's own data
and titled to say exactly why it is there. The first is a full-width spotlight; the rest are
rails, so the page has rhythm rather than repetition.

- **Recommended Because You Loved *Cowboy Bebop*** → recommendations for their top-rated
  title, led by one `FeatureCard` at hero scale with the rest as a rail
- **On Your Planning List** → their own backlog, so it stops being a graveyard
- **Best in Horror** → top genre by average score, with `you average 8.4` at the header rule
- **Airing This Season** → narrowed to their strongest genre
- **Hidden Gems** → high-scoring titles well past the front table
- **Short Enough to Finish Tonight** → films and runs of ≤13 episodes
- **More Thriller** → a strong genre that hasn't come up lately

Search results use the **lead grid**: the first cell spans two columns and two rows, so a
wall of covers opens with one large piece instead of reading as a uniform tile.

Every poster carries its community score. Nothing on the page is titled after where the
data came from.

### Profile — someone's room, not their account

**Guest mode is the default, not a fallback.** Signed out, the entire product works:
tracking, progress, scores, rankings, collections, discovery. Nothing is gated, nothing is
teased, no dialog interrupts to ask for an account.

Profile is the single exception, and it is an honest one — it is the page you would *share*,
the statistics you would keep *across devices*, the name on the door. Without an account
there is nobody whose room it is, no link to share it at, and nothing keeping it in sync. So
signed out the destination disappears from the rail and the route explains itself in one
sentence, leading with what already works rather than with what is locked.

**A new profile is empty.** Genuinely: no display name, no handle, no bio, no genres, no
widgets arranged, and `is_public` off. Sign-up collects an email and a password and nothing
else — the display name field is gone, and the server no longer derives one from the email's
local part, which is how an account belonging to `etc@…` ended up permanently introducing
itself as "etc". The heading on an unnamed profile is the button that names it.

**Erasing is reachable.** Settings carries a confirmed, typed "Erase everything" that
deletes the library, rankings, collections, notes, history and profile — locally *and*
remotely — and returns the app to first run. The account survives, empty. It is the one
irreversible action in a product where every other removal offers Undo, so it is the one
action that asks you to type a word, and it offers an export on the way past.

Then: banner (their own covers, if they haven't set one), avatar, name, a line about them,
and the **taste line** — the three genres they reach for. Then a reorderable widget column:

`Currently obsessed with · Watching & reading now · Your ranking · Collections worth sharing ·
Favorites · The numbers · Taste profile · How you score · The years you love ·
This year so far · Lately`

"Rearrange" reveals drag handles and visibility toggles; the layout persists. New widgets are
folded into saved layouts by `mergeWidgets()`, so a release that adds furniture doesn't leave
it invisible to everyone who already has a room.

#### Your scores, as a shape

Wherever the app shows scores in aggregate — profile and dashboard — it shows one component,
`ScoreHistogram`, and never a bare average beside a row of digits. An average is a number you
have to think about; a histogram answers the real question at a glance: *are you generous,
are you harsh, do you only finish things you already know you'll love.*

Deliberately not a chart library:

- the axis is the product's own **five-star scale**, drawn under the ten columns it maps
  onto, so `8` and `★★★★` are visibly one statement rather than two scales to reconcile
- the mean is a **hairline standing in the plot** at its true fractional position with a
  small flag, not a legend entry
- bars carry two levels of ember by band, so the *mass* of the distribution reads before any
  individual column does
- no gridlines, no tick marks, no boxed frame — the baseline rule is the only structure,
  which is how every other section on the page is built
- the readout above the plot reserves its height, so sweeping the columns can never nudge
  the chart underneath it

---

## 4. Accessibility

- Focus is always visible: 2px `--accent` ring at 2px offset, never removed.
- Every icon-only control has an accessible name.
- Dialogs and popovers trap focus and restore it on close.
- Ratings, progress steppers, segmented controls and sortable lists are all fully keyboard
  operable (`@dnd-kit` keyboard sensor included). `RatingInput` also takes a bare digit —
  press `8` and it is an 8.
- Status is never communicated by color alone — dots always sit next to a text label, and a
  score always sits next to its word.
- Text contrast is measured, not eyeballed: `ink` ≥ 16:1, `ink-2` ≥ 7:1, and `ink-3` ≥ 4.5:1
  against canvas, surface and surface-2 in **both** themes. `ink-3` carries the catalog
  label, which is 10.5px, so it is tuned to that floor rather than to taste.
- Scrims over artwork are opaque enough that hero type meets the same floor regardless of
  which cover is behind it.
- All motion respects `prefers-reduced-motion`.
- Targets are ≥ 36×36 desktop, ≥ 44×44 touch.
