import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Button,
  Chip,
  CoverImage,
  EmptyState,
  Eyebrow,
  IconButton,
  ProgressBar,
  Rail,
  Section,
  SectionHeader,
  Skeleton,
} from '@/design'
import { useAiringSchedule, useMediaMap, type AiringSlot } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { totalUnits, type MediaSummary } from '@/data/anilist/types'
import { useEntriesOfKind } from '@/data/store/selectors'
import { usePrefs } from '@/data/store/prefs'
import type { LibraryEntry } from '@/data/store/types'
import { cn } from '@/lib/cn'
import {
  countdown,
  dayMonth,
  startOfDay,
  startOfWeek,
  timeLabel,
  weekDays,
  weekRangeLabel,
  weekdayShort,
} from '@/lib/dates'

/**
 * The week, as it actually broadcasts.
 *
 * Every other page in this product is built from your own shelf. This one is
 * built from the clock, which makes it the only screen here that is about what
 * the world is doing rather than what you have done — so the two have to be
 * told apart on sight, and they are: anything you track is drawn in full, with
 * its accent spine and the episode number you are actually up to, and
 * everything else is drawn quietly beside it.
 *
 * ------------------------------------------------------------------ two feeds
 *
 * The band at the top and the grid below it come from different places on
 * purpose:
 *
 *   THE BAND   your library's own `nextAiringEpisode`, which is already loaded
 *              and needs no request. It answers "what am I waiting for", which
 *              is not a question about this week — the next episode of
 *              something you're mid-way through might be eleven days out.
 *   THE GRID   upstream's broadcast schedule for the seven days on screen.
 *              It answers "what is on", which is a question about exactly
 *              this week and about titles you have never heard of.
 *
 * Deriving one from the other would break whichever question it wasn't built
 * for, which is what a single merged list did the first time.
 */
