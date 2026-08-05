import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Scale, Undo2 } from 'lucide-react'
import { Button, CoverImage, Dialog, Eyebrow, Rating, toast } from '@/design'
import { displayTitle } from '@/data/anilist/normalize'
import { unitNamePlural, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useEntriesOfKind, useRankedIds } from '@/data/store/selectors'
import { cn } from '@/lib/cn'
import { ordinal } from '@/lib/format'

/**
 * Placing a title by comparison instead of by dragging.
 *
 * Dragging asks you to know the answer before you start: to place something
 * 14th you have to already believe it is 14th, then hunt for the gap between
 * two rows you cannot both see at once. That is a fine way to *adjust* an
 * order and a terrible way to *build* one.
 *
 * A duel asks the only question anyone can actually answer — "this one, or
 * that one?" — and does the arithmetic itself. It is a binary search over the
 * existing order, which is why it stays short: the list is halved on every
 * answer, so placing a title among 200 takes eight questions, and among 20
 * takes five. The count is shown up front, because "how long is this going to
 * take" is the first thing anyone wants to know about a guided flow.
 *
 * The search assumes the existing order is consistent — that if A beats B and
 * B beats C then A beats C. Real opinions are not always transitive, and this
 * does not pretend otherwise: the result is a *position*, offered and then
 * still draggable, not a verdict. Nothing is written until the last answer.
 */

/**
 * Worst-case questions to place one title into an existing field.
 *
 * The duel is a binary search, so the field halves on every answer. An empty
 * field costs nothing — the first title in is simply first.
 */
export function questionsToPlace(fieldSize: number): number {
  return fieldSize <= 0 ? 0 : Math.ceil(Math.log2(fieldSize + 1))
}

/**
 * Worst-case questions to place `count` titles into a list already `ranked`
 * long, given that each one placed lengthens the field for the next.
 *
 * Exported so the estimate on the button and the questions the duel actually
 * asks come from the same arithmetic. An estimate derived independently of the
 * thing it estimates is a promise nobody is keeping.
 */
export function questionsForBatch(ranked: number, count: number): number {
  let total = 0
  for (let i = 0; i < count; i += 1) total += questionsToPlace(ranked + i)
  return total
}

/**
 * How long that is, in words.
 *
 * Five seconds a question: a head-to-head is two covers and a judgment, which
 * is a beat longer than a click and much shorter than a decision. Rounded to
 * something deliberately vague — the number's job is to tell you whether this
 * is a coffee-break job or a sit-down one, and a false precision like "4 min
 * 35 sec" answers a question nobody asked.
 */
export function estimateLabel(questions: number): string {
  // Placing the very first title into an empty order asks nothing at all: it is
  // first because there is nothing for it not to be.
  if (questions === 0) return 'instant'

  const minutes = Math.round((questions * 5) / 60)
  if (minutes < 1) return 'under a minute'
  if (minutes === 1) return 'about a minute'
  if (minutes < 60) return `about ${minutes} min`

  // Past an hour, minutes stop being a unit anyone can feel — "about 112 min"
  // is a number you have to convert before it means anything.
  const hours = Math.floor(minutes / 60)
  const rest = Math.round((minutes % 60) / 15) * 15
  if (rest === 0 || rest === 60) return `about ${hours + (rest === 60 ? 1 : 0)} hr`
  return `about ${hours} hr ${rest} min`
}

export interface PlacementDuelProps {
  /** The title being placed. */
  challenger: MediaSummary
  kind: MediaKind
  open: boolean
  onClose: () => void
  /** Resolve a ranked id to its artwork. */
  resolve: (id: number) => MediaSummary | undefined
  /**
   * Called instead of `onClose` once a placement is written.
   *
   * Its presence is what puts the dialog in batch mode: the caller is running
   * a queue and decides what happens next, so the dialog neither closes itself
   * nor raises a toast per title. Absent, the dialog behaves as a one-shot and
   * closes with an undoable toast, which is right when you placed exactly one
   * thing on purpose and wrong forty times in a row.
   */
  onPlaced?: (placedId: number) => void
  /** Position in a batch, 1-based. Shown so a queue has a visible end. */
  batch?: { done: number; total: number }
}

