import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Check, ListPlus, Minus, MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { relativeShort } from '@/lib/dates'
import {
  CommunityScore,
  ContextMenu,
  CoverImage,
  IconButton,
  ProgressBar,
  ProgressStepper,
  Rating,
  Tooltip,
  useContextMenu,
} from '@/design'
import { usePrefetchMedia } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import {
  totalUnits,
  unitName,
  unitNamePlural,
  type MediaKind,
  type MediaSummary,
} from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { useRank } from '@/data/store/selectors'
import { statusLabel, type LibraryEntry } from '@/data/store/types'
import { useTracking } from './useTracking'
import { CollectionPicker, MediaMenuContent, RateButton, StatusMenu, StatusDot } from './controls'

/* ------------------------------------------------------------ shared bits -- */

/**
 * The corner tab. A small mono chip clipped to the corner of a poster rather
 * than floating inside it — like the price sticker on a record sleeve. Now
 * carries ranks only; both scores have their own treatments below.
 */
function CornerTab({
  children,
  corner = 'tr',
  tone = 'ink',
  className,
}: {
  children: ReactNode
  corner?: 'tl' | 'tr' | 'bl'
  tone?: 'ink' | 'accent'
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-mono-num absolute z-10 inline-flex items-center gap-1 px-1.5 py-1 text-[0.625rem] font-semibold',
        'backdrop-blur-md',
        corner === 'tr' && 'top-0 right-0 rounded-bl-[7px]',
        corner === 'tl' && 'top-0 left-0 rounded-br-[7px]',
        corner === 'bl' && 'bottom-0 left-0 rounded-tr-[7px]',
        tone === 'accent' ? 'bg-accent/95 text-accent-ink' : 'bg-canvas/90 text-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------ the poster grammar --
 *
 * Two numbers live on every poster in this product, and they occupy fixed,
 * opposite positions so that scanning a shelf never requires reading a label:
 *
 *   TOP-LEFT     everyone's score  — solid band-colored chip, X.X/10
 *   BOTTOM-LEFT  your score        — ember stars on a frosted plate, out of 5
 *   TOP-RIGHT    your rank         — ember tab, when a ranked view asks for it
 *
 * Both of them are painted here rather than at each call site, which is why
 * Library, Discover, Collections, search results and the media page cannot
 * drift apart.
 */

/** Everyone else's number. Always visible — it never fades on hover. */
function CommunityTab({
  value,
  size = 'sm',
}: {
  value: number | null | undefined
  size?: 'sm' | 'md'
}) {
  if (value == null) return null
  return (
    <span className="absolute top-1.5 left-1.5 z-10" aria-hidden={false}>
      <CommunityScore value={value} variant="badge" size={size} />
    </span>
  )
}

/**
 * Your verdict, as stars. Steps aside only when the hover controls come up —
 * and only then, because the controls carry the same stars in editable form.
 */
function ScoreTab({
  value,
  size = 'xs',
  fades,
}: {
  value: number | null | undefined
  size?: 'xs' | 'sm'
  fades?: boolean
}) {
  if (value == null) return null
  return (
    <span
      className={cn(
        'absolute bottom-1.5 left-1.5 z-10 transition-opacity duration-200',
        fades && 'group-hover/card:opacity-0 group-focus-within/card:opacity-0',
      )}
    >
      <Rating value={value} size={size} plate />
    </span>
  )
}

function formatOf(media: MediaSummary): string {
  if (!media.format) return ''
  return media.format
    .replace('TV_SHORT', 'TV Short')
    .replace('ONE_SHOT', 'One shot')
    .replace('MANGA', 'Manga')
    .replace('NOVEL', 'Novel')
    .replace('MOVIE', 'Film')
    .replace('SPECIAL', 'Special')
    .replace(/_/g, ' ')
}

function metaLine(media: MediaSummary): string {
  return [media.seasonYear, formatOf(media)].filter(Boolean).join(' · ')
}

/* ---------------------------------------------------------- poster progress */

/**
 * Advancing an episode from a poster.
 *
 * This is the interaction people perform more than any other in the app, so it
 * is built to behave like ticking something off a list:
 *
 *  - −/＋ stay put and stay hit-able for as long as the poster is hovered
 *  - the count itself is a button; click it and type an exact number
 *  - the whole control lives *outside* the card's link, so a mis-aimed click
 *    can never navigate away instead of counting
 *  - the last episode swaps ＋ for a tick, and the card is done
 */
function PosterProgress({ media }: { media: MediaSummary }) {
  const { entry, setProgress, bump } = useTracking(media)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const total = totalUnits(media)
  const progress = entry?.progress ?? 0
  const atEnd = total != null && progress >= total
  const unit = unitName(media.kind).toLowerCase()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commitDraft = () => {
    setEditing(false)
    const parsed = Number.parseInt(draft, 10)
    if (Number.isNaN(parsed)) return
    setProgress(Math.max(0, total != null ? Math.min(total, parsed) : parsed))
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center rounded-full border border-line/70 p-0.5',
        'bg-canvas/92 shadow-sm backdrop-blur-md',
      )}
    >
      <IconButton
        label={`One fewer ${unit}`}
        icon={<Minus className="size-3.5" />}
        variant="ghost"
        size="sm"
        disabled={progress <= 0}
        className="rounded-full"
        onClick={() => setProgress(progress - 1)}
      />

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitDraft()
            if (e.key === 'Escape') setEditing(false)
          }}
          aria-label={`${unitName(media.kind)} number`}
          className="font-mono-num w-10 bg-transparent text-center text-[0.6875rem] font-semibold text-ink outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(progress))
            setEditing(true)
          }}
          aria-label={`${progress} of ${total ?? 'unknown'} ${unit}s. Click to set exactly.`}
          className="font-mono-num min-w-10 px-1 text-[0.6875rem] font-semibold text-ink"
        >
          {progress}
          <span className="text-ink-3">/{total ?? '?'}</span>
        </button>
      )}

      {/* Keyed on `progress` so the icon re-mounts and replays its reaction on
          every tick: the ＋ hops, and the moment it becomes a tick on the last
          episode the check stamps itself down. This is the single most-repeated
          action in the product and it used to be a silent repaint. */}
      <IconButton
        key={progress}
        label={atEnd ? 'Finished' : `${unitName(media.kind)} ${progress + 1}`}
        icon={
          atEnd ? (
            <Check className="size-3.5 motion-safe:animate-[stamp_460ms_var(--ease-spring)]" />
          ) : (
            <Plus className="size-3.5 motion-safe:animate-[tick-up_320ms_var(--ease-spring)]" />
          )
        }
        variant={atEnd ? 'ghost' : 'primary'}
        size="sm"
        disabled={atEnd}
        className={cn('pressable rounded-full', atEnd && 'text-watching opacity-100')}
        onClick={bump}
      />
    </div>
  )
}

