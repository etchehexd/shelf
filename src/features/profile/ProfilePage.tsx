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
import { Eye, EyeOff, GripVertical, Pencil, Share2 } from 'lucide-react'
import {
  Avatar,
  BarRow,
  Button,
  Card,
  CoverImage,
  Dialog,
  Field,
  Input,
  Pill,
  Rail,
  SectionHeader,
  StatTile,
  Switch,
  Textarea,
  toast,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
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
import { WIDGET_LABEL, type WidgetConfig, type WidgetId } from '@/data/store/types'
import { ShelfCover } from '@/features/tracking/cards'
import { cn } from '@/lib/cn'
import { dayLabel } from '@/lib/dates'
import { compactNumber, duration, pluralize, scoreText } from '@/lib/format'

export default function ProfilePage() {
  const profile = useLibrary((s) => s.profile)
  const setWidgets = useLibrary((s) => s.setWidgets)

  const [editingProfile, setEditingProfile] = useState(false)
  const [arranging, setArranging] = useState(false)

  const trackedIds = useTrackedIds()
  const { map } = useMediaMap(trackedIds)
  const entries = useAllEntries()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = profile.widgets.findIndex((w) => w.id === active.id)
    const to = profile.widgets.findIndex((w) => w.id === over.id)
    if (from === -1 || to === -1) return
    setWidgets(arrayMove(profile.widgets, from, to))
  }

  const toggle = (id: WidgetId) =>
    setWidgets(profile.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)))

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.handle}`)
      toast({
        message: profile.isPublic ? 'Profile link copied' : 'Link copied — your profile is private',
      })
    } catch {
      toast({ message: 'Could not copy the link', tone: 'danger' })
    }
  }

  const visible = profile.widgets.filter((w) => w.visible)

  return (
    <div className="-mx-5 -mt-6 md:-mx-10">
      {/* banner ------------------------------------------------------------ */}
      <div className="relative h-40 overflow-hidden bg-surface-2 md:h-56">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-accent-quiet via-surface-2 to-surface-3" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(var(--scrim) / 0.05), rgb(var(--scrim) / 0.9))',
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-(--container-page) px-5 md:px-10">
        {/* header ---------------------------------------------------------- */}
        <header className="relative -mt-14 flex flex-wrap items-end justify-between gap-6 md:-mt-16">
          <div className="flex items-end gap-5">
            <Avatar src={profile.avatarUrl} name={profile.displayName} size="xl" ring />
            <div className="pb-1">
              <h1 className="font-display text-display-lg text-ink">{profile.displayName}</h1>
              <p className="text-body text-ink-3">@{profile.handle}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            <Button icon={<Share2 className="size-4" />} onClick={share}>
              Share
            </Button>
            <Button
              icon={<GripVertical className="size-4" />}
              onClick={() => setArranging((v) => !v)}
              aria-pressed={arranging}
            >
              {arranging ? 'Done' : 'Arrange'}
            </Button>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditingProfile(true)}>
              Edit profile
            </Button>
          </div>
        </header>

        {profile.bio && <p className="mt-5 max-w-prose text-body text-ink-2">{profile.bio}</p>}

        {profile.favouriteGenres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.favouriteGenres.map((g) => (
              <Pill key={g} tone="accent" size="sm">
                {g}
              </Pill>
            ))}
          </div>
        )}

        {/* widgets --------------------------------------------------------- */}
        <div className="mt-14 space-y-14 pb-8">
          {arranging ? (
            <Card padding="compact">
              <p className="mb-4 text-label font-medium text-ink">
                Drag to reorder. Toggle the eye to hide a section.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              >
                <SortableContext
                  items={profile.widgets.map((w) => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {profile.widgets.map((w) => (
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
    case 'recent-activity':
      return <ActivityWidget />
    case 'favourites':
      return <FavouritesWidget map={map} />
  }
}

function CurrentlyWidget({ map }: { map: Map<number, MediaSummary> }) {
  const list = useContinueList(12)
  if (list.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader eyebrow="Right now" title="Currently watching & reading" size="sm" />
      <Rail aria-label="Currently watching">
        {list.map((entry) => {
          const media = map.get(entry.mediaId)
          return media ? <ShelfCover key={entry.mediaId} media={media} entry={entry} /> : null
        })}
      </Rail>
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
        eyebrow="Ranked"
        title={`Your top ${KIND_LABEL[kind].toLowerCase()}`}
        size="sm"
        action={
          <div className="flex gap-1">
            {(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'rounded-sm px-2 py-1 text-meta',
                  kind === k ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink-2',
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
          Nothing ranked yet. Ranking is separate from scoring — it's for ordering the ones you
          already love.
        </p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {ids.slice(0, 10).map((mediaId, i) => {
            const media = map.get(mediaId)
            const entry = entries[mediaId]
            return (
              <li key={mediaId}>
                <Link
                  to={`/media/${mediaId}`}
                  className="flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-surface-2"
                >
                  <span className="tnum w-6 shrink-0 text-right font-display text-display-sm text-ink-3">
                    {i + 1}
                  </span>
                  {media && (
                    <span className="w-9 shrink-0">
                      <CoverImage src={media.coverImage} alt="" color={media.color} rounded="sm" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-label text-ink">
                    {media ? displayTitle(media, language) : '…'}
                  </span>
                  {entry?.score != null && (
                    <span className="tnum shrink-0 text-meta text-ink-3">
                      {scoreText(entry.score)}
                    </span>
                  )}
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
        eyebrow="Collections"
        title="Shelves worth sharing"
        size="sm"
        action={
          <Link to="/collections" className="text-label text-ink-3 hover:text-ink">
            All collections
          </Link>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((c) => {
          const covers = items
            .filter((i) => i.collectionId === c.id)
            .sort((a, b) => a.position - b.position)
            .slice(0, 3)
            .map((i) => map.get(i.mediaId))
            .filter(Boolean) as MediaSummary[]

          return (
            <Link
              key={c.id}
              to={`/collections/${c.id}`}
              className="group rounded-lg border border-line bg-surface p-4 transition-[transform,border-color] hover:-translate-y-[3px] hover:border-line-strong"
            >
              <div className="flex gap-1.5">
                {covers.map((m) => (
                  <span key={m.id} className="w-1/3">
                    <CoverImage src={m.coverImage} alt="" color={m.color} rounded="sm" />
                  </span>
                ))}
              </div>
              <h3 className="mt-3 font-display text-display-sm text-ink">{c.name}</h3>
              <p className="tnum text-meta text-ink-3">
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
      <SectionHeader eyebrow="Statistics" title="The shape of your library" size="sm" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Titles" value={compactNumber(totals.titles)} />
        <StatTile label="Episodes" value={compactNumber(totals.episodes)} />
        <StatTile label="Chapters" value={compactNumber(totals.chapters)} />
        <StatTile label="Time watched" value={duration(totals.minutes)} hint="approximate" />
        <StatTile
          label="Mean score"
          value={totals.meanScore ? scoreText(totals.meanScore) : '—'}
        />
      </div>
    </section>
  )
}

function DistributionWidget() {
  const distribution = useRatingDistribution()
  const max = Math.max(1, ...distribution)
  const total = distribution.reduce((a, b) => a + b, 0)

  if (total === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader eyebrow="Ratings" title="How you score" size="sm" />
      <div className="flex h-28 items-end gap-2">
        {distribution.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <span className="tnum text-micro text-ink-3">{count || ''}</span>
            <div
              className="w-full rounded-t-[3px] bg-accent"
              style={{
                height: `${Math.max(count === 0 ? 2 : 8, (count / max) * 100)}%`,
                opacity: count === 0 ? 0.18 : 1,
              }}
            />
            <span className="tnum text-micro text-ink-3">{i + 1}</span>
          </div>
        ))}
      </div>
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
        eyebrow="Taste"
        title="Genre affinity"
        description="Ranked by how highly you rate them, not by how many you've seen."
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

function ActivityWidget() {
  const activity = useActivity(24)
  const days = useMemo(() => groupByDay(activity).slice(0, 3), [activity])
  if (days.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader eyebrow="Lately" title="Recent activity" size="sm" />
      <div className="space-y-5">
        {days.map(({ day, events }) => (
          <div key={day}>
            <p className="mb-1.5 text-micro text-ink-3 uppercase">{dayLabel(day)}</p>
            <p className="text-body text-ink-2">
              {pluralize(events.length, 'update')} — {summarize(events.map((e) => e.type))}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function summarize(types: string[]): string {
  const counts = new Map<string, number>()
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, n]) => `${n} ${type}`)
    .join(', ')
}

function FavouritesWidget({ map }: { map: Map<number, MediaSummary> }) {
  const entries = useAllEntries()
  const favourites = entries.filter((e) => e.favourite)
  if (favourites.length === 0) return null

  return (
    <section className="space-y-5">
      <SectionHeader eyebrow="Favourites" title="The ones that stuck" size="sm" />
      <Rail aria-label="Favourites">
        {favourites.map((entry) => {
          const media = map.get(entry.mediaId)
          return media ? <ShelfCover key={entry.mediaId} media={media} entry={entry} /> : null
        })}
      </Rail>
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
    toast({ message: 'Profile updated' })
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
          error={handle && !handleValid ? 'That handle is not valid.' : undefined}
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
              placeholder="Slow watcher. Fond of quiet shows."
              onChange={(e) => setBio(e.target.value)}
            />
          )}
        </Field>

        <Field label="Avatar URL">
          {(props) => (
            <Input {...props} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          )}
        </Field>

        <Field label="Banner URL">
          {(props) => (
            <Input {...props} value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} />
          )}
        </Field>

        <Switch
          checked={isPublic}
          onChange={setIsPublic}
          label="Public profile"
          description="Lets anyone with your link see your library, ratings and activity. Private collections stay private either way."
        />
      </div>
    </Dialog>
  )
}
