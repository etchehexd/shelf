import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
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
import { Check, GripVertical, Plus, Search, Trophy, X } from 'lucide-react'
import {
  Button,
  buttonClasses,
  CommunityScore,
  CoverImage,
  Dialog,
  EmptyState,
  Eyebrow,
  IconButton,
  Rating,
  SearchInput,
  SegmentedControl,
  toast,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { KIND_LABEL, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useEntriesOfKind, useRankedIds } from '@/data/store/selectors'
import { useAuth } from '@/data/supabase/auth'
import { SignInWall } from '@/features/auth/SignInWall'
import type { LibraryEntry } from '@/data/store/types'
import { cn } from '@/lib/cn'
import { ordinal, pluralize } from '@/lib/format'

/**
 * Rankings — its own room.
 *
 * This used to be a strip wedged into the top of the Library, where it competed
 * with the thing the Library is actually for: status and progress. Two jobs on
 * one screen meant neither got the space it needed — the ranking was a
 * six-cover teaser you couldn't reorder, and it pushed the shelves below the
 * fold on every visit.
 *
 * Split out, both halves get to be themselves. The Library is a place you *do*
 * things; this is a place you *decide* things, so it is quieter, wider, and
 * built entirely around one gesture — picking something up and putting it
 * somewhere else.
 *
 * Ranking stays deliberately independent of score. A shelf of 10/10s still has
 * a #1, and that judgment is the whole point of the page.
 */
export default function RankingsPage() {
  const { signedOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') as MediaKind) || 'anime'

  const rankedIds = useRankedIds(kind)
  const entries = useEntriesOfKind(kind)
  const moveRank = useLibrary((s) => s.moveRank)

  const [adding, setAdding] = useState(false)

  // One request covers the ranked list and the picker behind it.
  const allIds = useMemo(
    () => [...new Set([...rankedIds, ...entries.map((e) => e.mediaId)])],
    [rankedIds, entries],
  )
  const { map } = useMediaMap(allIds)

  const byId = useMemo(() => new Map(entries.map((e) => [e.mediaId, e])), [entries])

  const sensors = useSensors(
    // Enough travel that a click on a row still opens the title.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const to = rankedIds.indexOf(Number(over.id))
    if (to === -1) return

    // One row is written — the midpoint between the new neighbors.
    moveRank(kind, Number(active.id), to)
  }

  const podium = rankedIds
    .slice(0, 3)
    .map((id) => map.get(id))
    .filter(Boolean) as MediaSummary[]

  const unranked = entries.length - rankedIds.length

  if (signedOut) {
    return (
      <SignInWall section="Rankings" headline="An order is an opinion.">
        Ranking is the one thing here that isn't a fact about a show — it's a judgment about
        which one comes first, and it only means something attached to the person who made it.
      </SignInWall>
    )
  }

  return (
    <div className="space-y-10 pt-1">
      <header className="space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-7">
          <div>
            <Eyebrow className="mb-3">Ordered by you, not by score</Eyebrow>
            <h1 className="text-display-lg text-ink">Rankings</h1>
          </div>
          <p className="flex items-baseline gap-2 pb-1.5">
            <span className="font-mono-num text-display-md leading-none font-semibold text-ink">
              {rankedIds.length}
            </span>
            <span className="label-cat label-cat-plain">in order</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            aria-label="Media type"
            value={kind}
            onChange={(next) => {
              const merged = new URLSearchParams(params)
              merged.set('kind', next)
              setParams(merged, { replace: true })
            }}
            segments={(['anime', 'manga', 'novel'] as MediaKind[]).map((k) => ({
              value: k,
              label: KIND_LABEL[k],
            }))}
          />

          <Button
            variant="primary"
            size="md"
            icon={<Plus className="size-4" />}
            onClick={() => setAdding(true)}
            disabled={entries.length === 0}
          >
            Rank a title
          </Button>
        </div>
      </header>

      {rankedIds.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" strokeWidth={1.5} />}
          title="Nothing ordered yet"
          description="A ranking is a different question from a score. You can hand out a dozen 10s and still know exactly which one comes first — this is where that answer lives."
          action={
            entries.length > 0 ? (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Rank your first title
              </Button>
            ) : (
              <Link to="/discover" className={buttonClasses('primary', 'md')}>
                Find something first
              </Link>
            )
          }
        />
      ) : (
        <>
          {podium.length >= 3 && <Podium media={podium} byId={byId} />}

          <section className="space-y-4">
            <div className="flex items-baseline gap-5">
              <Eyebrow>The full order</Eyebrow>
              <span className="h-px flex-1 translate-y-[-0.2em] bg-line" aria-hidden />
              <span className="label-cat label-cat-plain">drag to reorder</span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
                <ol className="space-y-1.5">
                  {rankedIds.map((id, index) => (
                    <RankRow
                      key={id}
                      mediaId={id}
                      index={index}
                      kind={kind}
                      media={map.get(id)}
                      entry={byId.get(id)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>

            {unranked > 0 && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className={cn(
                  'group flex w-full items-center justify-between gap-4 rounded-md border border-dashed border-line',
                  'px-4 py-3.5 text-label text-ink-2 transition-colors',
                  'hover:border-accent-line hover:bg-accent-quiet/40 hover:text-accent',
                )}
              >
                <span>
                  {pluralize(unranked, 'title')} in your library {unranked === 1 ? 'is' : 'are'} still
                  unranked
                </span>
                <Plus
                  className="size-4 shrink-0 transition-transform duration-300 group-hover:rotate-90"
                  aria-hidden
                />
              </button>
            )}
          </section>
        </>
      )}

      <RankPicker
        kind={kind}
        open={adding}
        onClose={() => setAdding(false)}
        entries={entries}
        map={map}
        rankedIds={rankedIds}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The podium.
 *
 * Three plinths of different heights with the numerals set enormous behind the
 * artwork, over a blown-up wash of the number one's cover. It is the page's one
 * indulgence and it earns its place: "what are my top three" is the single
 * question this section exists to answer, and a list of equal rows answers it
 * with the same weight it gives #47.
 */
function Podium({
  media,
  byId,
}: {
  media: MediaSummary[]
  byId: Map<number, LibraryEntry>
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const [first, second, third] = media

  // Visual order puts the winner in the middle on wide screens — the shape of a
  // podium — but the DOM order stays 1, 2, 3 for anyone not looking at it.
  const order = ['md:order-2', 'md:order-1', 'md:order-3']
  const heights = ['md:pb-0', 'md:pb-10', 'md:pb-16']
  const widths = ['w-36 md:w-52', 'w-28 md:w-40', 'w-28 md:w-40']

  return (
    <section className="relative isolate overflow-hidden rounded-xl border border-line bg-surface-2/60 px-6 pt-8 pb-9 md:px-10">
      {first?.coverImage && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <img src={first.coverImage} alt="" className="art-wash size-full object-cover" />
          <div className="absolute inset-0 bg-canvas/70" />
        </div>
      )}

      <ol className="flex flex-wrap items-end justify-center gap-x-6 gap-y-8 md:gap-x-12">
        {[first, second, third].map((m, i) => {
          if (!m) return null
          const entry = byId.get(m.id)

          return (
            <li key={m.id} className={cn('relative shrink-0', order[i], heights[i])}>
              <Link
                to={`/media/${m.id}`}
                className="group/plinth frame-lift block"
                title={displayTitle(m, language)}
              >
                {/* The numeral sits behind the poster, bleeding off its edge —
                    a plaque on the wall, not a badge on the artwork. */}
                <span
                  className={cn(
                    'font-mono-num pointer-events-none absolute -top-4 -left-5 -z-10 leading-[0.7]',
                    'font-semibold tabular-nums select-none',
                    'text-ink-3/25 transition-colors duration-500 group-hover/plinth:text-accent/45',
                    i === 0 ? 'text-[7rem] md:text-[9rem]' : 'text-[5rem] md:text-[6.5rem]',
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>

                <div className={widths[i]}>
                  <CoverImage src={m.coverImageLarge ?? m.coverImage} alt="" color={m.color}>
                    <span className="absolute top-1.5 left-1.5 z-10">
                      <CommunityScore value={m.averageScore} variant="badge" size="sm" />
                    </span>
                  </CoverImage>
                </div>
              </Link>

              <div className={cn('mt-3.5', widths[i])}>
                <p className="clamp-2 text-label leading-snug font-medium text-ink">
                  {displayTitle(m, language)}
                </p>
                {entry?.score != null && <Rating value={entry.score} size="xs" className="mt-2" />}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function RankRow({
  mediaId,
  index,
  kind,
  media,
  entry,
}: {
  mediaId: number
  index: number
  kind: MediaKind
  media: MediaSummary | undefined
  entry: LibraryEntry | undefined
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const removeRank = useLibrary((s) => s.removeRank)
  const moveRank = useLibrary((s) => s.moveRank)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mediaId,
  })

  const title = media ? displayTitle(media, language) : '…'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group/rank relative flex items-center gap-4 rounded-md border border-line bg-surface py-2.5 pr-3 pl-2',
        'transition-[border-color,box-shadow] duration-300 hover:border-line-strong',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none rounded-sm p-1 text-ink-3 opacity-40 transition-opacity hover:text-ink group-hover/rank:opacity-100 active:cursor-grabbing"
        aria-label={`Reorder ${title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span
        className={cn(
          'font-mono-num w-9 shrink-0 text-right leading-none font-semibold tabular-nums',
          index < 3 ? 'text-display-sm text-accent' : 'text-title text-ink-3',
        )}
      >
        {index + 1}
      </span>

      <Link to={`/media/${mediaId}`} className="flex min-w-0 flex-1 items-center gap-4">
        {media && (
          <span className="w-10 shrink-0">
            <CoverImage src={media.coverImage} alt="" color={media.color} flat />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label font-medium text-ink">{title}</span>
          <span className="label-cat label-cat-plain mt-1 block truncate">
            {[media?.seasonYear, media?.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>

      <Rating value={entry?.score ?? null} size="xs" className="hidden shrink-0 sm:inline-flex" />

      <span className="hidden shrink-0 md:block">
        <CommunityScore value={media?.averageScore} variant="pill" size="sm" />
      </span>

      {/* Keyboard- and click-reachable jump to the top, because dragging item
          #90 to #1 with a mouse is a minute of scrolling. */}
      {index > 0 && (
        <IconButton
          label={`Move ${title} to first`}
          icon={<Trophy className="size-3.5" />}
          size="sm"
          onClick={() => {
            moveRank(kind, mediaId, 0)
            toast({ message: `${title} is now first` })
          }}
          className="shrink-0 opacity-0 transition-opacity group-hover/rank:opacity-100 focus-visible:opacity-100"
        />
      )}

      <IconButton
        label={`Remove ${title} from the ranking`}
        icon={<X className="size-3.5" />}
        size="sm"
        onClick={() => removeRank(kind, mediaId)}
        className="shrink-0 opacity-0 transition-opacity group-hover/rank:opacity-100 focus-visible:opacity-100"
      />
    </li>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Adding to the ranking. A wall of covers from your own library rather than a
 * dropdown of titles — you are choosing by memory of the thing, and the artwork
 * is the fastest route to that memory.
 */
function RankPicker({
  kind,
  open,
  onClose,
  entries,
  map,
  rankedIds,
}: {
  kind: MediaKind
  open: boolean
  onClose: () => void
  entries: LibraryEntry[]
  map: Map<number, MediaSummary>
  rankedIds: number[]
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const moveRank = useLibrary((s) => s.moveRank)
  const [query, setQuery] = useState('')

  const ranked = useMemo(() => new Set(rankedIds), [rankedIds])

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

  const addToEnd = (media: MediaSummary) => {
    moveRank(kind, media.id, rankedIds.length)
    toast({ message: `${displayTitle(media, language)} ranked ${ordinal(rankedIds.length + 1)}` })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Rank a title"
      description="Anything you add lands at the bottom. Drag it where it belongs."
      size="lg"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
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
        <p className="flex flex-col items-center gap-3 py-12 text-center text-body text-ink-3">
          <Search className="size-5" strokeWidth={1.5} aria-hidden />
          Nothing in your library matches.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3">
          {candidates.map((media) => {
            const already = ranked.has(media.id)
            return (
              <button
                key={media.id}
                type="button"
                disabled={already}
                onClick={() => addToEnd(media)}
                title={displayTitle(media, language)}
                className={cn(
                  'group relative rounded-[4px] text-left transition-transform duration-200',
                  already ? 'cursor-default opacity-35' : 'hover:-translate-y-1',
                )}
              >
                <CoverImage src={media.coverImage} alt="" color={media.color}>
                  {already && (
                    <span className="absolute inset-0 flex items-center justify-center bg-canvas/60">
                      <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-ink-3">
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