/* -------------------------------------------------------------- grid card -- */

export interface MediaCardProps {
  media: MediaSummary
  /** Show the progress track + inline stepper. Off for browse results. */
  showProgress?: boolean
  showRank?: boolean
  /** Index in a staggered grid — drives the entrance delay. */
  index?: number
  /**
   * Hide everyone else's score.
   *
   * Off by default. Two surfaces opt in — Discover and the media page — and
   * everywhere else the poster carries your stars and nothing else. A default
   * of `true` meant every new call site inherited the crowd's number without
   * anybody deciding it should.
   */
  showCommunity?: boolean
  /**
   * Artwork only: no title, no meta line, no progress track.
   *
   * For rows where the *shape* is the content — a lean row of overlapping
   * covers reads as a shelf of spines, and hanging two lines of type under
   * each one turns it straight back into a list of cards.
   */
  bare?: boolean
  className?: string
}

/**
 * The workhorse poster card.
 *
 * At rest it is framed artwork, two lines of type and two numbers: yours in the
 * top corner, everyone else's in the bottom. On hover the poster rises off the
 * shelf and the controls come up over the artwork.
 *
 * The controls are siblings of the link rather than children of it. That one
 * structural decision removes every "it navigated instead of counting" bug the
 * previous version could produce.
 */
