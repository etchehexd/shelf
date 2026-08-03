import { useMemo } from 'react'
import { Link } from 'react-router'
import { BookOpen, Check, ListPlus, Star, Trophy, Tv } from 'lucide-react'
import {
  BarRow,
  CoverSkeleton,
  EmptyState,
  Rail,
  Section,
  SectionHeader,
  Skeleton,
  StatTile,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import {
  genreAffinity,
  groupByDay,
  useActivity,
  useAllEntries,
  useContinueList,
  useRatingDistribution,
  useRecentlyCompleted,
  useTrackedIds,
  useWeekStats,
} from '@/data/store/selectors'
import type { ActivityEvent } from '@/data/store/types'
import { statusLabel } from '@/data/store/types'
import { ContinueCard, ShelfCover } from '@/features/tracking/cards'
import { dayLabel, greeting, timeLabel } from '@/lib/dates'
import { pluralize, scoreText } from '@/lib/format'
import { useLibrary } from '@/data/store/library'

export default function DashboardPage() {
  const profile = useLibrary((s) => s.profile)
  const trackedIds = useTrackedIds()
  const { map, isLoading } = useMediaMap(trackedIds)

  const continueList = useContinueList(10)
  const completed = useRecentlyCompleted(14)
  const week = useWeekStats()
  const activity = useActivity(60)
  const entries = useAllEntries()
  const distribution = useRatingDistribution()

  const affinity = useMemo(() => genreAffinity(entries, map, 6), [entries, map])
  const days = useMemo(() => groupByDay(activity).slice(0, 6), [activity])

  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const hasLibrary = entries.length > 0

  return (
    <div className="space-y-16">
      <header className="flex flex-wrap items-baseline justify-between gap-3 pt-2">
        <h1 className="font-display text-display-lg text-ink">
          {greeting()}, {profile.displayName.split(' ')[0]}.
        </h1>
        <p className="text-body text-ink-3">{today}</p>
      </header>

      {/* ---------------------------------------------------------- continue */}

      <Section>
        <SectionHeader
          eyebrow="Continue"
          title="Pick up where you left off"
          action={
            continueList.length > 0 ? (
              <Link to="/library?status=current" className="text-label text-ink-3 hover:text-ink">
                All in progress
              </Link>
            ) : undefined
          }
        />

        {isLoading && continueList.length === 0 ? (
          <div className="flex gap-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[124px] w-80 shrink-0 rounded-lg" />
            ))}
          </div>
        ) : continueList.length === 0 ? (
          <EmptyState
            icon={<Tv className="size-7" strokeWidth={1.5} />}
            title="Nothing in progress"
            description={
              hasLibrary
                ? 'Start something from your planning list and it will show up here.'
                : 'Add a few titles and your shelf starts filling itself in.'
            }
            action={
              <Link
                to="/discover"
                className="inline-flex h-9.5 items-center rounded-md bg-accent px-4 text-label font-medium text-accent-ink hover:bg-accent-hover"
              >
                Find something to watch
              </Link>
            }
          />
        ) : (
          <Rail aria-label="Continue watching and reading">
            {continueList.map((entry) => {
              const media = map.get(entry.mediaId)
              return media ? (
                <ContinueCard key={entry.mediaId} media={media} entry={entry} />
              ) : (
                <Skeleton key={entry.mediaId} className="h-[124px] w-80 shrink-0 rounded-lg" />
              )
            })}
          </Rail>
        )}
      </Section>

      {/* -------------------------------------------------- activity + stats */}

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <Section className="lg:col-span-7">
          <SectionHeader eyebrow="Activity" title="Your journey" size="sm" />

          {days.length === 0 ? (
            <p className="py-8 text-body text-ink-3">
              Nothing yet. Updating progress, rating and collecting all show up here.
            </p>
          ) : (
            <div className="space-y-8">
              {days.map(({ day, events }) => (
                <div key={day}>
                  <h3 className="mb-3 text-micro text-ink-3 uppercase">{dayLabel(day)}</h3>
                  <ul className="space-y-0.5">
                    {events.slice(0, 8).map((event) => (
                      <ActivityRow key={event.id} event={event} map={map} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="space-y-10 lg:col-span-5">
          <Section>
            <SectionHeader eyebrow="This week" title="At a glance" size="sm" />
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="Episodes"
                value={week.episodes}
                icon={<Tv className="size-3.5" />}
                hint={week.episodes === 0 ? 'Nothing yet' : 'watched'}
              />
              <StatTile
                label="Chapters"
                value={week.chapters}
                icon={<BookOpen className="size-3.5" />}
                hint={week.chapters === 0 ? 'Nothing yet' : 'read'}
              />
              <StatTile
                label="Finished"
                value={week.completed}
                icon={<Check className="size-3.5" />}
                hint={pluralize(week.completed, 'title')}
              />
              <StatTile
                label="Rated"
                value={week.rated}
                icon={<Star className="size-3.5" />}
                hint={pluralize(week.rated, 'title')}
              />
            </div>
          </Section>

          <Section>
            <SectionHeader eyebrow="Ratings" title="How you score" size="sm" />
            <RatingHistogram distribution={distribution} />
          </Section>

          {affinity.length > 0 && (
            <Section>
              <SectionHeader eyebrow="Taste" title="Your genres" size="sm" />
              <div className="space-y-2.5">
                {affinity.map((g) => (
                  <BarRow
                    key={g.genre}
                    label={g.genre}
                    value={g.averageScore ?? 0}
                    max={10}
                    readout={g.averageScore ? scoreText(g.averageScore) : '—'}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- completed */}

      {completed.length > 0 && (
        <Section>
          <SectionHeader
            eyebrow="Recently finished"
            title="On the shelf"
            action={
              <Link to="/library?status=completed" className="text-label text-ink-3 hover:text-ink">
                See all
              </Link>
            }
          />
          <Rail aria-label="Recently completed">
            {completed.map((entry) => {
              const media = map.get(entry.mediaId)
              return media ? (
                <ShelfCover key={entry.mediaId} media={media} entry={entry} />
              ) : (
                <div key={entry.mediaId} className="w-36 shrink-0 md:w-40">
                  <CoverSkeleton />
                </div>
              )
            })}
          </Rail>
        </Section>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function RatingHistogram({ distribution }: { distribution: number[] }) {
  const max = Math.max(1, ...distribution)
  const total = distribution.reduce((a, b) => a + b, 0)

  if (total === 0) {
    return <p className="text-body text-ink-3">Rate a few titles and your curve appears here.</p>
  }

  return (
    <div>
      <div className="flex h-24 items-end gap-1.5">
        {distribution.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-[3px] bg-accent transition-[height] duration-500"
              style={{ height: `${Math.max(count === 0 ? 2 : 8, (count / max) * 100)}%`, opacity: count === 0 ? 0.18 : 1 }}
              title={`${count} rated ${i + 1}`}
            />
            <span className="tnum text-micro text-ink-3">{i + 1}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-meta text-ink-3">{pluralize(total, 'title')} rated</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const ACTIVITY_ICON = {
  progress: Tv,
  status: Check,
  score: Star,
  rank: Trophy,
  collection: ListPlus,
  note: Star,
  added: ListPlus,
  removed: ListPlus,
} as const

function ActivityRow({ event, map }: { event: ActivityEvent; map: Map<number, MediaSummary> }) {
  const language = usePrefs((s) => s.titleLanguage)
  const media = event.mediaId ? map.get(event.mediaId) : null
  const title = media ? displayTitle(media, language) : null
  const Icon = ACTIVITY_ICON[event.type] ?? Tv

  const body = describe(event, title)
  if (!body) return null

  return (
    <li className="group flex items-baseline gap-3 rounded-md py-1.5 text-body">
      <Icon className="size-3.5 shrink-0 translate-y-0.5 text-ink-3" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1 text-ink-2">
        {body}
        {event.mediaId && title && (
          <>
            {' '}
            <Link
              to={`/media/${event.mediaId}`}
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              {title}
            </Link>
          </>
        )}
      </span>
      <time className="tnum shrink-0 text-meta text-ink-3" dateTime={new Date(event.createdAt).toISOString()}>
        {timeLabel(event.createdAt)}
      </time>
    </li>
  )
}

/** Phrasing reads as a diary, not a changelog. */
function describe(event: ActivityEvent, title: string | null): string | null {
  const kind = event.kind === 'anime' ? 'anime' : 'manga'

  switch (event.type) {
    case 'progress': {
      const to = Number(event.payload.to ?? 0)
      const isVolume = event.payload.unit === 'volume'
      const unit = isVolume ? 'volume' : kind === 'anime' ? 'episode' : 'chapter'
      const verb = kind === 'anime' && !isVolume ? 'Watched' : 'Read'
      return `${verb} ${unit} ${to} of`
    }
    case 'status': {
      const to = String(event.payload.to)
      if (to === 'completed') return 'Finished'
      if (to === 'current') return kind === 'anime' ? 'Started watching' : 'Started reading'
      if (to === 'dropped') return 'Dropped'
      if (to === 'paused') return 'Paused'
      return `Moved to ${statusLabel('planning', 'anime').toLowerCase()}`
    }
    case 'score':
      return event.payload.to == null
        ? 'Cleared the rating on'
        : `Rated ${scoreText(Number(event.payload.to))} —`
    case 'rank':
      return event.payload.to == null ? 'Removed the ranking on' : `Ranked #${event.payload.to} —`
    case 'added':
      return 'Added'
    case 'removed':
      return title ? 'Removed' : null
    case 'note':
      return 'Wrote a note on'
    case 'collection': {
      const name = event.payload.collectionName as string | undefined
      if (event.payload.to === 'created') return `Created the collection ${name ?? ''}`.trim()
      if (event.payload.to === 'deleted') return `Deleted the collection ${name ?? ''}`.trim()
      return `Added to ${name ?? 'a collection'} —`
    }
    default:
      return null
  }
}
