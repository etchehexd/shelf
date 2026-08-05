import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, LogOut, Pencil, Share2 } from 'lucide-react'
import {
  Avatar,
  BarRow,
  Button,
  Card,
  CoverImage,
  CoverStack,
  Dialog,
  Eyebrow,
  Field,
  ImagePicker,
  Input,
  Pill,
  Rail,
  Rating,
  ScoreHistogram,
  SectionHeader,
  ShelfLine,
  StatTile,
  Switch,
  Textarea,
  toast,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { useLibrary, nameOf } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { SignInWall } from '@/features/auth/SignInWall'
import {
  genreAffinity,
  groupByDay,
  libraryTotals,
  useActivity,
  useAllEntries,
  useCollections,
  useContinueList,
  useRankedIds,
  useRatingDistribution,
  useTrackedIds,
} from '@/data/store/selectors'
import { WIDGET_LABEL, mergeWidgets, type WidgetConfig, type WidgetId } from '@/data/store/types'
import { ShelfCover } from '@/features/tracking/cards'
import { cn } from '@/lib/cn'
import { dayLabel } from '@/lib/dates'
import { compactNumber, duration, pluralize, scoreText } from '@/lib/format'

export default function ProfilePage() {
  const profile = useLibrary((s) => s.profile)
  const setWidgets = useLibrary((s) => s.setWidgets)
  const { session, enabled, signOut } = useAuth()

  const [editingProfile, setEditingProfile] = useState(false)
  const [arranging, setArranging] = useState(false)

  const trackedIds = useTrackedIds()
  const { map } = useMediaMap(trackedIds)
  const entries = useAllEntries()

  // Fold in any widgets added since this profile was last saved.
  const widgets = useMemo(() => mergeWidgets(profile.widgets), [profile.widgets])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = widgets.findIndex((w) => w.id === active.id)
    const to = widgets.findIndex((w) => w.id === over.id)
    if (from === -1 || to === -1) return
    setWidgets(arrayMove(widgets, from, to))
  }

  const toggle = (id: WidgetId) =>
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)))

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.handle}`)
      toast({
        message: profile.isPublic ? 'Link copied' : 'Link copied — your room is private, though',
      })
    } catch {
      toast({ message: 'Could not copy the link', tone: 'danger' })
    }
  }

  const visible = widgets.filter((w) => w.visible)
  const affinity = useMemo(() => genreAffinity(entries, map, 3), [entries, map])

  // A profile is a room you show other people. Signed out there is nobody whose
  // room it is, no link to share it at, and nothing to keep it in sync.
  if (enabled && !session) {
    return (
      <SignInWall section="Profile" headline="A room needs an owner.">
        Your profile is the page you'd share, the statistics that follow you between devices,
        the name on the door. None of it means anything until it belongs to somebody.
      </SignInWall>
    )
  }

  return (
    <div className="bleed-x -mt-6">
      {/* banner ------------------------------------------------------------ */}
      <div className="relative h-44 overflow-hidden bg-surface-2 md:h-64">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className="size-full object-cover" />
        ) : (
          <CoverWall map={map} />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(var(--scrim) / 0.25), rgb(var(--scrim) / 0.86) 60%, rgb(var(--scrim) / 1))',
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-(--container-page) px-5 md:px-10">
        {/* header ---------------------------------------------------------- */}
        <header className="relative -mt-16 md:-mt-20">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="flex items-end gap-5">
              <Avatar src={profile.avatarUrl} name={nameOf(profile)} size="xl" ring />
              <div className="pb-1">
                {/* A blank profile says so, and the heading is the button that
                    fixes it. An account that has just been made has no name
                    because nobody has given it one yet — not because something
                    failed to load. */}
                {profile.displayName.trim() ? (
                  <h1 className="text-display-lg text-ink">{profile.displayName}</h1>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="text-display-lg text-ink-3 transition-colors hover:text-accent"
                  >
                    Name this room
                  </button>
                )}
                {profile.handle.trim() && (
                  <p className="label-cat label-cat-plain mt-1.5">@{profile.handle}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pb-1">
              {profile.handle.trim() && (
                <Button icon={<Share2 className="size-4" />} onClick={share}>
                  Share
                </Button>
              )}
              <Button
                icon={<GripVertical className="size-4" />}
                onClick={() => setArranging((v) => !v)}
                aria-pressed={arranging}
              >
                {arranging ? 'Done' : 'Arrange'}
              </Button>
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditingProfile(true)}>
                Edit
              </Button>
              {/* Signing out belongs on the page that is about who you are, not
                  only behind the avatar menu. Local data survives it, so this is
                  an ordinary action and not styled as a destructive one. */}
              {session && (
                <Button icon={<LogOut className="size-4" />} onClick={() => void signOut()}>
                  Sign out
                </Button>
              )}
            </div>
          </div>

          {/* The counts, as a row.
              Straight from the Letterboxd reading of a profile: a handful of
              totals sitting beside the name, each one a number and a word, no
              icons and no cards. It is the fastest possible answer to "who is
              this person" — and it is the thing this header was missing, which
              is why it read as a banner with a name on it rather than as a
              profile. Each figure links to the view that produced it, so the
              row is navigation as well as summary. */}
          <StatStrip className="mt-7" entries={entries} map={map} />

          {profile.bio && (
            <p className="prose-width mt-6 text-body text-ink-2">{profile.bio}</p>
          )}

          {/* The taste line: what this person is, in six words of data. */}
          {affinity.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Eyebrow>Genres</Eyebrow>
              {affinity.map((g) => (
                <Link key={g.genre} to={`/discover?genre=${encodeURIComponent(g.genre)}`}>
                  <Pill tone="accent" size="sm">
                    {g.genre}
                  </Pill>
                </Link>
              ))}
              {profile.favoriteGenres.map((g) => (
                <Pill key={g} size="sm">
                  {g}
                </Pill>
              ))}
            </div>
          )}

          <ShelfLine className="mt-8" />
        </header>

        {/* widgets --------------------------------------------------------- */}
        <div className="mt-12 space-y-16 pb-10">
          {arranging ? (
            <Card padding="compact" radius="lg" className="max-w-xl">
              <Eyebrow className="mb-4">Move the furniture</Eyebrow>
              <p className="mb-5 text-body text-ink-2">
                Drag to reorder. Hide anything you'd rather not show.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              >
                <SortableContext
                  items={widgets.map((w) => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {widgets.map((w) => (
                      <WidgetRow key={w.id} widget={w} onToggle={() => toggle(w.id)} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </Card>
          ) : (
            visible.map((w) => <Widget key={w.id} id={w.id} map={map} entries={entries} />)
          )}
        </div>
      </div>

      <ProfileEditor open={editingProfile} onClose={() => setEditingProfile(false)} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The figures row.
 *
 * Deliberately plain: a big number, a small word under it, a hairline between
 * each. No cards, no icons, no color. The moment a stat gets a container it
 * becomes a widget competing with the rest of the page, and the whole value of
 * this pattern is that six facts occupy one line.
 */
function StatStrip({
  entries,
  map,
  className,
}: {
  entries: ReturnType<typeof useAllEntries>
  map: Map<number, MediaSummary>
  className?: string
}) {
  const collections = useCollections()
  const totals = useMemo(() => libraryTotals(entries, map), [entries, map])

  const thisYear = useMemo(() => {
    const start = new Date(new Date().getFullYear(), 0, 1).getTime()
    return entries.filter((e) => e.finishedAt && new Date(e.finishedAt).getTime() >= start).length
  }, [entries])

  const figures: { value: string | number; label: string; to: string }[] = [
    { value: compactNumber(totals.titles), label: 'Titles', to: '/library' },
    { value: thisYear, label: 'This year', to: '/library?status=completed' },
    { value: compactNumber(totals.episodes), label: 'Episodes', to: '/library' },
    { value: collections.length, label: 'Collections', to: '/collections' },
    { value: totals.meanScore ? scoreText(totals.meanScore) : '—', label: 'Average', to: '/library?sort=score' },
  ]

  return (
    <div className={cn('flex flex-wrap items-stretch', className)}>
      {figures.map((f, i) => (
        <Link
          key={f.label}
          to={f.to}
          className={cn(
            'group/stat min-w-20 px-5 first:pl-0',
            i > 0 && 'border-l border-line',
          )}
        >
          <span className="font-mono-num block text-display-sm leading-none font-bold text-ink tabular-nums transition-colors group-hover/stat:text-accent">
            {f.value}
          </span>
          <span className="label-cat label-cat-plain mt-1.5 block">{f.label}</span>
        </Link>
      ))}
    </div>
  )
}

/**
 * The default banner: a wall of your own covers, cropped to a strip and dimmed.
 * A profile with no banner should still look like it belongs to somebody.
 */
function CoverWall({ map }: { map: Map<number, MediaSummary> }) {
  const covers = useMemo(() => [...map.values()].slice(0, 14), [map])

  if (covers.length === 0) {
    return <div className="size-full bg-gradient-to-br from-accent-quiet via-surface-2 to-surface-3" />
  }

  /**
   * Two layers, both full width. No corner ornament.
   *
   * The first attempt stretched six 2:3 covers across a 21:9 strip and cropped
   * every one through the face. The second replaced that with a blur plus a
   * small fan of covers tucked into the top-right, which read as a smudge or a
   * rendering artifact rather than as a decision — a decoration small enough
   * to look accidental is worse than no decoration.
   *
   * This is a blurred wash of the lead cover for color, with the real covers
   * running the *full* width as a tiled band at low opacity. It fills the space
   * it is given, so there is no corner for the eye to snag on, and at 21:9 each
   * cover is a vertical stripe of color rather than a cropped portrait.
   */
  return (
    <div className="relative size-full overflow-hidden">
      {covers[0]?.coverImage && (
        <img src={covers[0].coverImage} alt="" className="art-wash size-full object-cover" />
      )}

      <div className="absolute inset-0 flex opacity-40 mix-blend-luminosity" aria-hidden>
        {covers.slice(0, 10).map((m) => (
          <div key={m.id} className="h-full flex-1">
            {m.coverImage && (
              <img src={m.coverImage} alt="" className="size-full object-cover blur-[2px]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetRow({ widget, onToggle }: { widget: WidgetConfig; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2.5',
        isDragging && 'z-10 shadow-lg',
        !widget.visible && 'opacity-55',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-sm p-1 text-ink-3 hover:text-ink active:cursor-grabbing"
        aria-label={`Reorder ${WIDGET_LABEL[widget.id]}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span className="flex-1 text-label text-ink">{WIDGET_LABEL[widget.id]}</span>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={widget.visible}
        aria-label={widget.visible ? `Hide ${WIDGET_LABEL[widget.id]}` : `Show ${WIDGET_LABEL[widget.id]}`}
        className="rounded-sm p-1.5 text-ink-3 hover:text-ink"
      >
        {widget.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </li>
  )
}