export function MediaCard({
  media,
  showProgress = true,
  showRank,
  showCommunity = false,
  index,
  bare,
  className,
}: MediaCardProps) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const { entry, inLibrary, bump, setProgress, add } = useTracking(media)
  const rank = useRank(media.kind, media.id)
  const menu = useContextMenu()

  /**
   * A popover opened *from* the hover controls has to keep those controls
   * alive: the pointer leaves the card the moment it travels to the panel, and
   * a control that fades out from under an open panel is the exact "flickering
   * / accidental dismissal" the rating interaction used to suffer from.
   */
  const [panelOpen, setPanelOpen] = useState(false)

  const total = totalUnits(media)
  const title = displayTitle(media, language)
  const progress = entry?.progress ?? 0
  const atEnd = total != null && progress >= total
  const showControls = showProgress && inLibrary

  /* Keyboard, from anywhere inside the card: + advances, − goes back. The
     poster is already focusable as a link, so this costs no extra tab stop. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      if (inLibrary && !atEnd) bump()
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      if (inLibrary && progress > 0) setProgress(progress - 1)
    }
  }

  return (
    <article
      className={cn('group/card frame-lift relative', index != null && 'rise-in', className)}
      style={index != null ? { animationDelay: `${Math.min(index, 14) * 26}ms` } : undefined}
      onKeyDown={onKeyDown}
      onContextMenu={menu.open}
    >
      <div className="relative">
        <Link
          to={`/media/${media.id}`}
          onPointerEnter={() => prefetch(media.id)}
          onFocus={() => prefetch(media.id)}
          className="block rounded-sm"
          aria-label={title}
        >
          <CoverImage src={media.coverImage} alt="" color={media.color}>
            {showRank && rank && (
              <CornerTab corner="tr" tone="accent">
                {rank}
              </CornerTab>
            )}

            {/* Everyone's number, top-left. Never fades — a community score you
                have to hover for is a community score nobody reads. */}
            {showCommunity && <CommunityTab value={media.averageScore} />}

            {/* Yours, bottom-left, as stars. */}
            <ScoreTab value={entry?.score} fades={showControls} />

            {/* Scrim under the controls. Painted here so it sits over the art
                but under the buttons, which are outside the link. */}
            <span
              className={cn(
                'scrim-up pointer-events-none absolute inset-x-0 bottom-0 hidden h-28 md:block',
                'transition-opacity duration-[320ms] ease-[var(--ease-out-expo)]',
                // Branch rather than stack `opacity-0` and `opacity-100`: two
                // conflicting utilities of equal specificity are resolved by
                // stylesheet order, not by the order they appear in this
                // string, so "add the override" silently loses.
                panelOpen
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100',
              )}
              aria-hidden
            />
          </CoverImage>
        </Link>

        {/* Controls. Always mounted, never inside the link. Hidden on
            pointer-less devices, where the media page carries them instead.

            Two rows rather than one: the stars and the stepper each need their
            full width at 132px, and cramming them onto one line is what made
            the old card's controls overlap on the narrowest column. */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-1.5 bottom-1.5 hidden flex-col gap-1.5 md:flex',
            'transition-[opacity,transform] duration-[320ms] ease-[var(--ease-out-expo)]',
            panelOpen
              ? 'translate-y-0 opacity-100'
              : cn(
                  'translate-y-2 opacity-0',
                  'group-hover/card:translate-y-0 group-hover/card:opacity-100',
                  'group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100',
                ),
          )}
        >
          {showControls && (
            <div className="flex justify-start">
              <RateButton
                media={media}
                size="xs"
                onOpenChange={setPanelOpen}
                className="pointer-events-auto rounded-full bg-canvas/92 px-2 py-1.5 shadow-sm backdrop-blur-md"
              />
            </div>
          )}

          <div className="flex items-end justify-between gap-1.5">
            {showControls ? <PosterProgress media={media} /> : <span />}

            <span className="pointer-events-auto flex items-center gap-1.5">
              {/* Quick-add to a collection. On every poster in the product,
                  in or out of the library — filing is the signature gesture
                  and it should never require a trip to the media page. */}
              <QuickCollect media={media} onOpenChange={setPanelOpen} />

              {!inLibrary && (
                <Tooltip content="Add to library">
                  <IconButton
                    label="Add to library"
                    icon={<Plus className="size-3.5" />}
                    variant="primary"
                    size="sm"
                    className="pressable rounded-full shadow-sm"
                    onClick={() => add()}
                  />
                </Tooltip>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* The track always occupies its row, even at zero. Revealing it on the
          first tick used to grow the card and shove the rest of the grid down
          — the exact opposite of what "tick one off" should feel like. */}
      {showProgress && inLibrary && total != null && (
        <div className={cn('mt-2 transition-opacity duration-300', progress === 0 && 'opacity-0')}>
          <ProgressBar value={progress} max={total} />
        </div>
      )}

      {!bare && (
        <Link
          to={`/media/${media.id}`}
          onPointerEnter={() => prefetch(media.id)}
          className="mt-2.5 block space-y-1 rounded-sm"
          tabIndex={-1}
          aria-hidden
        >
          <p className="clamp-2 text-label leading-snug font-medium text-ink transition-colors duration-200 group-hover/card:text-accent">
            {title}
          </p>
          <p className="label-cat label-cat-plain truncate">{metaLine(media)}</p>
        </Link>
      )}

      <ContextMenu point={menu.point} onClose={menu.close} label={title}>
        {({ close }) => <MediaMenuContent media={media} close={close} />}
      </ContextMenu>
    </article>
  )
}

