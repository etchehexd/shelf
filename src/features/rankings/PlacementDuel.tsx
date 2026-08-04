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

export interface PlacementDuelProps {
  /** The title being placed. */
  challenger: MediaSummary
  kind: MediaKind
  open: boolean
  onClose: () => void
  /** Resolve a ranked id to its artwork. */
  resolve: (id: number) => MediaSummary | undefined
}

export function PlacementDuel({ challenger, kind, open, onClose, resolve }: PlacementDuelProps) {
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
  /** Every (lo, hi) we have been at, so a wrong tap is one press from undone. */
  const [history, setHistory] = useState<{ lo: number; hi: number }[]>([])

  useEffect(() => {
    if (!open) return
    const next = rankedIds.filter((id) => id !== challenger.id)
    setField(next)
    setLo(0)
    setHi(next.length)
    setHistory([])
    // Deliberately keyed on `open` alone: re-seeding mid-duel because the
    // store ticked would restart the questions from the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, challenger.id])

  const settled = lo >= hi
  const mid = settled ? -1 : Math.floor((lo + hi) / 2)
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
  useEffect(() => {
    if (open && field.length === 0 && rankedIds.filter((id) => id !== challenger.id).length === 0) {
      commit(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field.length])

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

  if (!opponent && !settled) return null

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
            Stop
          </Button>
        </>
      }
    >
      <div className="mb-6 flex items-center justify-center gap-3">
        <Eyebrow>
          <Scale className="size-3" aria-hidden />
          {remaining <= 1 ? 'Last question' : `About ${remaining} left`}
        </Eyebrow>
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
          media={opponent!}
          score={entryOf.get(opponent!.id)?.score ?? null}
          progress={entryOf.get(opponent!.id)?.progress ?? 0}
          kind={kind}
          language={language}
          side="right"
          rank={mid >= 0 ? field.indexOf(opponent!.id) + 1 : undefined}
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
