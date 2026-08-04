import { useState, type ReactNode } from 'react'
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
} from 'lucide-react'
import {
  Button,
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
import { useMediaSummary } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { usePrefs } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { requireSignIn } from '@/features/auth/gate'
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

  const { canWrite } = useAuth()

  const [target, setTarget] = useState(String(currentRank ?? 1))

  const listLength = rankedIds.length + (currentRank ? 0 : 1)

  const commit = () => {
    if (!canWrite) {
      onClose()
      requireSignIn('rank what you have watched')
      return
    }
    const parsed = Number.parseInt(target, 10)
    if (Number.isNaN(parsed)) return onClose()
    const index = Math.max(0, Math.min(listLength - 1, parsed - 1))
    moveRank(media.kind, media.id, index)
    toast({ message: `Ranked ${ordinal(index + 1)} in your ${media.kind}` })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ranking"
      description="Independent of your score — you can have a dozen 10s and still know which one is first."
      size="sm"
      footer={
        <>
          {currentRank && (
            <Button
              variant="danger"
              size="sm"
              className="mr-auto"
              onClick={() => {
                removeRank(media.kind, media.id)
                onClose()
              }}
            >
              Remove ranking
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={commit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Position" hint={`1 – ${listLength}`}>
          {(props) => (
            <Input
              {...props}
              data-autofocus
              type="number"
              min={1}
              max={listLength}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              className="font-mono-num w-28"
            />
          )}
        </Field>

        {rankedIds.length > 0 && (
          <div>
            <Eyebrow className="mb-3">Current top</Eyebrow>
            <ol className="space-y-1.5">
              {rankedIds.slice(0, 5).map((id, i) => (
                <li key={id} className="flex items-center gap-3 text-label text-ink-2">
                  <span className="font-mono-num w-5 shrink-0 text-right text-meta text-ink-3">
                    {i + 1}
                  </span>
                  <RankRowTitle mediaId={id} highlight={id === media.id} />
                  {entries[id]?.score != null && (
                    <span className="font-mono-num ml-auto text-meta text-ink-3">
                      {entries[id].score}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Dialog>
  )
}

function RankRowTitle({ mediaId, highlight }: { mediaId: number; highlight: boolean }) {
  // Reads the batch cache the library already populated, so this costs nothing
  // extra in the common case.
  const { media } = useMediaSummary(mediaId)
  const language = usePrefs((s) => s.titleLanguage)

  return (
    <span className={cn('truncate', highlight && 'font-medium text-accent')}>
      {media ? displayTitle(media, language) : '…'}
    </span>
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
          <Heart className={cn('size-4', entry?.favorite && 'fill-current text-dropped')} />
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