/* --------------------------------------------------------------- list row -- *
 *
 * The list view is the one place in the product that is honestly a table, and a
 * table needs a header. The columns below and the header above are declared in
 * the same file, from the same width tokens, because they are one object split
 * across two components and nothing else keeps them honest.
 *
 * Every column is fixed-width, right-packed, and *always rendered* — a title
 * with no known episode count draws an empty progress cell rather than omitting
 * it. Omitting it was fine while the widths were invisible; under a header it
 * would slide four columns left on one row out of ten.
 */

const COL = {
  index: 'w-6',
  progress: 'w-40',
  /** The stepper sizes itself from its contents; the column pins it. */
  stepper: 'w-34',
  score: 'w-24',
  rank: 'w-8',
  updated: 'w-12',
  /** Matches the trailing IconButton, so the header's last column is empty. */
  menu: 'w-8',
} as const

/** Only visible from the breakpoint its column appears at. */
const COL_AT = {
  index: 'hidden sm:block',
  progress: 'hidden lg:block',
  stepper: 'hidden md:block',
  score: 'hidden sm:block',
  rank: 'hidden lg:block',
  updated: 'hidden xl:block',
  menu: 'block',
} as const

/**
 * The header for a column of `MediaRow`s.
 *
 * Sticky, because a library scrolled past its first screen is a table whose
 * columns you can no longer name — which is the state the list view shipped in.
 */