export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(Date.now()))
  const [mineOnly, setMineOnly] = useState(false)

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const windowEnd = useMemo(() => {
    const d = new Date(days[6])
    d.setDate(d.getDate() + 1)
    return d.getTime()
  }, [days])

  const { data: slots, isLoading, isError } = useAiringSchedule(weekStart, windowEnd)

  /* Which of these are yours. Anime only — nothing else has a broadcast. */
  const entries = useEntriesOfKind('anime')
  const tracked = useMemo(() => {
    const byId = new Map<number, LibraryEntry>()
    for (const e of entries) byId.set(e.mediaId, e)
    return byId
  }, [entries])

  const visible = useMemo(
    () => (mineOnly ? (slots ?? []).filter((s) => tracked.has(s.media.id)) : (slots ?? [])),
    [slots, mineOnly, tracked],
  )

  const mineThisWeek = useMemo(
    () => (slots ?? []).filter((s) => tracked.has(s.media.id)).length,
    [slots, tracked],
  )

  const byDay = useMemo(() => {
    const buckets = new Map<number, AiringSlot[]>(days.map((d) => [d, []]))
    for (const slot of visible) {
      const day = startOfDay(slot.airingAt * 1000)
      buckets.get(day)?.push(slot)
    }
    for (const list of buckets.values()) list.sort((a, b) => a.airingAt - b.airingAt)
    return buckets
  }, [visible, days])

  const thisWeek = startOfWeek(Date.now())
  const today = startOfDay(Date.now())

  return (
    <div className="space-y-12 pt-1">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-7">
        <h1 className="text-display-lg text-ink">Calendar</h1>

        <div className="flex items-center gap-3 pb-1">
          {weekStart !== thisWeek && (
            <Button size="sm" onClick={() => setWeekStart(thisWeek)}>
              This week
            </Button>
          )}
          <div className="flex items-center gap-1.5">
            <IconButton
              label="Previous week"
              icon={<ChevronLeft className="size-4" />}
              size="sm"
              onClick={() => setWeekStart(startOfWeek(weekStart - 3 * 86_400_000))}
            />
            <span className="font-mono-num min-w-38 text-center text-label font-medium text-ink">
              {weekRangeLabel(weekStart)}
            </span>
            <IconButton
              label="Next week"
              icon={<ChevronRight className="size-4" />}
              size="sm"
              onClick={() => setWeekStart(startOfWeek(weekStart + 10 * 86_400_000))}
            />
          </div>
        </div>
      </header>

      <NextUpBand />

      <Section>
        <SectionHeader
          title="On air"
          size="sm"
          action={
            <div className="flex items-center gap-2">
              <Chip active={!mineOnly} onClick={() => setMineOnly(false)}>
                Everything
                {slots && <span className="font-mono-num ml-1.5 opacity-60">{slots.length}</span>}
              </Chip>
              <Chip active={mineOnly} onClick={() => setMineOnly(true)}>
                On my shelf
                {slots && <span className="font-mono-num ml-1.5 opacity-60">{mineThisWeek}</span>}
              </Chip>
            </div>
          }
        />

        {isError ? (
          <EmptyState
            icon={<CalendarDays className="size-6" strokeWidth={1.5} />}
            title="The schedule didn't load"
            description="The catalog is rate-limited. Give it a minute and come back."
          />
        ) : isLoading ? (
          <WeekSkeleton days={days} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" strokeWidth={1.5} />}
            title={mineOnly ? 'Nothing of yours airs this week' : 'Nothing airs this week'}
            description={
              mineOnly
                ? 'Everything on your shelf is either finished or between seasons.'
                : undefined
            }
          />
        ) : (
          <div className="space-y-9">
            {days.map((day) => {
              const list = byDay.get(day) ?? []
              if (list.length === 0) return null

              return (
                <DayGroup
                  key={day}
                  day={day}
                  today={day === today}
                  slots={list}
                  tracked={tracked}
                />
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

/* -------------------------------------------------------------- next up -- */

/**
 * What you are actually waiting for.
 *
 * Deliberately not bounded by the week on screen: paging forward to look at
 * next Thursday should not change the answer to "when is the next episode of
 * the thing I'm watching". It reads straight off the library's own media, which
 * is already in memory, so this band costs nothing and is the one part of the
 * page that is filled in before the schedule request has even left.
 */
function NextUpBand() {
  const language = usePrefs((s) => s.titleLanguage)
  const entries = useEntriesOfKind('anime')

  const ids = useMemo(
    () => entries.filter((e) => e.status === 'current' || e.status === 'planning').map((e) => e.mediaId),
    [entries],
  )
  const { map } = useMediaMap(ids)

  // Re-renders once a minute so the countdowns stay honest without a timer per
  // card. Nothing here is finer-grained than minutes, so this is exact.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const queue = useMemo(() => {
    const out: { entry: LibraryEntry; media: MediaSummary }[] = []
    for (const entry of entries) {
      if (entry.status !== 'current' && entry.status !== 'planning') continue
      const media = map.get(entry.mediaId)
      if (!media?.nextAiringEpisode) continue
      out.push({ entry, media })
    }
    return out.sort(
      (a, b) => a.media.nextAiringEpisode!.airingAt - b.media.nextAiringEpisode!.airingAt,
    )
  }, [entries, map])

  if (queue.length === 0) return null

  return (
    <Section>
      <SectionHeader
        eyebrow="Your shelf"
        title="Next episode"
        size="sm"
        action={
          <span className="label-cat label-cat-plain">
            {queue.length} airing
          </span>
        }
      />

      <Rail aria-label="Next episode of everything you're watching">
        {queue.map(({ entry, media }) => {
          const next = media.nextAiringEpisode!
          const soon = next.airingAt * 1000 - Date.now() < 24 * 3_600_000
          const total = totalUnits(media)
          const behind = next.episode - 1 - entry.progress

          return (
            <Link
              key={media.id}
              to={`/media/${media.id}`}
              className="group/next frame-lift w-44 shrink-0 md:w-52"
              title={displayTitle(media, language)}
            >
              <CoverImage src={media.coverImage} alt="" color={media.color}>
                <span
                  className={cn(
                    'font-mono-num absolute top-0 left-0 rounded-br-[7px] px-2 py-1 text-[0.6875rem] font-semibold backdrop-blur-md',
                    soon ? 'bg-accent/95 text-accent-ink' : 'bg-canvas/90 text-ink',
                  )}
                >
                  {countdown(next.airingAt)}
                </span>
              </CoverImage>

              <p className="clamp-1 mt-2.5 text-label font-medium text-ink transition-colors group-hover/next:text-accent">
                {displayTitle(media, language)}
              </p>

              <p className="font-mono-num mt-1 text-meta text-ink-2">
                Ep {next.episode} · {timeLabel(next.airingAt * 1000)}
              </p>

              <div className="mt-2 space-y-1.5">
                <ProgressBar value={entry.progress} max={total} />
                {/* The number that actually decides whether you open the app
                    tonight: not "episode 9 airs Friday" but "you are four
                    behind". Silent when you are caught up, because then the
                    airing time is the whole story. */}
                <p className="label-cat label-cat-plain">
                  {behind > 0
                    ? `${behind} to catch up`
                    : entry.status === 'planning'
                      ? 'Not started'
                      : 'Caught up'}
                </p>
              </div>
            </Link>
          )
        })}
      </Rail>
    </Section>
  )
}

/* ------------------------------------------------------------------ day -- */

function DayGroup({
  day,
  today,
  slots,
  tracked,
}: {
  day: number
  today: boolean
  slots: AiringSlot[]
  tracked: Map<number, LibraryEntry>
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className={cn('text-display-sm', today ? 'text-accent' : 'text-ink')}>
          {weekdayShort(day)}
        </h3>
        <span className="font-mono-num text-meta text-ink-3">{dayMonth(day)}</span>
        {today && <Eyebrow>Today</Eyebrow>}
        <span className="hidden h-px min-w-8 flex-1 translate-y-[-0.35em] bg-line sm:block" aria-hidden />
        <span className="font-mono-num text-meta text-ink-3">{slots.length}</span>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => (
          <SlotRow key={slot.id} slot={slot} entry={tracked.get(slot.media.id)} />
        ))}
      </ul>
    </section>
  )
}

/**
 * One broadcast.
 *
 * Titles you track carry an accent spine down their left edge and their own
 * progress under the episode number; the rest are the same row with the colour
 * taken out. Same shape, different weight — which is what lets you find your
 * four shows in a Saturday of thirty without reading any of the other
 * twenty-six.
 */
function SlotRow({ slot, entry }: { slot: AiringSlot; entry?: LibraryEntry }) {
  const language = usePrefs((s) => s.titleLanguage)
  const { media, episode, airingAt } = slot
  const mine = Boolean(entry)
  const total = totalUnits(media)
  const behind = entry ? episode - 1 - entry.progress : 0

  return (
    <li>
      <Link
        to={`/media/${media.id}`}
        className={cn(
          'group/slot relative flex items-center gap-3 overflow-hidden rounded-lg border p-2.5',
          'transition-colors duration-200',
          mine
            ? 'border-line-strong bg-surface hover:border-accent-line'
            : 'border-line bg-surface/50 hover:border-line-strong',
        )}
      >
        {mine && (
          <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />
        )}

        <div className={cn('w-10 shrink-0', mine && 'ml-1')}>
          <CoverImage src={media.coverImage} alt="" color={media.color} flat />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-label transition-colors group-hover/slot:text-accent',
              mine ? 'font-medium text-ink' : 'text-ink-2',
            )}
          >
            {displayTitle(media, language)}
          </p>

          <p className="font-mono-num mt-0.5 flex items-center gap-2 text-meta text-ink-3">
            <span>Ep {episode}</span>
            <span aria-hidden>·</span>
            <span>{timeLabel(airingAt * 1000)}</span>
            {mine && behind > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-paused">{behind} behind</span>
              </>
            )}
          </p>

          {mine && entry && (
            <ProgressBar value={entry.progress} max={total} className="mt-1.5" />
          )}
        </div>
      </Link>
    </li>
  )
}

/* ------------------------------------------------------------- skeleton -- */

function WeekSkeleton({ days }: { days: number[] }) {
  return (
    <div className="space-y-9">
      {days.slice(0, 3).map((day) => (
        <section key={day}>
          <div className="mb-4 flex items-baseline gap-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-lg" />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
