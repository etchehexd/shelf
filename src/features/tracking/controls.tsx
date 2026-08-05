import { useMemo, useState, type ReactNode } from 'react'
import {
  BookmarkPlus,
  Check,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleSlash,
  Heart,
  Lock,
  Plus,
  Scale,
  Trophy,
} from 'lucide-react'
import {
  Button,
  CoverImage,
  Dialog,
  Eyebrow,
  Field,
  Input,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Popover,
  Rating,
  RatingInput,
  Textarea,
  Tooltip,
  toast,
} from '@/design'
import { cn } from '@/lib/cn'
import { ordinal } from '@/lib/format'
import { useLibrary } from '@/data/store/library'
import { useCollections, useCollectionsContaining, useRank, useRankedIds } from '@/data/store/selectors'
import { STATUS_ORDER, canRate, statusLabel, type EntryStatus } from '@/data/store/types'
import { totalUnits, unitName, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { usePrefs } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { requireSignIn } from '@/features/auth/gate'
import { PlacementDuel } from '@/features/rankings/PlacementDuel'
import { useTracking } from './useTracking'

const STATUS_ICON: Record<EntryStatus, typeof CircleDot> = {
  current: CircleDot,
  completed: Check,
  planning: CircleDashed,
  paused: CirclePause,
  dropped: CircleSlash,
}

const STATUS_TEXT: Record<EntryStatus, string> = {
  current: 'text-watching',
  completed: 'text-completed',
  planning: 'text-planning',
  paused: 'text-paused',
  dropped: 'text-dropped',
}

/* ------------------------------------------------------------------ status -- */

export function StatusMenu({
  media,
  trigger,
}: {
  media: MediaSummary
  trigger: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
}) {
  const { entry, setStatus, remove } = useTracking(media)

  return (
    <Popover trigger={trigger} role="menu" label="Status" align="start" className="w-52">
      {({ close }) => (
        <>
          <MenuLabel>Status</MenuLabel>
          {STATUS_ORDER.map((status) => {
            const Icon = STATUS_ICON[status]
            const active = entry?.status === status
            return (
              <MenuItem
                key={status}
                icon={<Icon className={cn('size-4', active && STATUS_TEXT[status])} />}
                selected={active}
                trailing={active ? <Check className="size-4 text-accent" /> : undefined}
                onSelect={() => {
                  setStatus(status)
                  close()
                }}
              >
                {statusLabel(status, media.kind)}
              </MenuItem>
            )
          })}

          {entry && (
            <>
              <MenuSeparator />
              <MenuItem
                danger
                onSelect={() => {
                  remove()
                  close()
                }}
              >
                Remove from library
              </MenuItem>
            </>
          )}
        </>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ rating -- */

/**
 * The rating panel.
 *
 * A score is a verdict on the whole work, so it only opens once the title is
 * completed. Before that, the trigger explains itself rather than sitting
 * grayed out with no reason given — and offers the one action that unlocks it.
 */
export function RatePopover({
  media,
  trigger,
  onOpenChange,
}: {
  media: MediaSummary
  trigger: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
  /** Lets a hover-revealed trigger stay visible while its own panel is open. */
  onOpenChange?: (open: boolean) => void
}) {
  const { entry, setScore, setNote, setStatus } = useTracking(media)
  const [note, setNoteDraft] = useState(entry?.note ?? '')

  const unlocked = canRate(entry?.status)

  return (
    <Popover
      trigger={trigger}
      label="Rate"
      onOpenChange={onOpenChange}
      // One fixed width for both states. The panel used to be two different
      // widths, so unlocking a title by pressing the button inside it made the
      // whole popover jump sideways under the pointer.
      className="w-[21rem] p-5"
      align="center"
    >
      {({ close }) =>
        !unlocked ? (
          <div className="space-y-3.5">
            <Eyebrow>Not yet</Eyebrow>
            <p className="text-body text-ink-2">
              A score is a verdict on the whole thing, so it opens up once you've finished it.
            </p>
            <Button
              variant="primary"
              size="sm"
              block
              icon={<Check className="size-4" />}
              onClick={() => setStatus('completed')}
            >
              Mark as completed
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3.5">
              <Eyebrow>Your score</Eyebrow>
              <RatingInput
                value={entry?.score ?? null}
                onChange={setScore}
                size="lg"
                label={`Rate ${media.title.romaji}`}
              />
            </div>

            {/* Short reactions, not reviews. */}
            <Field label="Note" counter={`${note.length}/280`}>
              {(props) => (
                <Textarea
                  {...props}
                  value={note}
                  maxLength={280}
                  rows={2}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
              )}
            </Field>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={entry?.score == null}
                onClick={() => setScore(null)}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setNote(note)
                  close()
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )
      }
    </Popover>
  )
}

/**
 * The compact rating affordance used on cards and rows: the stars when there
 * is a score, a quiet prompt when there isn't, and a padlock when the title
 * hasn't been finished yet.
 */
export function RateButton({
  media,
  size = 'sm',
  className,
  onOpenChange,
}: {
  media: MediaSummary
  size?: 'xs' | 'sm' | 'md'
  className?: string
  onOpenChange?: (open: boolean) => void
}) {
  const { entry } = useTracking(media)
  const unlocked = canRate(entry?.status)

  if (!unlocked && entry?.score == null) {
    return (
      <Tooltip content="Finish it to rate it">
        <span className={cn('inline-flex items-center text-ink-3', className)}>
          <Lock className="size-3.5" aria-label="Rating locked until completed" />
        </span>
      </Tooltip>
    )
  }

  return (
    <RatePopover
      media={media}
      onOpenChange={onOpenChange}
      trigger={
        <button
          type="button"
          className={cn('rounded-sm', className)}
          aria-label={entry?.score != null ? `Rated ${entry.score} out of 10` : 'Rate'}
          onClick={(e) => e.preventDefault()}
        >
          <Rating value={entry?.score ?? null} size={size} />
        </button>
      }
    />
  )
}

/* ---------------------------------------------------------------- ranking -- */

/**
 * Ranking is independent of score on purpose: a shelf of 10/10s still has a #1.
 * The dialog shows the current top so choosing a position is a judgment about
 * neighbors rather than an abstract number.
 */
/**
 * Ranking one title, without arithmetic.
 *
 * This dialog used to be a number field. It asked "what position is this?",
 * which is a question nobody can answer about their own taste — you know that
 * a show beats Frieren and loses to Hunter x Hunter, you do not know that it
 * is eleventh. Typing 11 is a guess, and the list you were guessing against
 * was a five-row preview you could not touch.
 *
 * So there are two ways in and both are direct:
 *
 *   compare   the head-to-head duel, which finds the exact slot in a handful
 *             of "this or that" questions
 *   place     an interactive list of your order with a real gap between every
 *             pair — click the gap and it goes there
 *
 * The gaps are the important half. They turn an abstract thing ("position 11")
 * into a physical one ("between these two"), which is what makes this a place
 * you can look at your ranking and move something rather than a form.
 */
export function RankDialog({
  media,
  open,
  onClose,
}: {
  media: MediaSummary
  open: boolean
  onClose: () => void
}) {
  const rankedIds = useRankedIds(media.kind)
  const currentRank = useRank(media.kind, media.id)
  const moveRank = useLibrary((s) => s.moveRank)
  const removeRank = useLibrary((s) => s.removeRank)
  const entries = useLibrary((s) => s.entries)
  const language = usePrefs((s) => s.titleLanguage)

  const { canWrite } = useAuth()
  const [dueling, setDueling] = useState(false)

  // The order with this title taken out — the same field the duel searches, so
  // both routes are placing into an identical list.
  const field = useMemo(() => rankedIds.filter((id) => id !== media.id), [rankedIds, media.id])
  const { map } = useMediaMap(field)

  const place = (index: number) => {
    if (!canWrite) {
      onClose()
      requireSignIn('rank what you have watched')
      return
    }
    moveRank(media.kind, media.id, index)
    toast({ message: `Ranked ${ordinal(index + 1)} in your ${media.kind}` })
    onClose()
  }

  if (dueling) {
    return (
      <PlacementDuel
        challenger={media}
        kind={media.kind}
        open={open}
        onClose={() => {
          setDueling(false)
          onClose()
        }}
        resolve={(id) => map.get(id)}
      />
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ranking"
      description="Independent of your score — you can have a dozen 10s and still know which one is first."
      size="md"
      footer={
        <>
          {currentRank && (
            <Button
              variant="danger"
              size="sm"
              className="mr-auto"
              onClick={() => {
                removeRank(media.kind, media.id)
                toast({ message: 'Taken out of your ranking' })
                onClose()
              }}
            >
              Remove ranking
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/60 p-3">
          <span className="flex items-center gap-2.5">
            <Trophy className="size-4 shrink-0 text-accent" aria-hidden />
            <span className="text-label text-ink">
              {currentRank ? (
                <>
                  Currently <span className="font-semibold">{ordinal(currentRank)}</span>
                </>
              ) : (
                'Not in your ranking yet'
              )}
            </span>
          </span>

          {field.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={<Scale className="size-4" />}
              onClick={() => setDueling(true)}
            >
              Compare head-to-head
            </Button>
          )}
        </div>

        {field.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-body text-ink-2">Nothing else is ranked yet.</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={() => place(0)}>
              Make it first
            </Button>
          </div>
        ) : (
          <div>
            <Eyebrow className="mb-3">Or drop it into the order</Eyebrow>

            {/* Slot, row, slot, row… Every gap is a button. The list scrolls
                rather than growing the dialog: a 200-title ranking should not
                have to be scrolled past to reach the footer, and at that length
                the duel is the right tool anyway. */}
            <ol className="max-h-[46vh] overflow-y-auto overscroll-contain pr-1">
              {field.map((id, i) => {
                const m = map.get(id)
                return (
                  <li key={id}>
                    <Slot index={i} onClick={() => place(i)} />
                    <div className="flex items-center gap-3 py-1.5">
                      <span className="font-mono-num w-6 shrink-0 text-right text-meta text-ink-3 tabular-nums">
                        {i + 1}
                      </span>
                      {m && (
                        <span className="w-7 shrink-0">
                          <CoverImage src={m.coverImage} alt="" color={m.color} flat />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-label text-ink-2">
                        {m ? displayTitle(m, language) : '…'}
                      </span>
                      {entries[id]?.score != null && (
                        <Rating value={entries[id].score} size="xs" className="shrink-0" />
                      )}
                    </div>
                  </li>
                )
              })}
              <li>
                <Slot index={field.length} onClick={() => place(field.length)} last />
              </li>
            </ol>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/**
 * The gap between two ranked titles, as a control.
 *
 * Collapsed it is a hairline; on hover or focus it opens into a labelled band.
 * That expansion is the whole affordance — a row of invisible 8px hit targets
 * is not discoverable, and a permanently open row of "insert here" buttons
 * doubles the length of the list and buries the titles you are reading.
 */
function Slot({ index, onClick, last }: { index: number; onClick: () => void; last?: boolean }) {
  const line =
    'h-px flex-1 rounded-full bg-transparent transition-colors duration-200 ' +
    'group-hover/slot:bg-accent group-focus-visible/slot:bg-accent'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Place here, as number ${index + 1}`}
      className={cn(
        'group/slot flex w-full items-center gap-2 overflow-hidden rounded-sm',
        'h-2 transition-[height,background-color] duration-200 ease-[var(--ease-out-expo)]',
        'hover:h-8 hover:bg-accent-quiet focus-visible:h-8 focus-visible:bg-accent-quiet',
        last && 'mt-1',
      )}
    >
      <span className={line} aria-hidden />
      <span
        className={cn(
          'shrink-0 px-1.5 text-[0.625rem] font-semibold tracking-wide text-accent uppercase',
          'opacity-0 transition-opacity duration-200',
          'group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100',
        )}
        aria-hidden
      >
        Place {ordinal(index + 1)}
      </span>
      <span className={line} aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------ collections -- */

/**
 * The collection picker.
 *
 * One control does the whole job: search what you have, tick as many as you
 * want, and type a name that doesn't exist yet to make it — all without the
 * panel closing between actions. Filing a title used to be four steps and two
 * screens; it is now one keystroke and a click.
 */
export function CollectionPicker({
  media,
  trigger,
  onOpenChange,
}: {
  media: MediaSummary
  trigger: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Popover
      trigger={trigger}
      label="Add to collection"
      onOpenChange={onOpenChange}
      className="w-76 p-2"
      align="start"
    >
      {() => <CollectionChecklist media={media} autoFocus />}
    </Popover>
  )
}

/**
 * The list itself, so the popover, the context menu and the media page's own
 * panel are all literally the same control rather than three lookalikes.
 */
export function CollectionChecklist({
  media,
  autoFocus,
  className,
}: {
  media: MediaSummary
  autoFocus?: boolean
  className?: string
}) {
  const collections = useCollections()
  const containing = useCollectionsContaining(media.id)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const createCollection = useLibrary((s) => s.createCollection)
  const { canWrite } = useAuth()

  const [query, setQuery] = useState('')

  const inSet = new Set(containing.map((c) => c.id))
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? collections.filter((c) => c.name.toLowerCase().includes(needle))
    : collections
  const exact = collections.some((c) => c.name.toLowerCase() === needle)

  const create = () => {
    const name = query.trim()
    if (!name || !canWrite) return
    const id = createCollection({ name })
    addToCollection(id, media)
    toast({ message: `${name} started` })
    setQuery('')
  }

  /**
   * Signed out this is a shelf you cannot reach, so it says so once instead of
   * rendering an empty checklist. A list of zero collections would read as
   * "you have none" rather than "you have no account", which is the wrong
   * problem to hand someone.
   */
  if (!canWrite) {
    return (
      <div className={cn('px-2.5 py-3', className)}>
        <p className="text-meta text-ink-2">Collections need an account.</p>
        <button
          type="button"
          onClick={() => requireSignIn('build collections')}
          className="label-cat label-cat-plain mt-2 text-accent hover:underline"
        >
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="p-1">
        <Input
          {...(autoFocus ? { 'data-autofocus': true } : {})}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const first = matches[0]
            if (first && !inSet.has(first.id)) addToCollection(first.id, media)
            else if (!exact) create()
          }}
          placeholder={collections.length ? 'Search or create' : 'Name your first collection'}
          maxLength={80}
          aria-label="Search collections"
        />
      </div>

      <div className="max-h-64 overflow-y-auto">
        {matches.map((c) => {
          const active = inSet.has(c.id)
          return (
            <MenuItem
              key={c.id}
              icon={
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-[5px] border transition-colors duration-150',
                    active ? 'border-accent bg-accent' : 'border-line-strong',
                  )}
                >
                  {active && <Check className="size-3 text-accent-ink" strokeWidth={3} />}
                </span>
              }
              selected={active}
              // Deliberately does not close: filing one title into three
              // collections should be three clicks, not three round trips.
              onSelect={() => {
                if (active) removeFromCollection(c.id, media.id)
                else addToCollection(c.id, media)
              }}
            >
              {c.name}
            </MenuItem>
          )
        })}

        {matches.length === 0 && !needle && (
          <p className="px-2.5 py-3 text-meta text-ink-3">No collections yet.</p>
        )}
      </div>

      {needle && !exact && (
        <>
          <MenuSeparator />
          <MenuItem icon={<Plus className="size-4" />} onSelect={create}>
            Create “{query.trim()}”
          </MenuItem>
        </>
      )}
    </div>
  )
}

/* --------------------------------------------------------- context menu -- */

/**
 * Every action a poster carries, on right-click.
 *
 * The collections list is inlined rather than nested behind another popover:
 * a menu inside a menu means the outer one dismisses the moment you reach for
 * the inner one, which is the single most common way context menus break.
 */
export function MediaMenuContent({
  media,
  close,
}: {
  media: MediaSummary
  close: () => void
}) {
  const { entry, inLibrary, canRate: unlocked, add, remove, setStatus, bump, toggleFavorite } =
    useTracking(media)
  const total = totalUnits(media)
  const atEnd = total != null && (entry?.progress ?? 0) >= total

  if (!inLibrary) {
    return (
      <>
        <MenuLabel>{displayTitleShort(media)}</MenuLabel>
        <MenuItem
          icon={<BookmarkPlus className="size-4" />}
          onSelect={() => {
            add()
            close()
          }}
        >
          Add to library
        </MenuItem>
        <MenuItem
          icon={<CircleDot className="size-4" />}
          onSelect={() => {
            add('current')
            close()
          }}
        >
          Start it now
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Collections</MenuLabel>
        <CollectionChecklist media={media} />
      </>
    )
  }

  return (
    <>
      <MenuLabel>{displayTitleShort(media)}</MenuLabel>

      {!atEnd && (
        <MenuItem
          icon={<Plus className="size-4" />}
          onSelect={() => {
            bump()
            close()
          }}
        >
          {unitName(media.kind)} {(entry?.progress ?? 0) + 1}
        </MenuItem>
      )}

      <MenuItem
        icon={
          <Heart
            // Keyed on the state so the heart re-mounts and beats once each
            // time it is filled — the one place in the app where a little
            // theatre is exactly the right amount.
            key={String(entry?.favorite)}
            className={cn(
              'size-4',
              entry?.favorite &&
                'fill-current text-dropped motion-safe:animate-[thump_460ms_var(--ease-spring)]',
            )}
          />
        }
        onSelect={() => {
          toggleFavorite()
          close()
        }}
      >
        {entry?.favorite ? 'Remove from favorites' : 'Add to favorites'}
      </MenuItem>

      <MenuSeparator />
      <MenuLabel>Status</MenuLabel>
      {STATUS_ORDER.map((status) => {
        const Icon = STATUS_ICON[status]
        const active = entry?.status === status
        return (
          <MenuItem
            key={status}
            icon={<Icon className={cn('size-4', active && STATUS_TEXT[status])} />}
            selected={active}
            trailing={active ? <Check className="size-4 text-accent" /> : undefined}
            onSelect={() => {
              setStatus(status)
              close()
            }}
          >
            {statusLabel(status, media.kind)}
          </MenuItem>
        )
      })}

      {!unlocked && entry?.score == null && (
        <>
          <MenuSeparator />
          <p className="flex items-center gap-2 px-2.5 py-2 text-meta text-ink-3">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Finish it to score it
          </p>
        </>
      )}

      <MenuSeparator />
      <MenuLabel>Collections</MenuLabel>
      <CollectionChecklist media={media} />

      <MenuSeparator />
      <MenuItem
        danger
        onSelect={() => {
          remove()
          close()
        }}
      >
        Remove from library
      </MenuItem>
    </>
  )
}

function displayTitleShort(media: MediaSummary): string {
  const t = media.title.english ?? media.title.romaji
  return t.length > 34 ? `${t.slice(0, 33)}…` : t
}

export function StatusDot({ status, className }: { status: EntryStatus; className?: string }): ReactNode {
  const Icon = STATUS_ICON[status]
  return <Icon className={cn('size-4', STATUS_TEXT[status], className)} aria-hidden />
}

export { statusLabel }
export type { EntryStatus, MediaKind }
