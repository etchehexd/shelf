import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Globe,
  GripVertical,
  Layers,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import {
  Button,
  buttonClasses,
  CoverImage,
  CoverSkeleton,
  EmptyState,
  IconButton,
  Input,
  MenuItem,
  MenuLabel,
  Pill,
  Popover,
  Rating,
  RowSkeleton,
  SearchInput,
  toast,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useCollection, useCollectionItems, useCollections } from '@/data/store/selectors'
import { useAuth } from '@/data/supabase/auth'
import { SignInWall } from '@/features/auth/SignInWall'
import type { Collection, CollectionItem } from '@/data/store/types'
import { MediaCard } from '@/features/tracking/cards'
import { cn } from '@/lib/cn'
import { fullDate } from '@/lib/dates'
import { pluralize } from '@/lib/format'
import { AddTitlesDialog } from './AddTitlesDialog'
import { CollectionEditor } from './CollectionEditor'

const PRIVACY_ICON = { private: Lock, unlisted: Link2, public: Globe } as const

const PRIVACY_LABEL = {
  private: 'Just for you',
  unlisted: 'Anyone with the link',
  public: 'Public',
} as const

/**
 * A collection, as an exhibition.
 *
 * Three modes, and only ever one at a time — a page that is simultaneously
 * browsable, draggable and selectable is a page where every click is a coin
 * toss.
 *
 *   browse   read it, open things, write notes
 *   reorder  drag the work into the order you want, in place
 *   select   act on many at once
 *
 * Reordering happens *in the layout you are already looking at* rather than in
 * a stripped-down list beside it. That was the old design and it was the wrong
 * trade: you order a collection by looking at the artwork, so hiding the
 * artwork to reorder it removes the only information you were using.
 */
