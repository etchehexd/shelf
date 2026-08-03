import { useState, type ReactNode } from 'react'
import {
  BookmarkPlus,
  Check,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleSlash,
  Heart,
  ListPlus,
  Plus,
  Star,
  Trophy,
} from 'lucide-react'
import {
  Button,
  Dialog,
  Field,
  Input,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Popover,
  Stars,
  Textarea,
  toast,
} from '@/design'
import { cn } from '@/lib/cn'
import { ordinal } from '@/lib/format'
import { useLibrary } from '@/data/store/library'
import { useCollections, useCollectionsContaining, useRank, useRankedIds } from '@/data/store/selectors'
import { STATUS_ORDER, statusLabel, type EntryStatus } from '@/data/store/types'
import type { MediaKind, MediaSummary } from '@/data/anilist/types'
import { useMediaSummary } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { usePrefs } from '@/data/store/prefs'
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

export function RatePopover({
  media,
  trigger,
}: {
  media: MediaSummary
  trigger: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
}) {
  const { entry, setScore, setNote } = useTracking(media)
  const [note, setNoteDraft] = useState(entry?.note ?? '')

  return (
    <Popover trigger={trigger} label="Rate" className="w-80 p-4">
      {({ close }) => (
        <div className="space-y-4">
          <div>
            <p className="mb-2.5 text-micro text-ink-3 uppercase">Your rating</p>
            <Stars
              value={entry?.score ?? null}
              onChange={setScore}
              size="lg"
              showValue
              label={`Rate ${media.title.romaji}`}
            />
          </div>

          {/* Short reactions, not reviews — see the brief. */}
          <Field
            label="A quick reaction"
            counter={`${note.length} / 280`}
            hint="Optional. One line is plenty."
          >
            {(props) => (
              <Textarea
                {...props}
                value={note}
                maxLength={280}
                rows={2}
                placeholder="Absolutely beautiful ending."
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            )}
          </Field>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNoteDraft(entry?.note ?? '')
                close()
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNote(note)
                close()
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}

/* ---------------------------------------------------------------- ranking -- */

/**
 * Ranking is independent of score on purpose: a shelf of 10/10s still has a #1.
 * The dialog shows the current top so choosing a position is a judgement about
 * neighbours rather than an abstract number.
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

  const [target, setTarget] = useState(String(currentRank ?? 1))

  const listLength = rankedIds.length + (currentRank ? 0 : 1)

  const commit = () => {
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
      title="Set your ranking"
      description={`Independent of your score — you can have many 10s and still order them.`}
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
              className="tnum w-28"
            />
          )}
        </Field>

        {rankedIds.length > 0 && (
          <div>
            <p className="mb-2 text-micro text-ink-3 uppercase">Your current top</p>
            <ol className="space-y-1">
              {rankedIds.slice(0, 5).map((id, i) => (
                <li key={id} className="flex items-center gap-3 text-label text-ink-2">
                  <span className="tnum w-5 shrink-0 text-right text-ink-3">{i + 1}</span>
                  <RankRowTitle mediaId={id} highlight={id === media.id} />
                  {entries[id]?.score != null && (
                    <span className="tnum ml-auto text-meta text-ink-3">{entries[id].score}</span>
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

export function CollectionPicker({
  media,
  trigger,
}: {
  media: MediaSummary
  trigger: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
}) {
  const collections = useCollections()
  const containing = useCollectionsContaining(media.id)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const createCollection = useLibrary((s) => s.createCollection)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const inSet = new Set(containing.map((c) => c.id))

  return (
    <Popover trigger={trigger} label="Add to collection" className="w-72 p-2" align="start">
      {({ close }) => (
        <div className="space-y-1">
          <MenuLabel>Collections</MenuLabel>

          <div className="max-h-64 overflow-y-auto">
            {collections.length === 0 && !creating && (
              <p className="px-2.5 py-3 text-meta text-ink-3">
                No collections yet. Create one below.
              </p>
            )}

            {collections.map((c) => {
              const active = inSet.has(c.id)
              return (
                <MenuItem
                  key={c.id}
                  icon={
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[5px] border',
                        active ? 'border-accent bg-accent' : 'border-line-strong',
                      )}
                    >
                      {active && <Check className="size-3 text-accent-ink" strokeWidth={3} />}
                    </span>
                  }
                  selected={active}
                  onSelect={() => {
                    if (active) removeFromCollection(c.id, media.id)
                    else addToCollection(c.id, media)
                  }}
                >
                  {c.name}
                </MenuItem>
              )
            })}
          </div>

          <MenuSeparator />

          {creating ? (
            <form
              className="flex gap-2 p-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                const id = createCollection({ name: name.trim() })
                addToCollection(id, media)
                toast({ message: `Added to ${name.trim()}` })
                setName('')
                setCreating(false)
                close()
              }}
            >
              <Input
                data-autofocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Comfort shows"
                maxLength={80}
                aria-label="New collection name"
              />
              <Button type="submit" variant="primary" size="sm">
                Add
              </Button>
            </form>
          ) : (
            <MenuItem icon={<Plus className="size-4" />} onSelect={() => setCreating(true)}>
              New collection
            </MenuItem>
          )}
        </div>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------- composite actions -- */

/** The four quick actions used on the media page and in card hover states. */
export function QuickActions({ media, size = 'md' }: { media: MediaSummary; size?: 'sm' | 'md' }) {
  const { entry, inLibrary, add, toggleFavourite } = useTracking(media)
  const [rankOpen, setRankOpen] = useState(false)
  const rank = useRank(media.kind, media.id)

  if (!inLibrary) {
    return (
      <Button variant="primary" size={size} icon={<BookmarkPlus className="size-4" />} onClick={() => add()}>
        Add to library
      </Button>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <RatePopover
          media={media}
          trigger={
            <Button size={size} icon={<Star className="size-4" />}>
              {entry?.score != null ? `Rated ${entry.score}` : 'Rate'}
            </Button>
          }
        />

        <Button size={size} icon={<Trophy className="size-4" />} onClick={() => setRankOpen(true)}>
          {rank ? `Ranked ${ordinal(rank)}` : 'Rank'}
        </Button>

        <CollectionPicker
          media={media}
          trigger={
            <Button size={size} icon={<ListPlus className="size-4" />}>
              Collection
            </Button>
          }
        />

        <StatusMenu
          media={media}
          trigger={
            <Button size={size} icon={<StatusDot status={entry?.status ?? 'planning'} />}>
              {statusLabel(entry?.status ?? 'planning', media.kind)}
            </Button>
          }
        />

        <Button
          size={size}
          variant="ghost"
          icon={
            <Heart
              className={cn('size-4', entry?.favourite && 'fill-current text-dropped')}
              aria-hidden
            />
          }
          aria-pressed={entry?.favourite}
          onClick={toggleFavourite}
        >
          {entry?.favourite ? 'Favourite' : 'Favourite'}
        </Button>
      </div>

      <RankDialog media={media} open={rankOpen} onClose={() => setRankOpen(false)} />
    </>
  )
}

export function StatusDot({ status, className }: { status: EntryStatus; className?: string }): ReactNode {
  const Icon = STATUS_ICON[status]
  return <Icon className={cn('size-4', STATUS_TEXT[status], className)} aria-hidden />
}

export { statusLabel }
export type { EntryStatus, MediaKind }
