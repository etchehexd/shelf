import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Globe, Link2, Lock, Plus, Sparkles } from 'lucide-react'
import { Button, CoverImage, EmptyState, Pill } from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { useCollections, useTrackedIds } from '@/data/store/selectors'
import { useLibrary } from '@/data/store/library'
import type { Collection } from '@/data/store/types'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { CollectionEditor } from './CollectionEditor'

const PRIVACY_ICON = { private: Lock, unlisted: Link2, public: Globe } as const

export default function CollectionsPage() {
  const collections = useCollections()
  const [editing, setEditing] = useState(false)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-display-lg text-ink">Collections</h1>
          <p className="mt-1 max-w-prose text-body text-ink-3">
            Not folders. The shelves you'd actually point at when someone asks what you like.
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(true)}>
          New collection
        </Button>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-7" strokeWidth={1.5} />}
          title="No collections yet"
          description="Comfort shows. Best soundtracks. Your personal top 100. Start with whatever you'd defend in an argument."
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(true)}>
              Create your first
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}

          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              'flex min-h-[248px] flex-col items-center justify-center gap-3 rounded-lg',
              'border border-dashed border-line text-ink-3 transition-colors',
              'hover:border-line-strong hover:text-ink-2',
            )}
          >
            <Plus className="size-6" strokeWidth={1.5} aria-hidden />
            <span className="text-label font-medium">New collection</span>
          </button>
        </div>
      )}

      <CollectionEditor open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function CollectionCard({ collection }: { collection: Collection }) {
  // Select the raw array and narrow in useMemo. Filtering inside the selector
  // returns a new array every render, which useSyncExternalStore treats as a
  // changed snapshot — an infinite render loop, not just wasted work.
  const allItems = useLibrary((s) => s.collectionItems)
  const trackedIds = useTrackedIds()
  const { map } = useMediaMap(trackedIds)

  const items = useMemo(
    () => allItems.filter((i) => i.collectionId === collection.id),
    [allItems, collection.id],
  )

  const covers = useMemo(
    () =>
      items
        .slice()
        .sort((a, b) => a.position - b.position)
        .slice(0, 4)
        .map((i) => map.get(i.mediaId))
        .filter(Boolean),
    [items, map],
  )

  const PrivacyIcon = PRIVACY_ICON[collection.privacy]

  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-[transform,box-shadow,border-color] duration-[110ms] hover:-translate-y-[3px] hover:border-line-strong hover:shadow-sm"
    >
      {/* Fanned mosaic: the collection's own art is its cover. */}
      <div className="relative h-40 overflow-hidden bg-surface-2 px-6 pt-6">
        {covers.length === 0 ? (
          <div className="flex h-full items-center justify-center text-meta text-ink-3">Empty</div>
        ) : (
          <div className="flex h-full items-end justify-center">
            {covers.map((media, i) => (
              <div
                key={media!.id}
                className="w-[76px] shrink-0 transition-transform duration-300 ease-out group-hover:translate-y-[-4px]"
                style={{
                  marginLeft: i === 0 ? 0 : -26,
                  zIndex: covers.length - i,
                  transform: `rotate(${(i - (covers.length - 1) / 2) * 4}deg)`,
                  transitionDelay: `${i * 24}ms`,
                }}
              >
                <div className="overflow-hidden rounded-t-md shadow-md">
                  <CoverImage src={media!.coverImage} alt="" color={media!.color} rounded="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-display-sm leading-tight text-ink">{collection.name}</h2>
          <PrivacyIcon className="mt-1 size-3.5 shrink-0 text-ink-3" aria-label={collection.privacy} />
        </div>

        {collection.description && (
          <p className="clamp-2 text-meta text-ink-2">{collection.description}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <span className="tnum text-meta text-ink-3">{pluralize(items.length, 'title')}</span>
          {collection.tags.slice(0, 2).map((tag) => (
            <Pill key={tag} size="sm">
              {tag}
            </Pill>
          ))}
        </div>
      </div>
    </Link>
  )
}
