import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Layers, Plus } from 'lucide-react'
import { Button, CoverImage, Dialog, Input, SearchInput, toast } from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { useCollections, useCollectionsContaining } from '@/data/store/selectors'
import type { Collection } from '@/data/store/types'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'

/**
 * Filing one title, properly.
 *
 * This is the full-weight counterpart to the poster's quick-add popover: it is
 * what "Add to Collection" opens from a media page, where you have already
 * committed to one title and the question is which shelves it belongs on —
 * often several, sometimes one that doesn't exist yet.
 *
 * Three things it has to do without ever closing:
 *
 *  - search, because a person with forty collections cannot scan forty rows
 *  - multi-select, because a title belongs to shelves in the plural
 *  - create, because "the shelf I want doesn't exist" is the single most common
 *    reason filing gets abandoned, and sending someone to another screen to fix
 *    that loses both the collection and the title
 *
 * Every toggle applies immediately — the store is local-first, so there is no
 * pending state to design around and no Save button to forget to press. The
 * footer says Done because that is all it does.
 */
export function AddToCollectionDialog({
  media,
  open,
  onClose,
}: {
  media: MediaSummary
  open: boolean
  onClose: () => void
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const collections = useCollections()
  const containing = useCollectionsContaining(media.id)
  const items = useLibrary((s) => s.collectionItems)

  const addToCollection = useLibrary((s) => s.addToCollection)
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const createCollection = useLibrary((s) => s.createCollection)
  const { canWrite } = useAuth()

  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const createRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCreating(false)
    }
  }, [open])

  useEffect(() => {
    if (creating) createRef.current?.focus()
  }, [creating])

  const inSet = useMemo(() => new Set(containing.map((c) => c.id)), [containing])

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.tags.some((t) => t.toLowerCase().includes(needle)),
      )
    : collections
  const exact = collections.some((c) => c.name.toLowerCase() === needle)

  // Covers for each row's thumbnail, resolved in one batch.
  const previewIds = useMemo(() => {
    const out: number[] = []
    for (const c of collections) {
      const first = items
        .filter((i) => i.collectionId === c.id)
        .sort((a, b) => a.position - b.position)
        .slice(0, 3)
      out.push(...first.map((i) => i.mediaId))
    }
    return [...new Set(out)]
  }, [collections, items])

  const { map } = useMediaMap(previewIds)

  const create = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !canWrite) return
    const id = createCollection({ name: trimmed })
    addToCollection(id, media)
    toast({ message: `${trimmed} started` })
    setQuery('')
    setCreating(false)
  }

  const title = displayTitle(media, language)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add to collection"
      size="md"
      footer={
        <>
          <span className="mr-auto font-mono-num text-meta text-ink-3">
            {inSet.size > 0 ? `On ${pluralize(inSet.size, 'shelf', 'shelves')}` : 'Not filed yet'}
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {/* What you are filing, so the dialog is never ambiguous when it was
          opened from a list of twelve identical buttons. */}
      <div className="mb-5 flex items-center gap-3.5 rounded-md border border-line bg-surface-2/60 p-3">
        <span className="w-10 shrink-0">
          <CoverImage src={media.coverImage} alt="" color={media.color} flat />
        </span>
        <span className="min-w-0">
          <span className="clamp-1 block text-label font-medium text-ink">{title}</span>
          <span className="label-cat label-cat-plain mt-1 block">
            {[media.seasonYear, media.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>

      {collections.length > 3 && (
        <SearchInput
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const first = matches[0]
            if (first && !inSet.has(first.id)) addToCollection(first.id, media)
            else if (needle && !exact) create(query)
          }}
          placeholder="Search your collections"
          aria-label="Search your collections"
          className="mb-3"
        />
      )}

      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
        {matches.map((c) => (
          <CollectionRow
            key={c.id}
            collection={c}
            checked={inSet.has(c.id)}
            covers={items
              .filter((i) => i.collectionId === c.id)
              .sort((a, b) => a.position - b.position)
              .slice(0, 3)
              .map((i) => map.get(i.mediaId))
              .filter(Boolean) as MediaSummary[]}
            count={items.filter((i) => i.collectionId === c.id).length}
            onToggle={() => {
              if (!canWrite) return
              if (inSet.has(c.id)) removeFromCollection(c.id, media.id)
              else addToCollection(c.id, media)
            }}
          />
        ))}

        {matches.length === 0 && (
          <p className="flex flex-col items-center gap-3 py-10 text-center text-body text-ink-3">
            <Layers className="size-5" strokeWidth={1.5} aria-hidden />
            {collections.length === 0
              ? 'No collections yet — make the first one.'
              : `Nothing matches “${query.trim()}”.`}
          </p>
        )}
      </div>

      {/* Create, inline. Never a second dialog on top of this one. */}
      <div className="mt-3 border-t border-line pt-3">
        {creating || (needle && !exact) ? (
          <div className="flex items-center gap-2">
            <Input
              ref={createRef}
              value={query}
              placeholder="Name the new collection"
              maxLength={80}
              aria-label="New collection name"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  create(query)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setCreating(false)
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              disabled={!query.trim()}
              onClick={() => create(query)}
            >
              Create
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(
              'group flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-label',
              'text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-dashed border-line-strong text-ink-3 transition-colors group-hover:border-accent group-hover:text-accent">
              <Plus className="size-3.5" aria-hidden />
            </span>
            New collection
          </button>
        )}
      </div>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * One shelf, with three of its covers.
 *
 * The thumbnails are the point: choosing between "Comfort" and "Rewatch" from
 * two words is guesswork, and choosing between them from six covers is not.
 */
function CollectionRow({
  collection,
  checked,
  covers,
  count,
  onToggle,
}: {
  collection: Collection
  checked: boolean
  covers: MediaSummary[]
  count: number
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-md border p-2.5 text-left',
        'transition-[background-color,border-color] duration-200',
        checked
          ? 'border-accent-line bg-accent-quiet/60'
          : 'border-transparent hover:border-line hover:bg-surface-2/70',
      )}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150',
          checked ? 'border-accent bg-accent' : 'border-line-strong',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3.5 text-accent-ink" strokeWidth={3} />}
      </span>

      {/* A tight three-cover strip. Empty shelves get dashed slots so the row
          still has the same shape and the list never looks ragged. */}
      <span className="flex shrink-0 gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) =>
          covers[i] ? (
            <span key={covers[i].id} className="w-6 overflow-hidden rounded-[2px]">
              <CoverImage src={covers[i].coverImage} alt="" color={covers[i].color} flat />
            </span>
          ) : (
            <span
              key={i}
              className="h-9 w-6 rounded-[2px] border border-dashed border-line-strong/60"
            />
          ),
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-label font-medium text-ink">{collection.name}</span>
        <span className="label-cat label-cat-plain mt-1 block">{pluralize(count, 'title')}</span>
      </span>
    </button>
  )
}