/* -------------------------------------------------------------------------- */

function Widget({
  id,
  map,
  entries,
}: {
  id: WidgetId
  map: Map<number, MediaSummary>
  entries: ReturnType<typeof useAllEntries>
}) {
  switch (id) {
    case 'obsession':
      return <ObsessionWidget map={map} />
    case 'currently':
      return <CurrentlyWidget map={map} />
    case 'top-ranked':
      return <TopRankedWidget map={map} />
    case 'featured-collections':
      return <CollectionsWidget map={map} />
    case 'statistics':
      return <StatisticsWidget entries={entries} map={map} />
    case 'rating-distribution':
      return <DistributionWidget />
    case 'genre-affinity':
      return <AffinityWidget entries={entries} map={map} />
    case 'eras':
      return <ErasWidget entries={entries} map={map} />
    case 'year-in-review':
      return <YearWidget entries={entries} map={map} />
    case 'recent-activity':
      return <ActivityWidget />
    case 'favorites':
      return <FavoritesWidget map={map} />
  }
}

/**
 * The single title this person is deepest into right now, given the size that
 * an obsession deserves. It is the first thing in the room for a reason.
 */
function ObsessionWidget({ map }: { map: Map<number, MediaSummary> }) {
  const list = useContinueList(1)
  const language = usePrefs((s) => s.titleLanguage)
  const entry = list[0]
  const media = entry ? map.get(entry.mediaId) : undefined

  if (!entry || !media) return null

  return (
    <section className="space-y-4">
      <Eyebrow>Most watched lately</Eyebrow>
      <Link
        to={`/media/${media.id}`}
        className="group relative flex items-center gap-6 overflow-hidden rounded-xl border border-line bg-surface-2 p-6 md:gap-9 md:p-8"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {media.bannerImage && (
            <img src={media.bannerImage} alt="" className="size-full object-cover opacity-25" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(100deg, rgb(var(--scrim) / 0.96), rgb(var(--scrim) / 0.7))',
            }}
          />
        </div>

        <div className="frame-lift relative w-24 shrink-0 md:w-32">
          <CoverImage src={media.coverImage} alt="" color={media.color} />
        </div>

        <div className="relative min-w-0">
          <h3 className="text-balance text-display-md text-ink">
            {displayTitle(media, language)}
          </h3>
          <p className="label-cat label-cat-plain mt-3">
            {entry.progress} {entry.kind === 'anime' ? 'episodes' : 'chapters'} in
          </p>
        </div>
      </Link>
    </section>
  )
}

