import { useEffect, useMemo, useState } from 'react'
import { Check, Library, Search, X } from 'lucide-react'
import {
  Button,
  CoverImage,
  CoverSkeleton,
  Dialog,
  Eyebrow,
  SearchInput,
  SegmentedControl,
} from '@/design'
import { useMediaMap, useTitleSearch } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useAllEntries, useCollectionItems } from '@/data/store/selectors'
import { rankBy } from '@/lib/search'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'

/**
 * Bulk add — from the whole catalog, not just from what you already track.
 *
 * The old version searched `entries` and nothing else, which quietly made a
 * collection a *view over the library* rather than a thing you curate. That is
 * the wrong model: "Films to watch with my sister" and "Best fight scenes" are
 * both mostly titles you have never logged, and being told to add all twelve to
 * your library first — where they then sit misfiled as Planning — is exactly
 * the friction that stops people making collections at all.
 *
 * So there are two sources and one selection:
 *
 *   no query   your library, instantly, with no network round trip
 *   a query    the catalog, ranked by the same engine Discover uses, with
 *              anything already in your library flagged so it is obvious
 *
 * Picks survive changing the query, which is what makes it a basket rather than
 * a filter. The tray at the bottom is the proof: you can search four separate
 * times, pick one title from each, and add all four at once. That means holding
 * the selected records themselves rather than their ids — an id picked from a
 * catalog search cannot be resolved out of the library map afterwards, which is
 * how the previous version would have silently dropped every unlogged title.
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
  const [kind, setKind] = useState<MediaKind>('anime')
  const [picked, setPicked] = useState<Map<number, MediaSummary>>(new Map())

  useEffect(() => {
    if (!open) {
      setQuery('')
      setPicked(new Map())
    }
  }, [open])

  const already = useMemo(() => new Set(items.map((i) => i.mediaId)), [items])
  const inLibrary = useMemo(() => new Set(ids), [ids])

  const searching = query.trim().length >= 2
  const { media: found, isLoading } = useTitleSearch({
    query,
    kind,
    enabled: open && searching,
    limit: 36,
  })

  /**
   * Your own shelf, ranked by the same scorer rather than by `includes()`.
   *
   * Using the real ranker here means the library list answers "rezero" and a
   * typo the same way the catalog list does — two search boxes in one dialog
   * that disagree about what matches is worse than either behavior alone.
   */
  const mine = useMemo(() => {
    const all = entries
      .map((e) => map.get(e.mediaId))
      .filter((m): m is MediaSummary => Boolean(m))

    if (!searching) {
      return [...all].sort((a, b) =>
        displayTitle(a, language).localeCompare(displayTitle(b, language)),
      )
    }

    return rankBy(query, all, (m) => ({
      names: [m.title.english, m.title.romaji, m.title.native],
      aliases: m.synonyms,
      popularity: m.popularity,
    }))
      .slice(0, 12)
      .map((r) => r.item)
  }, [entries, map, query, searching, language])

  // Catalog hits you already track are shown in the library group above, so
  // showing them twice would just make the dialog look padded.
  const catalog = useMemo(
    () => found.filter((m) => !mine.some((x) => x.id === m.id)),
    [found, mine],
  )

  const toggle = (media: MediaSummary) => {
    setPicked((prev) => {
      const next = new Map(prev)
      if (next.has(media.id)) next.delete(media.id)
      else next.set(media.id, media)
      return next
    })
  }

  const commit = () => {
    for (const media of picked.values()) addToCollection(collectionId, media)
    setPicked(new Map())
    setQuery('')
    onClose()
  }

  const renderGrid = (list: MediaSummary[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3">
      {list.map((media) => (
        <PickTile
          key={media.id}
          media={media}
          language={language}
          selected={picked.has(media.id)}
          filed={already.has(media.id)}
          tracked={inLibrary.has(media.id)}
          onToggle={() => toggle(media)}
        />
      ))}
    </div>
  )

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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search every title"
          aria-label="Search every title"
          className="min-w-0 flex-1"
        />
        <SegmentedControl
          aria-label="Media type"
          size="sm"
          value={kind}
          onChange={setKind}
          segments={(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => ({
            value: k,
            label: KIND_LABEL[k],
          }))}
        />
      </div>

      {/* The basket. Only appears once there is something in it, and every
          chip removes itself — a selection you cannot see or undo is how
          people end up adding six titles they did not mean to. */}
      {picked.size > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5 rounded-md border border-accent-line bg-accent-quiet/50 p-2.5">
          {[...picked.values()].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m)}
              className={cn(
                'group inline-flex max-w-56 items-center gap-1.5 rounded-full border border-accent-line',
                'bg-surface py-1 pr-2 pl-2.5 text-meta font-medium text-ink transition-colors hover:border-accent',
              )}
              aria-label={`Remove ${displayTitle(m, language)}`}
            >
              <span className="truncate">{displayTitle(m, language)}</span>
              <X className="size-3.5 shrink-0 text-ink-3 group-hover:text-accent" aria-hidden />
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[52vh] space-y-7 overflow-y-auto overscroll-contain pr-0.5">
        {mine.length > 0 && (
          <section>
            <Eyebrow className="mb-3">
              <Library className="size-3" aria-hidden />
              {searching ? 'In your library' : 'Your library'}
            </Eyebrow>
            {renderGrid(mine)}
          </section>
        )}

        {searching && (
          <section>
            <Eyebrow className="mb-3">
              <Search className="size-3" aria-hidden />
              Everything else
            </Eyebrow>
            {isLoading && catalog.length === 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3">
                {Array.from({ length: 8 }, (_, i) => (
                  <CoverSkeleton key={i} />
                ))}
              </div>
            ) : catalog.length === 0 ? (
              <p className="py-6 text-center text-body text-ink-3">
                Nothing else matches “{query.trim()}”.
              </p>
            ) : (
              renderGrid(catalog)
            )}
          </section>
        )}

        {!searching && mine.length === 0 && (
          <p className="flex flex-col items-center gap-3 py-12 text-center text-body text-ink-3">
            <Search className="size-5" strokeWidth={1.5} aria-hidden />
            Search above to put anything on this shelf — it does not have to be in your
            library first.
          </p>
        )}
      </div>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */

function PickTile({
  media,
  language,
  selected,
  filed,
  tracked,
  onToggle,
}: {
  media: MediaSummary
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
  selected: boolean
  /** Already on this shelf — nothing to do, so the tile is inert. */
  filed: boolean
  /** Already in the library. A note, not a restriction. */
  tracked: boolean
  onToggle: () => void
}) {
  const title = displayTitle(media, language)

  return (
    <button
      type="button"
      disabled={filed}
      aria-pressed={selected}
      onClick={onToggle}
      title={filed ? `${title} — already on this shelf` : title}
      className={cn(
        'group relative rounded-art text-left transition-transform duration-200',
        filed ? 'cursor-default opacity-35' : 'hover:-translate-y-1',
      )}
    >
      <CoverImage src={media.coverImage} alt="" color={media.color}>
        {(selected || filed) && (
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
        {tracked && !filed && !selected && (
          <span
            className="absolute top-1 right-1 rounded-art bg-canvas/85 px-1 py-px text-[0.5rem] font-semibold tracking-wide text-ink-2 uppercase backdrop-blur-sm"
            aria-hidden
          >
            Tracked
          </span>
        )}
      </CoverImage>
      <p className="clamp-2 mt-1.5 text-[0.6875rem] leading-tight text-ink-2">{title}</p>
    </button>
  )
}