export function MediaRowHeader({ kind }: { kind: MediaKind }) {
  const cell = 'text-[0.5rem] font-semibold tracking-[0.16em] text-ink-3/70 uppercase'

  return (
    // `-mx-5 px-5` so the rule under it reaches the panel's edges. Its own top
    // corners are rounded to match, because the panel can no longer clip them:
    // `overflow-hidden` on an ancestor silently kills `position: sticky`.
    <div className="sticky top-0 z-20 -mx-5 flex items-center gap-4 rounded-t-lg border-b border-line bg-surface/95 px-5 py-2 backdrop-blur-md">
      <span className={cn(COL.index, COL_AT.index, 'shrink-0')} aria-hidden />

      <span className={cn(cell, 'min-w-0 flex-1')}>Title</span>

      <span className={cn(COL.progress, COL_AT.progress, cell, 'shrink-0')}>Progress</span>
      <span className={cn(COL.stepper, COL_AT.stepper, cell, 'shrink-0 text-center')}>
        {unitNamePlural(kind)}
      </span>
      <span className={cn(COL.score, COL_AT.score, cell, 'shrink-0 text-right')}>Your score</span>
      <span className={cn(COL.rank, COL_AT.rank, cell, 'shrink-0 text-right')}>Rank</span>
      <span className={cn(COL.updated, COL_AT.updated, cell, 'shrink-0 text-right')}>Updated</span>

      <span className={cn(COL.menu, 'shrink-0')} aria-hidden />
    </div>
  )
}