function CurrentlyWidget({ map }: { map: Map<number, MediaSummary> }) {
  const list = useContinueList(12)
  if (list.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader title="Watching & Reading" size="sm" />
      <div>
        <Rail aria-label="Currently watching">
          {list.map((entry) => {
            const media = map.get(entry.mediaId)
            return media ? <ShelfCover key={entry.mediaId} media={media} entry={entry} /> : null
          })}
        </Rail>
        <ShelfLine className="mt-2.5" />
      </div>
    </section>
  )
}

function TopRankedWidget({ map }: { map: Map<number, MediaSummary> }) {
  const [kind, setKind] = useState<MediaKind>('anime')
  const ids = useRankedIds(kind)
  const entries = useLibrary((s) => s.entries)
  const language = usePrefs((s) => s.titleLanguage)

  return (
    <section className="space-y-5">
      <SectionHeader
        title={`Your Top ${KIND_LABEL[kind]}`}
        size="sm"
        action={
          <div className="flex gap-1">
            {(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-meta transition-colors',
                  kind === k ? 'bg-accent text-accent-ink' : 'text-ink-3 hover:text-ink',
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        }
      />

      {ids.length === 0 ? (
        <p className="text-body text-ink-3">
          Nothing ordered yet. Ranking is separate from scoring — it's for putting the ones you
          already love in a line.
        </p>
      ) : (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {ids.slice(0, 10).map((mediaId, i) => {
            const media = map.get(mediaId)
            const entry = entries[mediaId]
            return (
              <li key={mediaId}>
                <Link
                  to={`/media/${mediaId}`}
                  className="group/rank flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-surface-2"
                >
                  <span
                    className="font-mono-num w-7 shrink-0 text-right text-display-sm leading-none font-semibold text-ink-3/50 transition-colors group-hover/rank:text-accent"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  {media && (
                    <span className="w-9 shrink-0">
                      <CoverImage src={media.coverImage} alt="" color={media.color} flat />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-label text-ink">
                    {media ? displayTitle(media, language) : '…'}
                  </span>
                  {entry?.score != null && <Rating value={entry.score} size="xs" />}
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function CollectionsWidget({ map }: { map: Map<number, MediaSummary> }) {
  const collections = useCollections()
  const items = useLibrary((s) => s.collectionItems)
  const featured = collections.filter((c) => c.privacy !== 'private').slice(0, 3)

  if (featured.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Collections"
        size="sm"
        action={
          <Link to="/collections" className="label-cat label-cat-plain hover:text-ink">
            All collections
          </Link>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((c) => {
          const covers = items
            .filter((i) => i.collectionId === c.id)
            .sort((a, b) => a.position - b.position)
            .slice(0, 4)
            .map((i) => map.get(i.mediaId))
            .filter(Boolean) as MediaSummary[]

          return (
            <Link
              key={c.id}
              to={`/collections/${c.id}`}
              className="group rounded-xl border border-line bg-surface p-5 transition-[transform,border-color,box-shadow] duration-[420ms] ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-line-strong hover:shadow-md"
            >
              <div className="flex justify-center">
                <CoverStack
                  covers={covers.map((m) => ({ id: m.id, src: m.coverImage, color: m.color }))}
                  width={58}
                  offset={24}
                />
              </div>
              <h3 className="mt-5 text-display-sm text-ink transition-colors group-hover:text-accent">
                {c.name}
              </h3>
              <p className="label-cat label-cat-plain mt-2">
                {pluralize(items.filter((i) => i.collectionId === c.id).length, 'title')}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function StatisticsWidget({
  entries,
  map,
}: {
  entries: ReturnType<typeof useAllEntries>
  map: Map<number, MediaSummary>
}) {
  const totals = useMemo(() => libraryTotals(entries, map), [entries, map])

  return (
    <section className="space-y-5">
      <SectionHeader title="Statistics" size="sm" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Titles" value={compactNumber(totals.titles)} />
        <StatTile label="Episodes" value={compactNumber(totals.episodes)} />
        <StatTile label="Chapters" value={compactNumber(totals.chapters)} />
        <StatTile label="Time spent" value={duration(totals.minutes)}  />
        <StatTile label="Average" value={totals.meanScore ? scoreText(totals.meanScore) : '—'} />
      </div>
    </section>
  )
}

function DistributionWidget() {
  const distribution = useRatingDistribution()
  const total = distribution.reduce((a, b) => a + b, 0)

  if (total === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader title="Your Scores" size="sm" />
      <ScoreHistogram distribution={distribution} height={148} />
    </section>
  )
}

function AffinityWidget({
  entries,
  map,
}: {
  entries: ReturnType<typeof useAllEntries>
  map: Map<number, MediaSummary>
}) {
  const affinity = useMemo(() => genreAffinity(entries, map, 8), [entries, map])
  if (affinity.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Genres"
        size="sm"
      />
      <div className="max-w-xl space-y-2.5">
        {affinity.map((g) => (
          <BarRow
            key={g.genre}
            label={g.genre}
            value={g.averageScore ?? 0}
            max={10}
            readout={g.averageScore ? scoreText(g.averageScore) : '—'}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * The years your favorites came out. A quiet, honest way of showing whether
 * someone lives in the nineties or only watches what's airing now.
 */
function ErasWidget({
  entries,
  map,
}: {
  entries: ReturnType<typeof useAllEntries>
  map: Map<number, MediaSummary>
}) {
  const years = useMemo(() => {
    const buckets = new Map<number, number>()
    for (const entry of entries) {
      const year = map.get(entry.mediaId)?.seasonYear
      if (!year) continue
      buckets.set(year, (buckets.get(year) ?? 0) + 1)
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0])
  }, [entries, map])

  if (years.length < 3) return null

  const max = Math.max(...years.map(([, n]) => n))
  const best = years.reduce((a, b) => (b[1] > a[1] ? b : a))

  return (
    <section className="space-y-5">
      <SectionHeader
        title="By Year"
        size="sm"
        action={<span className="label-cat label-cat-plain">peak {best[0]}</span>}
      />
      <div className="flex max-w-2xl items-end gap-1 overflow-x-auto pb-1">
        {years.map(([year, count]) => (
          <div key={year} className="group/era flex min-w-[1.75rem] flex-1 flex-col items-center gap-2">
            <div
              className={cn(
                'w-full rounded-t-[2px] transition-colors duration-300',
                year === best[0] ? 'bg-accent' : 'bg-ink-3/25 group-hover/era:bg-accent/60',
              )}
              style={{ height: `${Math.max(6, (count / max) * 72)}px` }}
              title={`${count} from ${year}`}
            />
            <span className="font-mono-num text-[0.5625rem] text-ink-3">
              {String(year).slice(2)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** This year, as a sentence and four numbers. */
function YearWidget({
  entries,
  map,
}: {
  entries: ReturnType<typeof useAllEntries>
  map: Map<number, MediaSummary>
}) {
  const year = new Date().getFullYear()
  const start = new Date(year, 0, 1).getTime()

  const stats = useMemo(() => {
    let finished = 0
    let started = 0
    let rated = 0
    let scoreSum = 0
    let best: { title: number; score: number } | null = null

    for (const entry of entries) {
      if (entry.finishedAt && new Date(entry.finishedAt).getTime() >= start) finished += 1
      if (entry.createdAt >= start) started += 1
      if (entry.score != null && entry.updatedAt >= start) {
        rated += 1
        scoreSum += entry.score
        if (!best || entry.score > best.score) best = { title: entry.mediaId, score: entry.score }
      }
    }

    return { finished, started, rated, mean: rated > 0 ? scoreSum / rated : null, best }
  }, [entries, start])

  if (stats.finished + stats.started === 0) return null

  const bestMedia = stats.best ? map.get(stats.best.title) : undefined

  return (
    <section className="space-y-5">
      <SectionHeader title={`${year} So Far`} size="sm" />
      <Card tone="sunk" radius="lg" padding="compact">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          <StatTile label="Finished" value={stats.finished} />
          <StatTile label="Started" value={stats.started} />
          <StatTile label="Rated" value={stats.rated} />
          <StatTile
            label="Average"
            value={stats.mean != null ? stats.mean.toFixed(1) : '—'}
          />
        </div>

        {bestMedia && stats.best && (
          <Link
            to={`/media/${bestMedia.id}`}
            className="group mt-7 flex items-center gap-4 border-t border-line pt-5"
          >
            <div className="w-11 shrink-0">
              <CoverImage src={bestMedia.coverImage} alt="" color={bestMedia.color} />
            </div>
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">Best thing all year</Eyebrow>
              <p className="truncate text-title font-semibold text-ink transition-colors group-hover:text-accent">
                {bestMedia.title.english ?? bestMedia.title.romaji}
              </p>
            </div>
            <Rating value={stats.best.score} size="sm" showValue className="ml-auto shrink-0" />
          </Link>
        )}
      </Card>
    </section>
  )
}

function ActivityWidget() {
  const activity = useActivity(24)
  const days = useMemo(() => groupByDay(activity).slice(0, 3), [activity])
  if (days.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader title="Activity" size="sm" />
      <div className="max-w-xl space-y-4">
        {days.map(({ day, events }) => (
          <div key={day} className="flex items-baseline gap-4">
            <Eyebrow tick={false} className="w-24 shrink-0">
              {dayLabel(day)}
            </Eyebrow>
            <p className="text-body text-ink-2">
              {pluralize(events.length, 'update')} — {summarize(events.map((e) => e.type))}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

const ACTIVITY_NOUN: Record<string, string> = {
  progress: 'episodes logged',
  status: 'status changes',
  score: 'verdicts',
  rank: 'reorderings',
  collection: 'filings',
  note: 'notes',
  added: 'added',
  removed: 'removed',
}

function summarize(types: string[]): string {
  const counts = new Map<string, number>()
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, n]) => `${n} ${ACTIVITY_NOUN[type] ?? type}`)
    .join(', ')
}

function FavoritesWidget({ map }: { map: Map<number, MediaSummary> }) {
  const entries = useAllEntries()
  const favorites = entries.filter((e) => e.favorite)
  if (favorites.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader title="Favorites" size="sm" />
      <div>
        <Rail aria-label="Favorites">
          {favorites.map((entry) => {
            const media = map.get(entry.mediaId)
            return media ? (
              <ShelfCover key={entry.mediaId} media={media} entry={entry} width="lg" />
            ) : null
          })}
        </Rail>
        <ShelfLine className="mt-2.5" />
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function ProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useLibrary((s) => s.profile)
  const updateProfile = useLibrary((s) => s.updateProfile)

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [bannerUrl, setBannerUrl] = useState(profile.bannerUrl ?? '')
  const [isPublic, setIsPublic] = useState(profile.isPublic)

  // The schema enforces this shape; validating here keeps the error local
  // instead of surfacing as a sync failure minutes later.
  const handleValid = /^[a-z0-9_]{3,24}$/.test(handle)

  // A brand-new profile has no handle at all, so "invalid" must not fire on the
  // empty string — the field is blank because it has never been filled in.
  const save = () => {
    if (!handleValid || !displayName.trim()) return
    updateProfile({
      displayName: displayName.trim(),
      handle,
      bio: bio.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      bannerUrl: bannerUrl.trim() || null,
      isPublic,
    })
    toast({ message: 'Room updated' })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit profile"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!handleValid}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Display name">
          {(props) => (
            <Input
              {...props}
              data-autofocus
              value={displayName}
              maxLength={40}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Handle"
          hint="Lowercase letters, numbers and underscores. 3–24 characters."
          error={handle.length > 0 && !handleValid ? 'That handle is not valid.' : undefined}
        >
          {(props) => (
            <Input
              {...props}
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
            />
          )}
        </Field>

        <Field label="Bio" counter={`${bio.length} / 280`}>
          {(props) => (
            <Textarea
              {...props}
              value={bio}
              maxLength={280}
              rows={3}
              
              onChange={(e) => setBio(e.target.value)}
            />
          )}
        </Field>

        <ImagePicker
          label="Profile picture"
          hint="Square works best. Resized to 512px."
          shape="circle"
          maxEdge={512}
          value={avatarUrl || null}
          onChange={(next) => setAvatarUrl(next ?? '')}
        />

        <ImagePicker
          label="Banner"
          hint="Wide works best. Leave it empty and your own covers fill the space."
          shape="banner"
          maxEdge={1600}
          value={bannerUrl || null}
          onChange={(next) => setBannerUrl(next ?? '')}
        />

        <Switch
          checked={isPublic}
          onChange={setIsPublic}
          label="Public profile"
          description="Anyone with your link can see your library, scores and activity."
        />
      </div>
    </Dialog>
  )
}