export function PlacementDuel({
  challenger,
  kind,
  open,
  onClose,
  resolve,
  onPlaced,
  batch,
}: PlacementDuelProps) {
  const language = usePrefs((s) => s.titleLanguage)
  const moveRank = useLibrary((s) => s.moveRank)
  const removeRank = useLibrary((s) => s.removeRank)
  const rankedIds = useRankedIds(kind)
  const entries = useEntriesOfKind(kind)

  const entryOf = useMemo(
    () => new Map(entries.map((e) => [e.mediaId, e])),
    [entries],
  )

  /**
   * The field, with the challenger taken out.
   *
   * Re-ranking a title that is already placed has to compare it against
   * everything *except itself* — otherwise the binary search can land on the
   * challenger, ask whether it beats itself, and place it exactly where it
   * already was no matter what you answer.
   *
   * Frozen for the life of the dialog: `rankedIds` changes the instant the
   * result is written, and a bounds pair pointing into a list that just
   * changed length is how an off-by-one becomes a crash.
   */
  const [field, setField] = useState<number[]>([])
  const [lo, setLo] = useState(0)
  const [hi, setHi] = useState(0)
  /**
   * Whether the effect below has run for this opening.
   *
   * Without it the first render is indistinguishable from a finished duel:
   * `field` is `[]` and `lo === hi === 0`, which reads as "settled", and the
   * component would fall straight through to rendering an opponent that does
   * not exist. That crashed the page white on every single open — the bounds
   * have to be *seeded* before they mean anything, and an empty range that has
   * not been seeded yet is not the same state as one that has.
   */
  const [seeded, setSeeded] = useState(false)

  /** Every (lo, hi) we have been at, so a wrong tap is one press from undone. */
  const [history, setHistory] = useState<{ lo: number; hi: number }[]>([])

  useEffect(() => {
    if (!open) {
      setSeeded(false)
      return
    }
    const next = rankedIds.filter((id) => id !== challenger.id)
    setField(next)
    setLo(0)
    setHi(next.length)
    setHistory([])
    setSeeded(true)
    // Deliberately keyed on `open` alone: re-seeding mid-duel because the
    // store ticked would restart the questions from the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, challenger.id])

  const settled = seeded && lo >= hi
  const mid = seeded && !settled ? Math.floor((lo + hi) / 2) : -1
  const opponentId = mid >= 0 ? field[mid] : undefined
  const opponent = opponentId != null ? resolve(opponentId) : undefined

  /** Questions still to come, worst case. */
  const remaining = settled ? 0 : Math.ceil(Math.log2(hi - lo + 1))
  const total = field.length === 0 ? 0 : Math.ceil(Math.log2(field.length + 1))
  const asked = history.length

  const commit = (index: number) => {
    // Captured *before* the write, so Undo restores the state the duel found
    // rather than repeating the state the duel produced.
    const wasAt = rankedIds.indexOf(challenger.id)

    moveRank(kind, challenger.id, index)

    if (onPlaced) {
      // Batch mode. No toast: forty of them stacked behind a dialog that is
      // still open is not feedback, and the dialog's own counter already says
      // what just happened.
      onPlaced(challenger.id)
      return
    }

    toast({
      message: `${displayTitle(challenger, language)} placed ${ordinal(index + 1)}`,
      action: {
        label: 'Undo',
        onClick: () => {
          if (wasAt === -1) removeRank(kind, challenger.id)
          else moveRank(kind, challenger.id, wasAt)
        },
      },
    })
    onClose()
  }

  // An empty board needs no questions — the first title in is simply first.
  // Gated on `seeded` so this cannot fire against the pre-seed state, which is
  // also an empty field but means "not ready yet" rather than "nothing to
  // compare against".
  useEffect(() => {
    if (open && seeded && field.length === 0) commit(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seeded, field.length])

  const answer = (challengerWins: boolean) => {
    if (mid < 0) return
    setHistory((h) => [...h, { lo, hi }])

    const nextLo = challengerWins ? lo : mid + 1
    const nextHi = challengerWins ? mid : hi

    if (nextLo >= nextHi) commit(nextLo)
    else {
      setLo(nextLo)
      setHi(nextHi)
    }
  }

  const back = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setLo(prev.lo)
    setHi(prev.hi)
  }

  // ← and → pick a side. The duel is two options and a keyboard has two arrows;
  // making people reach for the mouse for six consecutive binary choices is the
  // difference between a flow and a chore.
  useEffect(() => {
    if (!open || settled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        answer(true)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        answer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /**
   * No opponent, nothing to render — full stop.
   *
   * This used to read `if (!opponent && !settled)`, which let three separate
   * states through to a render that dereferences `opponent`: the pre-seed
   * frame, the frame after the last answer but before `onClose` lands, and the
   * empty-board case on its way to `commit(0)`. All three crashed the page
   * white. There is exactly one condition worth testing here and it is whether
   * there is something to draw.
   */
  if (!opponent) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Which one is better?"
      size="lg"
      footer={
        <>
          <span className="mr-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="size-4" />}
              disabled={history.length === 0}
              onClick={back}
            >
              Back
            </Button>
            <span className="font-mono-num text-meta text-ink-3">
              {asked + 1} of {Math.max(total, asked + 1)}
            </span>
          </span>

          {/* A dead heat still has to resolve to a position. The incumbent
              keeps its place — it earned the spot already, and "no opinion"
              is not grounds to take it. */}
          <Button variant="ghost" size="sm" onClick={() => answer(false)}>
            Too close to call
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {batch ? 'Stop here' : 'Stop'}
          </Button>
        </>
      }
    >
      {/* In a batch, the per-title question count is the small number and the
          queue is the big one. Someone forty titles into a run of ninety wants
          to know how much of the *run* is left far more than how many questions
          this particular title still needs. */}
      {batch && (
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <span className="label-cat label-cat-plain">
              Title {batch.done} of {batch.total}
            </span>
            <span className="font-mono-num text-meta text-ink-3 tabular-nums">
              {batch.total - batch.done} to go
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-expo)]"
              style={{ width: `${((batch.done - 1) / batch.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col items-center justify-center gap-2">
        <Eyebrow>
          <Scale className="size-3" aria-hidden />
          {remaining <= 1 ? 'Last question' : `About ${remaining} left`}
        </Eyebrow>
        {batch && (
          <p className="clamp-1 max-w-md text-center text-meta text-ink-2">
            Placing {displayTitle(challenger, language)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6">
        <Contender
          media={challenger}
          score={entryOf.get(challenger.id)?.score ?? null}
          progress={entryOf.get(challenger.id)?.progress ?? 0}
          kind={kind}
          language={language}
          side="left"
          onPick={() => answer(true)}
        />

        <span
          className="font-mono-num flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-meta font-semibold text-ink-3"
          aria-hidden
        >
          vs
        </span>

        <Contender
          media={opponent}
          score={entryOf.get(opponent.id)?.score ?? null}
          progress={entryOf.get(opponent.id)?.progress ?? 0}
          kind={kind}
          language={language}
          side="right"
          rank={field.indexOf(opponent.id) + 1}
          onPick={() => answer(false)}
        />
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-meta text-ink-3">
        <Undo2 className="size-3.5" aria-hidden />
        Use ← and → to answer. Nothing is saved until the last one.
      </p>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */

function Contender({
  media,
  score,
  progress,
  kind,
  language,
  side,
  rank,
  onPick,
}: {
  media: MediaSummary
  score: number | null
  progress: number
  kind: MediaKind
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
  side: 'left' | 'right'
  /** The opponent's current position, so the choice has context. */
  rank?: number
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'group frame-lift flex flex-col items-center gap-4 rounded-lg p-3 text-center',
        'transition-colors duration-200 hover:bg-surface-2/70',
        'focus-visible:bg-surface-2/70',
      )}
      aria-label={`Pick ${displayTitle(media, language)}`}
    >
      <span className="w-32 md:w-40">
        <CoverImage src={media.coverImage} alt="" color={media.color} />
      </span>

      <span className="flex min-h-16 flex-col items-center gap-1.5">
        <span className="clamp-2 text-title text-ink transition-colors group-hover:text-accent">
          {displayTitle(media, language)}
        </span>

        <span className="label-cat label-cat-plain">
          {rank != null
            ? `currently ${ordinal(rank)}`
            : progress > 0
              ? `${progress} ${unitNamePlural(kind)} in`
              : 'not placed yet'}
        </span>

        {score != null && <Rating value={score} size="xs" className="mt-1" />}
      </span>

      <span
        className={cn(
          'label-cat label-cat-plain opacity-0 transition-opacity group-hover:opacity-100',
          'group-focus-visible:opacity-100',
        )}
        aria-hidden
      >
        {side === 'left' ? '←' : '→'}
      </span>
    </button>
  )
}