export function MediaRow({
  media,
  entry,
  index,
}: {
  media: MediaSummary
  entry?: LibraryEntry
  index?: number
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const { setProgress } = useTracking(media)
  const rank = useRank(media.kind, media.id)
  const menu = useContextMenu()
  const total = totalUnits(media)

  return (
    <div
      className="group/row relative flex items-center gap-4 border-b border-line py-2.5 transition-colors last:border-0 hover:bg-surface-2/50"
      onContextMenu={menu.open}
    >
      {/* The row's own index, in the catalog voice. */}
      <span
        className={cn(
          'font-mono-num shrink-0 text-right text-[0.625rem] text-ink-3',
          COL.index,
          COL_AT.index,
        )}
      >
        {index != null ? String(index + 1).padStart(2, '0') : ''}
      </span>

      <Link
        to={`/media/${media.id}`}
        onPointerEnter={() => prefetch(media.id)}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="frame w-9 shrink-0 transition-transform duration-300 group-hover/row:-translate-y-0.5">
          <CoverImage src={media.coverImage} alt="" color={media.color} flat />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-label font-medium text-ink">{displayTitle(media, language)}</p>
          <p className="mt-0.5 flex items-center gap-2 text-meta text-ink-3">
            {entry && (
              <>
                <StatusDot status={entry.status} className="size-3" />
                {statusLabel(entry.status, media.kind)}
                <span aria-hidden>·</span>
              </>
            )}
            <span className="font-mono-num truncate">{metaLine(media)}</span>
          </p>
        </div>
      </Link>

      <div className={cn('shrink-0', COL.progress, COL_AT.progress)}>
        {entry && total != null && <ProgressBar value={entry.progress} max={total} />}
      </div>

      <div className={cn('shrink-0 text-center', COL.stepper, COL_AT.stepper)}>
        {entry && (
          <ProgressStepper
            value={entry.progress}
            max={total}
            unit={unitName(media.kind)}
            onChange={setProgress}
            size="sm"
          />
        )}
      </div>

      {/* Your score only.
          The row used to carry a YOURS column and an EVERYONE column side by
          side. On your own library the crowd's number is not what you came for,
          and two scores in one gutter is the confusion the star treatment
          exists to prevent. Community scores now live on exactly two surfaces:
          Discover, where they are the only signal you have, and the media page,
          where there is room to explain them.

          The column's own eyebrow used to live here, once per row — forty
          copies of the words YOUR SCORE stacked down the page, which is what a
          header row is for. */}
      {/* `sm:flex`, not COL_AT.score's `sm:block` — this is the one cell whose
          content has to be right-aligned as a flex child rather than as text. */}
      <div className={cn('hidden shrink-0 justify-end sm:flex', COL.score)}>
        {entry?.score != null ? (
          <Rating value={entry.score} size="xs" />
        ) : (
          <span className="text-[0.625rem] text-ink-3/50">not rated</span>
        )}
      </div>

      <span
        className={cn(
          'font-mono-num shrink-0 text-right text-[0.625rem] text-ink-3',
          COL.rank,
          COL_AT.rank,
        )}
      >
        {rank ? `#${rank}` : '—'}
      </span>

      <span
        className={cn(
          'font-mono-num shrink-0 text-right text-[0.625rem] text-ink-3',
          COL.updated,
          COL_AT.updated,
        )}
      >
        {entry ? relativeShort(entry.updatedAt) : ''}
      </span>

      <StatusMenu
        media={media}
        trigger={
          <IconButton
            label="More actions"
            icon={<MoreHorizontal className="size-4" />}
            size="sm"
            className="shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
          />
        }
      />

      <ContextMenu point={menu.point} onClose={menu.close}>
        {({ close }) => <MediaMenuContent media={media} close={close} />}
      </ContextMenu>
    </div>
  )
}

/* ------------------------------------------------------------- shelf item -- */

/**
 * Shelf mode: bigger art, no chrome, standing on a hairline that the parent
 * draws. Hovering lifts the single poster out of the row — the same gesture as
 * pulling one book forward to read its spine.
 */
export function ShelfCover({
  media,
  entry,
  showCommunity = false,
  width = 'md',
}: {
  media: MediaSummary
  entry?: LibraryEntry
  /** Off on your own shelves — see MediaCard. */
  showCommunity?: boolean
  width?: 'sm' | 'md' | 'lg'
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const menu = useContextMenu()
  const total = totalUnits(media)

  const w = width === 'lg' ? 'w-40 md:w-48' : width === 'sm' ? 'w-28 md:w-32' : 'w-32 md:w-38'

  return (
    <div className={cn('group/shelf frame-lift shrink-0 self-end', w)} onContextMenu={menu.open}>
      <Link to={`/media/${media.id}`} onPointerEnter={() => prefetch(media.id)} className="block">
        <CoverImage src={media.coverImage} alt={displayTitle(media, language)} color={media.color}>
          {showCommunity && (
            <CommunityTab value={media.averageScore} size={width === 'lg' ? 'md' : 'sm'} />
          )}
          <ScoreTab value={entry?.score} size={width === 'lg' ? 'sm' : 'xs'} />
        </CoverImage>
      </Link>

      {entry && total != null && entry.progress > 0 && entry.progress < total && (
        <ProgressBar value={entry.progress} max={total} className="mt-1.5" />
      )}

      <ContextMenu point={menu.point} onClose={menu.close}>
        {({ close }) => <MediaMenuContent media={media} close={close} />}
      </ContextMenu>
    </div>
  )
}

/* ------------------------------------------------------------- overlap row -- */

/**
 * Covers shelved too tightly, leaning on each other.
 *
 * Hovering pulls one forward and lets the row breathe around it. It is the
 * cheapest way to make a row of artwork feel like a physical shelf rather than
 * a list of images, and it is why the home page no longer reads as a grid of
 * equal boxes.
 */
export function CoverOverlapRow({
  media,
  width = 104,
  overlap = 34,
  className,
}: {
  media: MediaSummary[]
  width?: number
  overlap?: number
  className?: string
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()

  return (
    <div
      className={cn('overlap-row', className)}
      style={{ '--overlap': `-${overlap}px` } as React.CSSProperties}
    >
      {media.map((m, i) => (
        <Link
          key={m.id}
          to={`/media/${m.id}`}
          onPointerEnter={() => prefetch(m.id)}
          title={displayTitle(m, language)}
          className="frame-lift block shrink-0"
          style={{ width, zIndex: media.length - i }}
        >
          <CoverImage src={m.coverImage} alt={displayTitle(m, language)} color={m.color} />
        </Link>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- feature card -- */

export interface FeatureCardProps {
  media: MediaSummary
  eyebrow?: string
  blurb?: ReactNode
  action?: ReactNode
  /** Covers layered behind the main poster — the "pulled from the crate" look. */
  layered?: MediaSummary[]
  height?: 'md' | 'lg'
  /** Discover only. Home's hero is your own shelf, not a recommendation. */
  showCommunity?: boolean
  className?: string
}

/**
 * The one thing on a page that is allowed to be enormous.
 *
 * Banner artwork bleeding to the edges, blurred and blown up so the page takes
 * its color from the show; the poster standing sharp in front of it; two or
 * three more covers layered behind that so the card reads as a stack you could
 * pick up. Every major page carries exactly one of these — that is what stops
 * the app being the same rectangle nine times.
 */
export function FeatureCard({
  media,
  eyebrow,
  blurb,
  action,
  layered = [],
  height = 'md',
  showCommunity = false,
  className,
}: FeatureCardProps) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const backdrop = media.bannerImage ?? media.coverImageLarge ?? media.coverImage
  const behind = layered.filter((m) => m.id !== media.id).slice(0, 3)

  return (
    <article
      className={cn(
        'group/feature sheen relative isolate overflow-hidden rounded-xl border border-line bg-surface-2',
        height === 'lg' ? 'min-h-[21rem]' : 'min-h-[16rem]',
        className,
      )}
    >
      <div className="absolute inset-0" aria-hidden>
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            className="size-full object-cover object-center transition-transform duration-[1400ms] ease-[var(--ease-out-expo)] group-hover/feature:scale-105"
          />
        )}
        <div className="scrim-side absolute inset-0" />
      </div>

      <div className="relative flex h-full flex-col justify-end gap-6 p-6 md:flex-row md:items-end md:p-8">
        <div className="relative flex shrink-0 items-end">
          {/* The layered covers sit behind and to the right, fanning out on
              hover of the card — the stack motif at hero scale. */}
          {behind.map((m, i) => (
            <span
              key={m.id}
              className="frame absolute bottom-0 hidden h-[calc(100%-14px)] transition-transform duration-[520ms] ease-[var(--ease-out-expo)] lg:block"
              style={{
                width: 92,
                left: 74 + i * 26,
                zIndex: -1 - i,
                transform: `rotate(${2 + i * 2.5}deg) translateY(${4 + i * 3}px)`,
                transitionDelay: `${i * 45}ms`,
              }}
              aria-hidden
            >
              {m.coverImage && (
                <img src={m.coverImage} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </span>
          ))}

          <Link
            to={`/media/${media.id}`}
            onPointerEnter={() => prefetch(media.id)}
            className="frame-lift relative z-10 hidden w-32 shrink-0 md:block lg:w-36"
          >
            <CoverImage src={media.coverImage} alt="" color={media.color} priority />
          </Link>
        </div>

        <div className="min-w-0 flex-1 md:pb-1">
          {eyebrow && <p className="label-cat mb-3">{eyebrow}</p>}

          <Link to={`/media/${media.id}`} onPointerEnter={() => prefetch(media.id)}>
            <h3
              className={cn(
                'text-balance text-ink',
                height === 'lg' ? 'text-display-lg' : 'text-display-md',
              )}
            >
              {displayTitle(media, language)}
            </h3>
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="label-cat label-cat-plain">{metaLine(media)}</p>
            {showCommunity && <CommunityScore value={media.averageScore} variant="pill" />}
          </div>

          {blurb && <div className="mt-3 max-w-md text-body text-ink-2">{blurb}</div>}
          {action && <div className="mt-5">{action}</div>}
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------ quick-collect */

/**
 * Filing, from any poster, without leaving the shelf.
 *
 * Deliberately the popover form of the checklist rather than the full dialog:
 * from a poster this is a reflex ("that belongs in Comfort Shows"), and a modal
 * for a reflex is a tax. The media page, where you are already committed to one
 * title, gets the full dialog instead. Same control underneath, two weights.
 */
function QuickCollect({
  media,
  onOpenChange,
}: {
  media: MediaSummary
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <CollectionPicker
      media={media}
      onOpenChange={onOpenChange}
      trigger={
        <IconButton
          label="Add to a collection"
          icon={<ListPlus className="size-3.5" />}
          variant="secondary"
          size="sm"
          className="rounded-full shadow-sm"
        />
      }
    />
  )
}

/* ------------------------------------------------------------------ misc -- */

export { CornerTab, CommunityTab, ScoreTab }
