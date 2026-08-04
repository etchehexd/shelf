import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, CoverImage, Dialog, SearchInput } from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useAllEntries, useCollectionItems } from '@/data/store/selectors'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'

/**
 * Bulk add.
 *
 * Filing twelve titles into a collection used to mean twelve trips to twelve
 * media pages. Here it is one search box, twelve clicks and a Done — and the
 * grid shows the artwork, because picking from a list of titles is a database
 * task and picking from a wall of covers is not.
 */
export function AddTitlesDialog({
  collectionId,
  collectionName,
  open,
  onClose,
}: {
  collectionId: string
  collectionName: string
  open: boolean
  onClose: () => void
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const entries = useAllEntries()
  const items = useCollectionItems(collectionId)
  const addToCollection = useLibrary((s) => s.addToCollection)

  const ids = useMemo(() => entries.map((e) => e.mediaId), [entries])
  const { map } = useMediaMap(ids)

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const already = useMemo(() => new Set(items.map((i) => i.mediaId)), [items])

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries
      .map((e) => map.get(e.mediaId))
      .filter((m): m is MediaSummary => Boolean(m))
      .filter((m) => {
        if (!needle) return true
        const { romaji, english, native } = m.title
        return [romaji, english, native].some((t) => t?.toLowerCase().includes(needle))
      })
      .sort((a, b) => displayTitle(a, language).localeCompare(displayTitle(b, language)))
  }, [entries, map, query, language])

  const toggle = (id: number) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const commit = () => {
    for (const id of picked) {
      const media = map.get(id)
      if (media) addToCollection(collectionId, media)
    }
    setPicked(new Set())
    setQuery('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add to ${collectionName}`}
      size="lg"
      footer={
        <>
          <span className="mr-auto font-mono-num text-meta text-ink-3">
            {picked.size > 0 ? `${picked.size} selected` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={picked.size === 0} onClick={commit}>
            Add {picked.size > 0 ? pluralize(picked.size, 'title') : ''}
          </Button>
        </>
      }
    >
      <SearchInput
        data-autofocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your library"
        aria-label="Search your library"
        className="mb-5"
      />

      {candidates.length === 0 ? (
        <p className="py-10 text-center text-body text-ink-3">Nothing in your library matches.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3">
          {candidates.map((media) => {
            const inCollection = already.has(media.id)
            const selected = picked.has(media.id)

            return (
              <button
                key={media.id}
                type="button"
                disabled={inCollection}
                aria-pressed={selected}
                onClick={() => toggle(media.id)}
                title={displayTitle(media, language)}
                className={cn(
                  'group relative rounded-[4px] text-left transition-transform duration-200',
                  inCollection ? 'cursor-default opacity-35' : 'hover:-translate-y-1',
                )}
              >
                <CoverImage src={media.coverImage} alt="" color={media.color}>
                  {(selected || inCollection) && (
                    <span className="absolute inset-0 flex items-center justify-center bg-canvas/60">
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full',
                          selected ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-ink-3',
                        )}
                      >
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                    </span>
                  )}
                </CoverImage>
                <p className="clamp-2 mt-1.5 text-[0.6875rem] leading-tight text-ink-2">
                  {displayTitle(media, language)}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
