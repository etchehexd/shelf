import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import { CoverImage, IconButton, toast } from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useAllEntries, useCollections } from '@/data/store/selectors'
import type { Collection, CollectionItem } from '@/data/store/types'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { AddTitlesDialog } from './AddTitlesDialog'

/**
 * The organizing board.
 *
 * Your library on the left, every collection beside it, and covers you can pick
 * up and drop wherever they belong. Dragging out of the library *copies*;
 * dragging from one collection to another *moves*, because that is what the
 * gesture means in every other app that has shelves.
 *
 * It exists because filing was the slowest thing in the product: open a media
 * page, open a menu, tick a box, go back. Here a whole afternoon of tidying is
 * one screen and no navigation at all.
 */

const LIBRARY = 'library'

interface DragPayload {
  mediaId: number
  from: string
}

export function CollectionBoard({ onDone }: { onDone: () => void }) {
  const collections = useCollections()
  const entries = useAllEntries()
  const allItems = useLibrary((s) => s.collectionItems)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)

  const ids = useMemo(() => entries.map((e) => e.mediaId), [entries])
  const { map } = useMediaMap(ids)

  const [dragging, setDragging] = useState<DragPayload | null>(null)

  const sensors = useSensors(
    // Enough travel that a click on a cover still opens the media page.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const byCollection = useMemo(() => {
    const out = new Map<string, CollectionItem[]>()
    for (const item of [...allItems].sort((a, b) => a.position - b.position)) {
      const list = out.get(item.collectionId)
      if (list) list.push(item)
      else out.set(item.collectionId, [item])
    }
    return out
  }, [allItems])

  const library = useMemo(
    () =>
      entries
        .map((e) => map.get(e.mediaId))
        .filter((m): m is MediaSummary => Boolean(m))
        .sort((a, b) => a.id - b.id),
    [entries, map],
  )

  const onDragStart = (event: DragStartEvent) => {
    setDragging((event.active.data.current as DragPayload | undefined) ?? null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)

    const payload = event.active.data.current as DragPayload | undefined
    const target = event.over?.id
    if (!payload || typeof target !== 'string' || target === payload.from) return

    const media = map.get(payload.mediaId)
    if (!media) return

    if (target === LIBRARY) {
      // Dropping back on the library means "take it off that shelf".
      if (payload.from !== LIBRARY) {
        removeFromCollection(payload.from, payload.mediaId)
        toast({ message: 'Removed from the collection' })
      }
      return
    }

    addToCollection(target, media)

    // Library → collection copies. Collection → collection moves.
    if (payload.from !== LIBRARY) removeFromCollection(payload.from, payload.mediaId)

    const name = collections.find((c) => c.id === target)?.name
    toast({ message: name ? `Added to ${name}` : 'Added' })
  }

  const draggedMedia = dragging ? map.get(dragging.mediaId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-ink-2">
            Drag a cover onto a collection. Dropping it back on the left takes it off.
          </p>
          <button type="button" onClick={onDone} className="label-cat label-cat-plain hover:text-ink">
            Done organizing
          </button>
        </div>

        <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-3">
          <Column id={LIBRARY} title="Library" count={library.length} tone="library">
            {library.map((media) => (
              <DraggableCover key={media.id} media={media} from={LIBRARY} />
            ))}
          </Column>

          {collections.map((collection) => (
            <CollectionColumn
              key={collection.id}
              collection={collection}
              items={byCollection.get(collection.id) ?? []}
              map={map}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' }}>
        {draggedMedia && (
          <div className="w-20 rotate-3 opacity-95">
            <CoverImage src={draggedMedia.coverImage} alt="" color={draggedMedia.color} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/* -------------------------------------------------------------------------- */

function CollectionColumn({
  collection,
  items,
  map,
}: {
  collection: Collection
  items: CollectionItem[]
  map: Map<number, MediaSummary>
}) {
  const [adding, setAdding] = useState(false)
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)

  return (
    <>
      <Column
        id={collection.id}
        title={collection.name}
        count={items.length}
        href={`/collections/${collection.id}`}
        onAdd={() => setAdding(true)}
      >
        {items.map((item) => {
          const media = map.get(item.mediaId)
          if (!media) return null
          return (
            <DraggableCover
              key={item.id}
              media={media}
              from={collection.id}
              onRemove={() => removeFromCollection(collection.id, item.mediaId)}
            />
          )
        })}
      </Column>

      <AddTitlesDialog
        collectionId={collection.id}
        collectionName={collection.name}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </>
  )
}

function Column({
  id,
  title,
  count,
  href,
  tone = 'collection',
  onAdd,
  children,
}: {
  id: string
  title: string
  count: number
  href?: string
  tone?: 'library' | 'collection'
  onAdd?: () => void
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-64 shrink-0 snap-start flex-col rounded-lg border transition-colors duration-200',
        tone === 'library' ? 'border-line bg-surface-2/60' : 'border-line bg-surface',
        isOver && 'border-accent bg-accent-quiet/60',
      )}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          {href ? (
            <Link
              to={href}
              className="group flex items-center gap-1.5 truncate text-label font-medium text-ink hover:text-accent"
            >
              <span className="truncate">{title}</span>
              <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ) : (
            <p className="truncate text-label font-medium text-ink">{title}</p>
          )}
          <p className="label-cat label-cat-plain mt-0.5">{pluralize(count, 'title')}</p>
        </div>

        {onAdd && (
          <IconButton
            label={`Add titles to ${title}`}
            icon={<Plus className="size-4" />}
            size="sm"
            onClick={onAdd}
          />
        )}
      </header>

      <div className="grid max-h-[28rem] grid-cols-3 content-start gap-2 overflow-y-auto p-3">
        {count === 0 && (
          <p className="col-span-3 py-8 text-center text-meta text-ink-3">Drop covers here</p>
        )}
        {children}
      </div>
    </section>
  )
}

function DraggableCover({
  media,
  from,
  onRemove,
}: {
  media: MediaSummary
  from: string
  onRemove?: () => void
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${from}:${media.id}`,
    data: { mediaId: media.id, from } satisfies DragPayload,
  })

  return (
    <div className="group/cover relative">
      <button
        ref={setNodeRef}
        type="button"
        title={displayTitle(media, language)}
        aria-label={`Move ${displayTitle(media, language)}`}
        className={cn(
          'block w-full cursor-grab touch-none rounded-[4px] transition-opacity active:cursor-grabbing',
          isDragging && 'opacity-30',
        )}
        {...attributes}
        {...listeners}
      >
        <CoverImage src={media.coverImage} alt="" color={media.color} />
      </button>

      {onRemove && (
        <IconButton
          label="Remove from this collection"
          icon={<X className="size-3" />}
          size="sm"
          variant="secondary"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 size-6 rounded-full opacity-0 shadow-sm transition-opacity group-hover/cover:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  )
}