export default function CollectionDetailPage() {
  const { signedOut } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const collection = useCollection(id)
  const items = useCollectionItems(collection?.id)
  const language = usePrefs((s) => s.titleLanguage)

  const deleteCollection = useLibrary((s) => s.deleteCollection)
  const moveCollectionItem = useLibrary((s) => s.moveCollectionItem)

  const ids = useMemo(() => items.map((i) => i.mediaId), [items])
  const { map } = useMediaMap(ids)

  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'browse' | 'reorder' | 'select'>('browse')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)

  const sensors = useSensors(
    // A small activation distance keeps a click on the card from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const needle = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!needle) return items
    return items.filter((i) => {
      const media = map.get(i.mediaId)
      if (!media) return false
      const { romaji, english, native } = media.title
      return (
        [romaji, english, native].some((t) => t?.toLowerCase().includes(needle)) ||
        i.note?.toLowerCase().includes(needle)
      )
    })
  }, [items, map, needle])

  // Checked before the not-found case: signed out there are no collections at
  // all, so "no such collection" would be technically true and completely
  // misleading — it reads as a broken link rather than as a closed door.
  if (signedOut) {
    return (
      <SignInWall section="Collections" headline="Curation is the point.">
        Collections are something you make and something you share. Both need an account
        behind them — this one may exist, but not for a visitor without one.
      </SignInWall>
    )
  }

  if (!collection) {
    return (
      <EmptyState
        title="No such collection"
        action={
          <Link to="/collections" className={buttonClasses('secondary', 'md')}>
            Back to collections
          </Link>
        }
      />
    )
  }

  const onDragEnd = (event: DragEndEvent) => {
    setDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const to = items.findIndex((i) => i.id === over.id)
    if (to === -1) return

    // One row is written — the midpoint between the new neighbors.
    moveCollectionItem(collection.id, String(active.id), to)
  }

  const share = async () => {
    const url = `${window.location.origin}/collections/${collection.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast({
        message:
          collection.privacy === 'private'
            ? 'Link copied — but this one is private'
            : 'Link copied',
      })
    } catch {
      toast({ message: 'Could not copy the link', tone: 'danger' })
    }
  }

  const covers = items
    .slice(0, 8)
    .map((i) => map.get(i.mediaId))
    .filter(Boolean) as MediaSummary[]

  const setMode2 = (next: typeof mode) => {
    setMode((prev) => (prev === next ? 'browse' : next))
    setPicked(new Set())
    if (next === 'reorder') setQuery('')
  }

  const draggedMedia = dragId ? map.get(items.find((i) => i.id === dragId)?.mediaId ?? -1) : undefined

  // Dragging inside a filtered view would write positions relative to rows that
  // aren't on screen, so the two are mutually exclusive by construction.
  const reordering = mode === 'reorder' && !needle

  return (
    <div className="space-y-10">
      <ExhibitionHeader
        collection={collection}
        covers={covers}
        count={items.length}
        onShare={share}
        onEdit={() => setEditing(true)}
        onDelete={() => {
          deleteCollection(collection.id)
          toast({ message: `${collection.name} deleted` })
          navigate('/collections')
        }}
        onAdd={() => setAdding(true)}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" strokeWidth={1.5} />}
          title="An empty wall"
          description="A collection is an argument you make with other people's work. Put the first piece up and the rest tends to follow."
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              Add titles
            </Button>
          }
        />
      ) : (
        <>
          <Toolbar
            count={items.length}
            shown={visible.length}
            mode={mode}
            query={query}
            onQuery={setQuery}
            onMode={setMode2}
          />

          {visible.length === 0 ? (
            <p className="py-16 text-center text-body text-ink-3">
              Nothing in this collection matches “{query.trim()}”.
            </p>
          ) : reordering ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragId(null)}
              modifiers={
                collection.layout === 'ranked'
                  ? [restrictToVerticalAxis, restrictToParentElement]
                  : undefined
              }
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={
                  collection.layout === 'ranked' ? verticalListSortingStrategy : rectSortingStrategy
                }
              >
                {collection.layout === 'ranked' ? (
                  <ol className="space-y-2">
                    {items.map((item, index) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        index={index}
                        media={map.get(item.mediaId)}
                        language={language}
                      />
                    ))}
                  </ol>
                ) : (
                  <ol className="poster-grid">
                    {items.map((item, index) => (
                      <SortableTile
                        key={item.id}
                        item={item}
                        index={index}
                        media={map.get(item.mediaId)}
                        language={language}
                      />
                    ))}
                  </ol>
                )}
              </SortableContext>

              {/* The thing you picked up, tilted, so it looks picked up.

                  The width is pinned rather than inherited. `DragOverlay`
                  sizes itself to the node being dragged, and in the ranked
                  layout that node is a full-width *row* — so a `w-full` cover
                  with `aspect-[2/3]` resolved to something like 1200×1800 and
                  a poster the size of a billboard swallowed the screen the
                  moment you started dragging. Reordering was impossible
                  because you could no longer see the list you were reordering.

                  A grid tile drags as a poster; a row drags as a row. Matching
                  the shape of the source is also just what a lifted item
                  should look like. */}
              <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' }}>
                {draggedMedia &&
                  (collection.layout === 'ranked' ? (
                    <div className="flex w-72 max-w-[80vw] items-center gap-3 rounded-md border border-line-strong bg-surface p-2 shadow-lg">
                      <span className="w-9 shrink-0">
                        <CoverImage
                          src={draggedMedia.coverImage}
                          alt=""
                          color={draggedMedia.color}
                          flat
                        />
                      </span>
                      <span className="clamp-1 min-w-0 flex-1 text-label font-medium text-ink">
                        {displayTitle(draggedMedia, language)}
                      </span>
                      <GripVertical className="size-4 shrink-0 text-ink-3" aria-hidden />
                    </div>
                  ) : (
                    <div className="w-32 rotate-2 opacity-95 shadow-lg">
                      <CoverImage src={draggedMedia.coverImage} alt="" color={draggedMedia.color} />
                    </div>
                  ))}
              </DragOverlay>
            </DndContext>
          ) : collection.layout === 'showcase' ? (
            <ShowcaseLayout
              items={visible}
              map={map}
              collectionId={collection.id}
              selecting={mode === 'select'}
              picked={picked}
              onPick={setPicked}
            />
          ) : collection.layout === 'ranked' ? (
            <RankedLayout
              items={visible}
              map={map}
              collectionId={collection.id}
              selecting={mode === 'select'}
              picked={picked}
              onPick={setPicked}
            />
          ) : (
            <GridLayout
              items={visible}
              map={map}
              collectionId={collection.id}
              selecting={mode === 'select'}
              picked={picked}
              onPick={setPicked}
            />
          )}
        </>
      )}

      {mode === 'select' && picked.size > 0 && (
        <SelectionBar
          collection={collection}
          items={items}
          picked={picked}
          onClear={() => setPicked(new Set())}
          onDone={() => {
            setPicked(new Set())
            setMode('browse')
          }}
        />
      )}

      <CollectionEditor collection={collection} open={editing} onClose={() => setEditing(false)} />
      <AddTitlesDialog
        collectionId={collection.id}
        collectionName={collection.name}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The exhibition header.
 *
 * Full-bleed out of the page gutter, with the collection's own covers cropped
 * into a strip behind the title. A collection should announce itself the way a
 * gallery announces a show — the name large, the reason underneath, and the
 * work itself already visible before you scroll.
 */
function ExhibitionHeader({
  collection,
  covers,
  count,
  onShare,
  onEdit,
  onDelete,
  onAdd,
}: {
  collection: Collection
  covers: MediaSummary[]
  count: number
  onShare: () => void
  onEdit: () => void
  onDelete: () => void
  onAdd: () => void
}) {
  const PrivacyIcon = PRIVACY_ICON[collection.privacy]

  return (
    <header className="bleed-x -mt-6 overflow-hidden">
      <div className="relative">
        {/* The room's light.
            This used to be eight covers stretched edge to edge behind a scrim —
            a flat band of cropped rectangles that read as a broken image strip
            and, at that aspect ratio, was visibly soft. A blurred wash of the
            first piece does the actual job the strip was there for (take the
            page's color from the work) at zero legibility cost, and the fan
            below shows the covers *sharp*, at a size the artwork can support. */}
        <div className="absolute inset-0" aria-hidden>
          {covers[0]?.coverImage && (
            <img src={covers[0].coverImage} alt="" className="art-wash size-full object-cover" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgb(var(--scrim) / 0.62) 0%, rgb(var(--scrim) / 0.88) 55%, rgb(var(--scrim) / 1) 100%)',
            }}
          />
        </div>

        {/* The fan: the first few pieces, overlapping, leaning off the right
            edge. Deliberately clipped by the header — a wall of art continues
            past the frame, and a row that stops politely inside the margin
            reads as a widget. */}
        {/* No cover fan. It was centered and collided with the buttons; moved
            to the corner it became a smudge. A collection header does not need
            an ornament — it already has the wash behind it and five covers
            twelve pixels below it. */}
        <div className="relative mx-auto w-full max-w-(--container-page) px-5 pt-6 pb-9 md:px-10 md:pb-12">
          <Link
            to="/collections"
            className="label-cat label-cat-plain mb-8 inline-flex items-center gap-2 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            All collections
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
            <div className="min-w-0 max-w-2xl">
              <h1 className="text-balance text-display-lg text-ink md:text-display-xl">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="prose-width mt-4 text-body text-ink-2">{collection.description}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-mono-num text-title font-semibold text-ink">{count}</span>
                <span className="label-cat label-cat-plain">
                  {count === 1 ? 'title' : 'titles'}
                </span>
                <span className="size-1 rounded-full bg-ink-3" aria-hidden />
                <span className="label-cat label-cat-plain flex items-center gap-1.5">
                  <PrivacyIcon className="size-3" aria-hidden />
                  {PRIVACY_LABEL[collection.privacy]}
                </span>
                <span className="size-1 rounded-full bg-ink-3" aria-hidden />
                <span className="label-cat label-cat-plain">
                  since {fullDate(collection.createdAt)}
                </span>
                {collection.tags.map((tag) => (
                  <Pill key={tag} size="sm">
                    {tag}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="relative z-10 flex shrink-0 flex-wrap gap-2">
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={onAdd}>
                Add titles
              </Button>
              <Button icon={<Share2 className="size-4" />} onClick={onShare}>
                Share
              </Button>
              <Button icon={<Pencil className="size-4" />} onClick={onEdit}>
                Edit
              </Button>

              {/* Delete moves into a menu behind the three dots.
                  A bare red trash can sitting at the end of a row of labelled
                  buttons read as detached — visually it belonged to nothing,
                  and it put the one irreversible action on this page at the
                  same click cost as "Share". Behind a menu it is still two
                  clicks away and no longer part of the primary rhythm. */}
              <Popover
                align="end"
                role="menu"
                label="More"
                className="w-52"
                trigger={
                  <IconButton label="More actions" icon={<MoreHorizontal className="size-4" />} />
                }
              >
                {({ close }) => (
                  <MenuItem
                    danger
                    icon={<Trash2 className="size-4" />}
                    onSelect={() => {
                      close()
                      onDelete()
                    }}
                  >
                    Delete collection
                  </MenuItem>
                )}
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The management strip.
 *
 * Search only appears once a collection is big enough to need it — a filter box
 * over six covers is furniture, not a tool.
 */
function Toolbar({
  count,
  shown,
  mode,
  query,
  onQuery,
  onMode,
}: {
  count: number
  shown: number
  mode: 'browse' | 'reorder' | 'select'
  query: string
  onQuery: (value: string) => void
  onMode: (mode: 'reorder' | 'select') => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {count > 8 && (
        <SearchInput
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find in this collection"
          aria-label="Find in this collection"
          className="min-w-0 flex-1 sm:max-w-xs"
          disabled={mode === 'reorder'}
        />
      )}

      <span className="label-cat label-cat-plain">
        {shown === count ? pluralize(count, 'title') : `${shown} of ${count}`}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {count > 1 && (
          <Button
            icon={<GripVertical className="size-4" />}
            aria-pressed={mode === 'reorder'}
            variant={mode === 'reorder' ? 'primary' : 'secondary'}
            onClick={() => onMode('reorder')}
          >
            {mode === 'reorder' ? 'Done' : 'Reorder'}
          </Button>
        )}
        <Button
          icon={<CheckSquare className="size-4" />}
          aria-pressed={mode === 'select'}
          variant={mode === 'select' ? 'primary' : 'secondary'}
          onClick={() => onMode('select')}
        >
          {mode === 'select' ? 'Done' : 'Select'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Acting on many at once.
 *
 * Pinned to the bottom of the viewport rather than at the end of the page: a
 * bulk action is something you reach for *while* looking at what you picked,
 * and a collection of two hundred titles is a long way back to a toolbar.
 */
function SelectionBar({
  collection,
  items,
  picked,
  onClear,
  onDone,
}: {
  collection: Collection
  items: CollectionItem[]
  picked: Set<string>
  onClear: () => void
  onDone: () => void
}) {
  const collections = useCollections()
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const addToCollection = useLibrary((s) => s.addToCollection)

  const chosen = items.filter((i) => picked.has(i.id))
  const others = collections.filter((c) => c.id !== collection.id)

  const copyTo = (targetId: string, move: boolean) => {
    for (const item of chosen) {
      addToCollection(targetId, { id: item.mediaId, kind: item.kind })
      if (move) removeFromCollection(collection.id, item.mediaId)
    }
    const name = collections.find((c) => c.id === targetId)?.name ?? 'the collection'
    toast({ message: `${pluralize(chosen.length, 'title')} ${move ? 'moved' : 'copied'} to ${name}` })
    onDone()
  }

  const removeAll = () => {
    const snapshot = chosen.map((i) => ({ id: i.mediaId, kind: i.kind }))
    for (const item of chosen) removeFromCollection(collection.id, item.mediaId)
    toast({
      message: `${pluralize(chosen.length, 'title')} removed`,
      action: {
        label: 'Undo',
        onClick: () => snapshot.forEach((m) => addToCollection(collection.id, m)),
      },
    })
    onDone()
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-6 md:pb-8">
      <div
        className={cn(
          'pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-line',
          'bg-surface/95 px-3 py-2 shadow-lg backdrop-blur-xl',
          'motion-safe:animate-[rise-in_260ms_var(--ease-out-expo)]',
        )}
      >
        <span className="font-mono-num px-2 text-label font-semibold text-ink">
          {picked.size} selected
        </span>

        {others.length > 0 && (
          <Popover
            side="top"
            align="center"
            role="menu"
            label="Move or copy"
            className="max-h-72 w-60 overflow-y-auto"
            trigger={
              <Button size="sm" icon={<Layers className="size-4" />}>
                Move to
              </Button>
            }
          >
            {({ close }) => (
              <>
                <MenuLabel>Move to</MenuLabel>
                {others.map((c) => (
                  <MenuItem
                    key={c.id}
                    onSelect={() => {
                      copyTo(c.id, true)
                      close()
                    }}
                  >
                    {c.name}
                  </MenuItem>
                ))}
                <MenuLabel>Copy to</MenuLabel>
                {others.map((c) => (
                  <MenuItem
                    key={`copy-${c.id}`}
                    onSelect={() => {
                      copyTo(c.id, false)
                      close()
                    }}
                  >
                    {c.name}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
        )}

        <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={removeAll}>
          Remove
        </Button>

        <IconButton label="Clear selection" icon={<X className="size-4" />} size="sm" onClick={onClear} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ layouts */

interface LayoutProps {
  items: CollectionItem[]
  map: Map<number, MediaSummary>
  collectionId: string
  selecting: boolean
  picked: Set<string>
  onPick: (next: Set<string>) => void
}

function useToggle(picked: Set<string>, onPick: (next: Set<string>) => void) {
  return (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onPick(next)
  }
}

function GridLayout({ items, map, collectionId, selecting, picked, onPick }: LayoutProps) {
  const toggle = useToggle(picked, onPick)

  return (
    <div className="grid-stagger poster-grid">
      {items.map((item, i) => {
        const media = map.get(item.mediaId)
        // A row whose artwork has not landed yet is still a row.
        //
        // Returning null here is why a collection could say "5 titles" and
        // render four: the count comes from the stored items, the render came
        // from whichever of them the media batch had resolved, and the two
        // disagreed for as long as a request was in flight — or forever, if
        // upstream no longer knows that id. A placeholder keeps the two
        // numbers honest and makes a genuinely missing title visible instead
        // of silently deleting it from view.
        if (!media) return <CoverSkeleton key={item.id} />
        return (
          <div key={item.id} className="group/item relative">
            <MediaCard media={media} showCommunity={false} index={i} />
            {selecting ? (
              <SelectOverlay checked={picked.has(item.id)} onToggle={() => toggle(item.id)} />
            ) : (
              <RemoveButton collectionId={collectionId} mediaId={item.mediaId} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Ranked. The numeral is the point, so it is set enormous and sits *behind*
 * the cover rather than beside it — the poster is the exhibit, the number is
 * the plaque on the wall.
 */
function RankedLayout({ items, map, collectionId, selecting, picked, onPick }: LayoutProps) {
  const language = usePrefs((s) => s.titleLanguage)
  const entries = useLibrary((s) => s.entries)
  const toggle = useToggle(picked, onPick)

  return (
    <ol className="space-y-4">
      {items.map((item, index) => {
        const media = map.get(item.mediaId)
        if (!media) return <RowSkeleton key={item.id} />
        const entry = entries[item.mediaId]

        return (
          <li key={item.id} className="group/item relative">
            <div
              className={cn(
                'frame-lift flex items-center gap-5 overflow-hidden rounded-lg border border-line bg-surface p-4 pr-5',
                'transition-colors duration-300 hover:border-line-strong',
                selecting && picked.has(item.id) && 'border-accent bg-accent-quiet/50',
              )}
              onClick={selecting ? () => toggle(item.id) : undefined}
            >
              {selecting && (
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
                    picked.has(item.id) ? 'border-accent bg-accent' : 'border-line-strong',
                  )}
                  aria-hidden
                >
                  {picked.has(item.id) && (
                    <Check className="size-3.5 text-accent-ink" strokeWidth={3} />
                  )}
                </span>
              )}

              <span
                className={cn(
                  'font-mono-num w-14 shrink-0 text-right leading-[0.8] font-semibold tabular-nums select-none',
                  'text-ink-3/30 transition-colors duration-500 group-hover/item:text-accent',
                  index < 3 ? 'text-[2.75rem]' : 'text-[2rem]',
                )}
                aria-hidden
              >
                {index + 1}
              </span>

              <Link to={`/media/${media.id}`} className="w-14 shrink-0">
                <CoverImage src={media.coverImage} alt="" color={media.color} />
              </Link>

              <div className="min-w-0 flex-1">
                <Link to={`/media/${media.id}`}>
                  <p className="truncate text-title font-semibold text-ink">
                    {displayTitle(media, language)}
                  </p>
                </Link>
                <p className="label-cat label-cat-plain mt-1.5">
                  {[media.seasonYear, media.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </p>
                <ItemNote item={item} />
              </div>

              {/* No community score on a collection. A collection is an
                  argument you are making; the crowd's number is not part of
                  it, and next to your own stars it just makes you defend a
                  choice you already made. */}
              <Rating
                value={entry?.score ?? null}
                size="sm"
                className="hidden shrink-0 sm:inline-flex"
              />
              {!selecting && (
                <RemoveButton collectionId={collectionId} mediaId={item.mediaId} inline />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Showcase alternates sides so a long collection reads like a magazine spread
 * rather than a list, and gives each note room to be a pull-quote.
 */
function ShowcaseLayout({ items, map, collectionId, selecting, picked, onPick }: LayoutProps) {
  const language = usePrefs((s) => s.titleLanguage)
  const entries = useLibrary((s) => s.entries)
  const toggle = useToggle(picked, onPick)

  return (
    <div className="space-y-16 md:space-y-20">
      {items.map((item, index) => {
        const media = map.get(item.mediaId)
        if (!media) return <RowSkeleton key={item.id} />
        const entry = entries[item.mediaId]
        const flip = index % 2 === 1

        return (
          <article
            key={item.id}
            className={cn(
              'group/item relative grid items-center gap-6 sm:gap-10 md:grid-cols-[240px_1fr]',
              flip && 'md:grid-cols-[1fr_240px]',
            )}
          >
            <Link
              to={`/media/${media.id}`}
              className={cn('frame-lift relative w-32 sm:w-full', flip && 'md:order-2')}
            >
              <CoverImage src={media.coverImageLarge} alt="" color={media.color} />
            </Link>

            <div className={cn('min-w-0', flip && 'md:order-1 md:text-right')}>
              <div className={cn('flex items-center gap-3', flip && 'md:justify-end')}>
                <span className="font-mono-num text-display-sm leading-none font-semibold text-ink-3/40">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="label-cat label-cat-plain">
                  {[media.seasonYear, media.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </span>
              </div>

              <Link to={`/media/${media.id}`}>
                <h2 className="mt-3 text-balance text-display-md text-ink transition-colors group-hover/item:text-accent">
                  {displayTitle(media, language)}
                </h2>
              </Link>

              {entry?.score != null && (
                <div className={cn('mt-3 flex items-center gap-3', flip && 'md:justify-end')}>
                  <Rating value={entry.score} size="md" showValue />
                </div>
              )}

              <ItemNote item={item} large flip={flip} />
            </div>

            {selecting ? (
              <SelectOverlay checked={picked.has(item.id)} onToggle={() => toggle(item.id)} />
            ) : (
              <RemoveButton collectionId={collectionId} mediaId={item.mediaId} />
            )}
          </article>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** A full-tile checkbox. Covers the artwork so the whole cover is the hit area. */
function SelectOverlay({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Deselect' : 'Select'}
      onClick={onToggle}
      className={cn(
        'absolute inset-0 z-20 flex items-start justify-end rounded-art p-2 transition-colors duration-200',
        checked ? 'bg-accent/22' : 'bg-transparent hover:bg-canvas/25',
      )}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full border shadow-sm transition-colors duration-150',
          checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-canvas/90',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  )
}

/** An inline, optional one-liner. Editing is click-to-type, never a modal. */
function ItemNote({
  item,
  large,
  flip,
}: {
  item: CollectionItem
  large?: boolean
  flip?: boolean
}) {
  const setItemNote = useLibrary((s) => s.setItemNote)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? '')

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        maxLength={280}
        placeholder="Add a note"
        aria-label="Note"
        className="mt-2"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setItemNote(item.id, draft.trim() || null)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setItemNote(item.id, draft.trim() || null)
            setEditing(false)
          }
          if (e.key === 'Escape') {
            setDraft(item.note ?? '')
            setEditing(false)
          }
        }}
      />
    )
  }

  if (!item.note) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="label-cat label-cat-plain mt-3 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-ink focus:opacity-100"
      >
        + Add a note
      </button>
    )
  }

  if (!large) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 block max-w-prose text-left text-meta text-ink-2 hover:text-ink"
      >
        {item.note}
      </button>
    )
  }

  // The pull-quote: a rule on the leading edge, the note set as a statement.
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'mt-5 block max-w-prose text-display-sm leading-snug font-normal text-ink-2 hover:text-ink',
        flip
          ? 'md:ml-auto md:border-r-2 md:border-accent md:pr-5 md:text-right'
          : 'border-l-2 border-accent pl-5 text-left',
      )}
    >
      {item.note}
    </button>
  )
}

function RemoveButton({
  collectionId,
  mediaId,
  inline,
}: {
  collectionId: string
  mediaId: number
  inline?: boolean
}) {
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const entries = useLibrary((s) => s.entries)

  return (
    <IconButton
      label="Remove from collection"
      icon={<X className="size-4" />}
      size="sm"
      variant="secondary"
      onClick={() => {
        const entry = entries[mediaId]
        removeFromCollection(collectionId, mediaId)
        toast({
          message: 'Removed from the collection',
          action: entry
            ? {
                label: 'Undo',
                onClick: () => addToCollection(collectionId, { id: mediaId, kind: entry.kind }),
              }
            : undefined,
        })
      }}
      className={cn(
        'opacity-0 transition-opacity group-hover/item:opacity-100 focus:opacity-100',
        inline ? 'shrink-0' : 'absolute top-2 right-2 z-10 shadow-sm',
      )}
    />
  )
}

/* ----------------------------------------------------------- sortable bits -- */

/**
 * A poster you can pick up.
 *
 * The whole tile is the handle — a 12px grip dot on a 164px cover would be a
 * dexterity test — and the grip badge in the corner is signage rather than the
 * target. Cursor and a lifted shadow do the rest of the explaining.
 */
function SortableTile({
  item,
  index,
  media,
  language,
}: {
  item: CollectionItem
  index: number
  media: MediaSummary | undefined
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  // Reordering is the one place a placeholder would be worse: you cannot
  // meaningfully drag a row you cannot see, and a gap in the sortable list
  // would let a drop land on an index that does not correspond to what is on
  // screen. Skipped here and only here.
  if (!media) return null

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative touch-none', isDragging && 'z-10 opacity-30')}
      {...attributes}
      {...listeners}
    >
      <div className="frame cursor-grab active:cursor-grabbing">
        <CoverImage src={media.coverImage} alt="" color={media.color} flat />
      </div>

      <span
        className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-canvas/90 text-ink-3 shadow-sm backdrop-blur-md"
        aria-hidden
      >
        <GripVertical className="size-3.5" />
      </span>

      <span className="font-mono-num absolute top-1.5 left-1.5 rounded-[5px] bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold text-accent-ink">
        {index + 1}
      </span>

      <p className="clamp-2 mt-2 text-meta leading-snug text-ink-2">
        {displayTitle(media, language)}
      </p>
    </li>
  )
}

function SortableRow({
  item,
  index,
  media,
  language,
}: {
  item: CollectionItem
  index: number
  media: MediaSummary | undefined
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-4 rounded-md border border-line bg-surface p-3',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-sm p-1 text-ink-3 hover:text-ink active:cursor-grabbing"
        aria-label={`Reorder ${media ? displayTitle(media, language) : 'item'}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span className="font-mono-num w-6 shrink-0 text-right text-label text-ink-3">
        {index + 1}
      </span>

      {media && (
        <div className="w-9 shrink-0">
          <CoverImage src={media.coverImage} alt="" color={media.color} flat />
        </div>
      )}

      <span className="min-w-0 flex-1 truncate text-label text-ink">
        {media ? displayTitle(media, language) : '…'}
      </span>
    </li>
  )
}
