import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Globe, GripVertical, Link2, Lock, Pencil, Share2, Trash2, X } from 'lucide-react'
import {
  Button,
  Card,
  CoverImage,
  EmptyState,
  IconButton,
  Input,
  Pill,
  Stars,
  toast,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useCollection, useCollectionItems } from '@/data/store/selectors'
import type { CollectionItem } from '@/data/store/types'
import { MediaCard } from '@/features/tracking/cards'
import { cn } from '@/lib/cn'
import { fullDate } from '@/lib/dates'
import { pluralize } from '@/lib/format'
import { CollectionEditor } from './CollectionEditor'

const PRIVACY_ICON = { private: Lock, unlisted: Link2, public: Globe } as const

export default function CollectionDetailPage() {
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
  const [reordering, setReordering] = useState(false)

  const sensors = useSensors(
    // A small activation distance keeps a click on the card from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!collection) {
    return (
      <EmptyState
        title="Collection not found"
        description="It may have been deleted."
        action={
          <Link to="/collections" className="text-label text-accent hover:underline">
            Back to collections
          </Link>
        }
      />
    )
  }

  const PrivacyIcon = PRIVACY_ICON[collection.privacy]

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from === -1 || to === -1) return

    // One row is written — the midpoint between the new neighbours.
    moveCollectionItem(collection.id, String(active.id), to)
  }

  const share = async () => {
    const url = `${window.location.origin}/collections/${collection.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast({
        message:
          collection.privacy === 'private'
            ? 'Link copied — but this collection is private'
            : 'Link copied',
      })
    } catch {
      toast({ message: 'Could not copy the link', tone: 'danger' })
    }
  }

  return (
    <div className="space-y-10">
      <header className="space-y-5 pt-2">
        <Link to="/collections" className="text-meta text-ink-3 hover:text-ink">
          ← Collections
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-display text-display-lg text-balance text-ink">{collection.name}</h1>
            {collection.description && (
              <p className="mt-3 prose-width text-body text-ink-2">{collection.description}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Pill dot tone={collection.privacy === 'public' ? 'current' : 'neutral'} size="sm">
                <PrivacyIcon className="size-3" aria-hidden />
                {collection.privacy === 'unlisted'
                  ? 'Anyone with the link'
                  : collection.privacy === 'public'
                    ? 'Public'
                    : 'Private'}
              </Pill>
              <span className="tnum text-meta text-ink-3">{pluralize(items.length, 'title')}</span>
              <span className="text-meta text-ink-3">· created {fullDate(collection.createdAt)}</span>
              {collection.tags.map((tag) => (
                <Pill key={tag} size="sm">
                  {tag}
                </Pill>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {items.length > 1 && (
              <Button
                icon={<GripVertical className="size-4" />}
                onClick={() => setReordering((v) => !v)}
                aria-pressed={reordering}
              >
                {reordering ? 'Done' : 'Reorder'}
              </Button>
            )}
            <Button icon={<Share2 className="size-4" />} onClick={share}>
              Share
            </Button>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <IconButton
              label="Delete collection"
              icon={<Trash2 className="size-4" />}
              variant="danger"
              onClick={() => {
                deleteCollection(collection.id)
                toast({ message: `${collection.name} deleted` })
                navigate('/collections')
              }}
            />
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Add titles from any media page — the collection button is right under the cover."
          action={
            <Link
              to="/library"
              className="inline-flex h-9.5 items-center rounded-md bg-accent px-4 text-label font-medium text-accent-ink hover:bg-accent-hover"
            >
              Browse your library
            </Link>
          }
        />
      ) : reordering ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
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
          </SortableContext>
        </DndContext>
      ) : collection.layout === 'showcase' ? (
        <ShowcaseLayout items={items} map={map} collectionId={collection.id} />
      ) : collection.layout === 'ranked' ? (
        <RankedLayout items={items} map={map} collectionId={collection.id} />
      ) : (
        <GridLayout items={items} map={map} collectionId={collection.id} />
      )}

      <CollectionEditor collection={collection} open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ layouts */

function GridLayout({
  items,
  map,
  collectionId,
}: {
  items: CollectionItem[]
  map: Map<number, MediaSummary>
  collectionId: string
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
      {items.map((item) => {
        const media = map.get(item.mediaId)
        if (!media) return null
        return (
          <div key={item.id} className="group/item relative">
            <MediaCard media={media} />
            <RemoveButton collectionId={collectionId} mediaId={item.mediaId} />
          </div>
        )
      })}
    </div>
  )
}

function RankedLayout({
  items,
  map,
  collectionId,
}: {
  items: CollectionItem[]
  map: Map<number, MediaSummary>
  collectionId: string
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const entries = useLibrary((s) => s.entries)

  return (
    <ol className="space-y-3">
      {items.map((item, index) => {
        const media = map.get(item.mediaId)
        if (!media) return null
        const entry = entries[item.mediaId]

        return (
          <li key={item.id} className="group/item relative">
            <Card padding="none" interactive className="flex items-center gap-5 p-4">
              {/* The numeral is the point of this layout, so it gets display type. */}
              <span className="tnum w-12 shrink-0 text-right font-display text-display-md leading-none text-ink-3">
                {index + 1}
              </span>

              <Link to={`/media/${media.id}`} className="w-14 shrink-0">
                <CoverImage src={media.coverImage} alt="" color={media.color} rounded="sm" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link to={`/media/${media.id}`}>
                  <p className="truncate text-title font-medium text-ink">
                    {displayTitle(media, language)}
                  </p>
                </Link>
                <p className="tnum mt-0.5 text-meta text-ink-3">
                  {[media.seasonYear, media.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </p>
                <ItemNote item={item} />
              </div>

              <Stars value={entry?.score ?? null} size="sm" className="hidden shrink-0 sm:flex" />
              <RemoveButton collectionId={collectionId} mediaId={item.mediaId} inline />
            </Card>
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
function ShowcaseLayout({
  items,
  map,
  collectionId,
}: {
  items: CollectionItem[]
  map: Map<number, MediaSummary>
  collectionId: string
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const entries = useLibrary((s) => s.entries)

  return (
    <div className="space-y-14">
      {items.map((item, index) => {
        const media = map.get(item.mediaId)
        if (!media) return null
        const entry = entries[item.mediaId]
        const flip = index % 2 === 1

        return (
          <article
            key={item.id}
            className={cn(
              'group/item relative grid items-center gap-6 sm:gap-10 md:grid-cols-[220px_1fr]',
              flip && 'md:grid-cols-[1fr_220px]',
            )}
          >
            <Link
              to={`/media/${media.id}`}
              className={cn('w-32 sm:w-full', flip && 'md:order-2')}
            >
              <div className="overflow-hidden rounded-lg shadow-md transition-transform duration-300 hover:-translate-y-1">
                <CoverImage src={media.coverImageLarge} alt="" color={media.color} rounded="lg" />
              </div>
            </Link>

            <div className={cn('min-w-0', flip && 'md:order-1 md:text-right')}>
              <p className="text-micro text-ink-3 uppercase">
                {[media.seasonYear, media.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
              </p>
              <Link to={`/media/${media.id}`}>
                <h2 className="mt-2 font-display text-display-md text-balance text-ink">
                  {displayTitle(media, language)}
                </h2>
              </Link>

              <div className={cn('mt-3 flex items-center gap-3', flip && 'md:justify-end')}>
                <Stars value={entry?.score ?? null} size="md" showValue />
              </div>

              <ItemNote item={item} large />
            </div>

            <RemoveButton collectionId={collectionId} mediaId={item.mediaId} />
          </article>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** An inline, optional one-liner. Editing is click-to-type, never a modal. */
function ItemNote({ item, large }: { item: CollectionItem; large?: boolean }) {
  const setItemNote = useLibrary((s) => s.setItemNote)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? '')

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        maxLength={280}
        placeholder="Why this one?"
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
        className="mt-2 text-meta text-ink-3 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-ink-2 focus:opacity-100"
      >
        + Add a note
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'mt-3 block max-w-prose text-left text-ink-2 hover:text-ink',
        large ? 'font-display text-display-sm leading-snug' : 'text-meta',
      )}
    >
      {large ? `“${item.note}”` : item.note}
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
          message: 'Removed from collection',
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

/* -------------------------------------------------------------------------- */

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

      <span className="tnum w-6 shrink-0 text-right text-label text-ink-3">{index + 1}</span>

      {media && (
        <div className="w-9 shrink-0">
          <CoverImage src={media.coverImage} alt="" color={media.color} rounded="sm" />
        </div>
      )}

      <span className="min-w-0 flex-1 truncate text-label text-ink">
        {media ? displayTitle(media, language) : '…'}
      </span>
    </li>
  )
}
