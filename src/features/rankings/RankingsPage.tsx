import { useEffect, useMemo, useState } from 'react'
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
  CoverImage,
  Dialog,
  EmptyState,
  Eyebrow,
  IconButton,
  Rating,
  SearchInput,
  SegmentedControl,
  toast,
  usePageAccent,
  useResolvedTheme,
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
import { PlacementDuel } from './PlacementDuel'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'

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
  const [dueling, setDueling] = useState<MediaSummary | null>(null)

  /**
   * `?place=<id>` opens the duel directly.
   *
   * That is the handoff from finishing a title anywhere else in the app: the
   * completion toast links here rather than trying to mount a dialog from a
   * poster's context menu, so one route owns the flow and the deep link is
   * shareable, refreshable and back-button-safe. The parameter is consumed on
   * arrival so a refresh does not re-open a duel the user already answered.
   */
  const placeId = Number(params.get('place')) || null

  // One request covers the ranked list and the picker behind it.
  const allIds = useMemo(
    () => [...new Set([...rankedIds, ...entries.map((e) => e.mediaId)])],
    [rankedIds, entries],
  )
  const { map } = useMediaMap(allIds)

  const byId = useMemo(() => new Map(entries.map((e) => [e.mediaId, e])), [entries])

  useEffect(() => {
    if (placeId == null) return
    const media = map.get(placeId)
    // Wait for the artwork batch — a duel with two blank frames is worse than
    // a beat of delay, and the effect re-runs the moment the map fills in.
    if (!media) return

    setDueling(media)
    const merged = new URLSearchParams(params)
    merged.delete('place')
    setParams(merged, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, map])

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

  // Your #1 colors the whole room. Nothing on this page is more yours.
  usePageAccent(podium[0]?.color, useResolvedTheme())

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
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(media) => {
          setAdding(false)
          setDueling(media)
        }}
        entries={entries}
        map={map}
        rankedIds={rankedIds}
      />

      {dueling && (
        <PlacementDuel
          challenger={dueling}
          kind={kind}
          open
          onClose={() => setDueling(null)}
          resolve={(id) => map.get(id)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The top three, as a masthead.
 *
 * The previous version was three posters of nearly equal size, centered in a
 * rounded box, each wearing a medal. That is a podium in the literal sense and
 * a failure in every other one: three tiles in a row is the exact "identical
 * cards" shape the rest of the app is trying to escape, the medals said with a
 * graphic what the layout should have been saying with hierarchy, and the box
 * around it made your best three titles look like a widget.
 *
 * This is an asymmetric editorial band instead:
 *
 *   left    #1 at real size, tilted off-axis, standing on the artwork's own
 *           banner — with the numeral set as display type beside it rather
 *           than stamped on it
 *   right   #2 and #3 as compact rows, sharing one hairline-divided column
 *
 * Rank is carried by *composition* — size, position, how much room each one
 * gets — which is what rank actually is. #1 does not need a gold circle to
 * explain that it is first when it is four times the size of #3 and has its
 * own artwork behind the whole section.
 *
 * Full-bleed rather than boxed. A masthead runs to the edges of the page; a
 * card sits inside them, and that distinction is most of the difference
 * between "editorial" and "dashboard".
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
  if (!first) return null

  // The banner, not the cover. It is 1900px wide against a cover's 430, so it
  // is the only asset in the catalog that can fill a band this size without
  // being upscaled — and it is already the right shape for one.
  const backdrop = first.bannerImage ?? first.coverImageLarge ?? first.coverImage

  return (
    <section className="bleed-x relative isolate overflow-hidden border-y border-line">
      {backdrop && (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <img src={backdrop} alt="" className="size-full scale-105 object-cover object-center" />
          {/* Two layers: a blur to kill the detail, then a scrim to hold the
              type. One heavy scrim alone turns every backdrop into the same
              gray; blurring first keeps the artwork's color and loses only its
              content, which is the half that was competing with the text. */}
          <div className="absolute inset-0 backdrop-blur-2xl backdrop-saturate-150" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(105deg, rgb(var(--scrim) / 0.96) 0%, rgb(var(--scrim) / 0.88) 45%, rgb(var(--scrim) / 0.72) 100%)',
            }}
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-(--container-page) px-5 py-8 md:px-10 md:py-10">
        {/* 1.15fr / 1fr, not 1fr / auto / 20rem.
            The old track list gave the left column every spare pixel, so on a
            wide screen "ONE PIECE" sat against six hundred points of nothing
            with the runners-up marooned at the far edge. Two proportional
            columns keep the halves in contact at any width, and the divider
            moved onto the right column as a border so it is actually visible
            instead of being a 24px hairline lost in the gap. */}
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          {/* ------------------------------------------------------- number one */}
          <Link
            to={`/media/${first.id}`}
            className="group/one flex items-center gap-5 md:gap-7"
            title={displayTitle(first, language)}
          >
            {/* Tilted, and it straightens on hover. A poster sitting perfectly
                square is a database row; three degrees off is an object
                somebody put down. */}
            <span className="frame-lift block w-28 shrink-0 md:w-36">
              <span className="block origin-bottom -rotate-3 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/one:rotate-0">
                <CoverImage
                  src={first.coverImageLarge ?? first.coverImage}
                  alt=""
                  color={first.color}
                  className="shadow-lg"
                />
              </span>
            </span>

            <span className="min-w-0">
              <span className="flex items-center gap-2.5">
                <span
                  className="font-display text-display-xl leading-[0.8] font-extrabold text-accent tabular-nums"
                  aria-hidden
                >
                  1
                </span>
                <span className="label-cat label-cat-plain pb-1">
                  your
                  <br />
                  number one
                </span>
              </span>

              <span className="clamp-2 mt-3 block text-balance text-display-md text-ink transition-colors duration-300 group-hover/one:text-accent">
                {displayTitle(first, language)}
              </span>

              <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {byId.get(first.id)?.score != null && (
                  <Rating value={byId.get(first.id)!.score} size="sm" />
                )}
                <span className="label-cat label-cat-plain">
                  {[first.seasonYear, first.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </span>
              </span>
            </span>
          </Link>

          {/* --------------------------------------------------- runners-up */}
          <ol className="min-w-0 lg:border-l lg:border-line lg:pl-14">
            {[second, third].map((m, i) =>
              m ? (
                <li key={m.id} className="border-b border-line/70 last:border-0">
                  <Link
                    to={`/media/${m.id}`}
                    className="group/up flex items-center gap-3.5 py-3"
                    title={displayTitle(m, language)}
                  >
                    <span
                      className="font-display w-6 shrink-0 text-display-sm leading-none font-bold text-ink-3/60 tabular-nums transition-colors duration-300 group-hover/up:text-accent"
                      aria-hidden
                    >
                      {i + 2}
                    </span>

                    <span className="frame-lift block w-11 shrink-0">
                      <CoverImage src={m.coverImage} alt="" color={m.color} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="clamp-1 block text-title text-ink transition-colors duration-300 group-hover/up:text-accent">
                        {displayTitle(m, language)}
                      </span>
                      {byId.get(m.id)?.score != null && (
                        <Rating value={byId.get(m.id)!.score} size="xs" className="mt-1.5" />
                      )}
                    </span>
                  </Link>
                </li>
              ) : null,
            )}
          </ol>
        </div>
      </div>
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

      {/* No community score anywhere on this page. A ranking is the one screen
          in the product that is purely your own judgment — putting the crowd's
          number next to your #3 invites you to reconcile the two, which is
          precisely the thing this page exists to let you ignore. */}

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
  open,
  onClose,
  onPick,
  entries,
  map,
  rankedIds,
}: {
  open: boolean
  onClose: () => void
  /** Hands the chosen title to the duel rather than dropping it at the bottom. */
  onPick: (media: MediaSummary) => void
  entries: LibraryEntry[]
  map: Map<number, MediaSummary>
  rankedIds: number[]
}) {
  const language = usePrefs((s) => s.titleLanguage)
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Rank a title"
      description="Pick one and you'll be asked a few head-to-heads to find its place."
      size="lg"
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
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
                /* Already-ranked titles stay clickable. Re-placing something is
                   the same question as placing it — "where does this go now" —
                   and locking the tile meant the only way to move a title from
                   40th to 3rd was to drag it past thirty-seven rows. */
                onClick={() => onPick(media)}
                title={
                  already
                    ? `${displayTitle(media, language)} — already ranked, place it again`
                    : displayTitle(media, language)
                }
                className="group relative rounded-[4px] text-left transition-transform duration-200 hover:-translate-y-1"
              >
                <CoverImage src={media.coverImage} alt="" color={media.color}>
                  {already && (
                    <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
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
