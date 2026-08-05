import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BookOpen, Check, ListPlus, Star, Trophy, Tv } from 'lucide-react'
import {
  BarRow,
  buttonClasses,
  CoverImage,
  CoverStack,
  EmptyState,
  Eyebrow,
  ProgressBar,
  Rail,
  ShelfRail,
  Rating,
  ScoreHistogram,
  Section,
  SectionHeader,
  usePageAccent,
  useResolvedTheme,
  ShelfLine,
  Skeleton,
  StatTile,
} from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { totalUnits, unitName, type MediaSummary } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import {
  airingQueue,
  almostDone,
  genreAffinity,
  groupByDay,
  useActivity,
  useAllEntries,
  useCollectionCoverIds,
  useCollections,
  useContinueList,
  useRatingDistribution,
  useRecentlyCompleted,
  useTrackedIds,
  useWeekStats,
} from '@/data/store/selectors'
import type { ActivityEvent, Collection } from '@/data/store/types'
import { FeatureCard, ShelfCover } from '@/features/tracking/cards'
import { useLibrary } from '@/data/store/library'
import { useAuth } from '@/data/supabase/auth'
import { SignInWall } from '@/features/auth/SignInWall'
import { airingDayShort, dayLabel, fullDate, greeting, timeLabel } from '@/lib/dates'
import { pluralize, scoreText } from '@/lib/format'
import { cn } from '@/lib/cn'

export default function DashboardPage() {
  const { signedOut } = useAuth()
  const profile = useLibrary((s) => s.profile)
  const trackedIds = useTrackedIds()
  const { map, isLoading } = useMediaMap(trackedIds)

  const continueList = useContinueList(9)
  const completed = useRecentlyCompleted(10)
  const week = useWeekStats()
  const activity = useActivity(60)
  const entries = useAllEntries()
  const distribution = useRatingDistribution()
  const collections = useCollections()

  const nearlyDone = useMemo(() => almostDone(entries, map, 3), [entries, map])
  const airing = useMemo(() => airingQueue(entries, map).slice(0, 12), [entries, map])
  const affinity = useMemo(() => genreAffinity(entries, map, 5), [entries, map])
  const days = useMemo(() => groupByDay(activity).slice(0, 4), [activity])

  const lead = continueList[0]
  const leadMedia = lead ? map.get(lead.mediaId) : undefined

  // The page is tinted by the thing you are currently watching, so Home is a
  // different color on Tuesday than it was on Monday.
  usePageAccent(leadMedia?.color, useResolvedTheme())
  const rest = continueList.slice(1, 4)
  const hasSideRows = rest.length > 0 || continueList.length > 4

  // The covers that stack behind the hero poster — the next few things waiting.
  const layered = useMemo(
    () =>
      continueList
        .slice(1, 4)
        .map((e) => map.get(e.mediaId))
        .filter(Boolean) as MediaSummary[],
    [continueList, map],
  )

  // Blank until someone names themselves — the greeting drops the name rather
  // than inventing one.
  const firstName = profile.displayName.trim().split(' ')[0] || null

  // Every panel here is a reflection of your own library, so signed out this
  // page is not a reduced version of itself — it is nine empty rectangles. The
  // wall is the honest render, and it points at the one place worth going.
  if (signedOut) {
    return (
      <SignInWall
        section="Home"
        headline="This page is made of your own shelf."
        aside="Nothing here is a chart of what's popular — it's what you're partway through, what you nearly finished, what you rated and when. Head to Discover to see the catalog without an account."
      >
        Continue watching, nearly finished, this week's numbers, the shape of your scores.
        All of it is derived from what you've tracked, which is why there's nothing to show
        until there's an account to track it against.
      </SignInWall>
    )
  }

  return (
    <div className="space-y-14 pt-1 md:space-y-16">
      <Masthead name={firstName} week={week} />

      {/* --------------------------------------------------- continue watching */}

      <Section>
        <SectionHeader
          title="Continue Watching"
          action={
            continueList.length > 0 ? (
              <Link to="/library?status=current" className="label-cat label-cat-plain hover:text-ink">
                All in progress
              </Link>
            ) : undefined
          }
        />

        {isLoading && continueList.length === 0 ? (
          <div className="grid gap-5 lg:grid-cols-12">
            <Skeleton className="h-[21rem] rounded-xl lg:col-span-7" />
            <div className="space-y-3 lg:col-span-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[5.5rem] rounded-lg" />
              ))}
            </div>
          </div>
        ) : continueList.length === 0 ? (
          <EmptyState
            icon={<Tv className="size-6" strokeWidth={1.5} />}
            title="Nothing in progress"
            action={
              <Link to="/discover" className={buttonClasses('primary', 'md')}>
                Find something
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-12">
            {leadMedia && lead && (
              <div className={cn('min-w-0', hasSideRows ? 'lg:col-span-7' : 'lg:col-span-12')}>
                <FeatureCard
                  media={leadMedia}
                  height="lg"
                  layered={layered}
                  eyebrow={`${unitName(leadMedia.kind)} ${lead.progress + 1}`}
                  blurb={<LeadProgress media={leadMedia} progress={lead.progress} />}
                  action={
                    <Link to={`/media/${leadMedia.id}`} className={buttonClasses('primary', 'lg')}>
                      Continue
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  }
                />
              </div>
            )}

            {/* Only rendered when it has something in it. An empty grid
                column is invisible in the markup and enormous on the page. */}
            <div
              className={cn(
                'flex min-w-0 flex-col gap-3 lg:col-span-5',
                !hasSideRows && 'hidden',
              )}
            >
              {rest.map((entry) => {
                const media = map.get(entry.mediaId)
                return media ? (
                  <SideRow key={entry.mediaId} media={media} progress={entry.progress} />
                ) : (
                  <Skeleton key={entry.mediaId} className="h-[5.5rem] rounded-lg" />
                )
              })}

              {continueList.length > 4 && (
                <Link
                  to="/library?status=current"
                  className="mt-auto flex items-center justify-between rounded-lg border border-dashed border-line px-4 py-3 text-label text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  <span className="font-mono-num">{continueList.length - 4} more</span>
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* --------------------------------------------------------- almost done */}

      {nearlyDone.length > 0 && (
        <Section>
          <SectionHeader title="Nearly Finished" size="sm" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {nearlyDone.slice(0, 6).map(({ entry, media, left }) => (
              <NearlyThereCard key={media.id} media={media} progress={entry.progress} left={left} />
            ))}
          </div>
        </Section>
      )}

      {/* -------------------------------------------------------------- airing */}

      {airing.length > 0 && (
        <Section>
          <SectionHeader title="Airing This Week" size="sm" />
          {/* Below four, a scrolling rail is one poster marooned in an empty
              row with scroll arrows for company. A plain grid fills left to
              right and simply stops. */}
          {airing.length < 4 ? (
            <div className="flex flex-wrap gap-5">
              {airing.map(({ media, airingAt, episode }) => (
                <div key={media.id} className="w-28 md:w-32">
                  <AiringCard media={media} airingAt={airingAt} episode={episode} />
                </div>
              ))}
            </div>
          ) : (
            <ShelfRail aria-label="Upcoming episodes" size="sm" gap="sm">
              {airing.map(({ media, airingAt, episode }) => (
                <AiringCard key={media.id} media={media} airingAt={airingAt} episode={episode} />
              ))}
            </ShelfRail>
          )}
        </Section>
      )}

      {/* --------------------------------------------------------- completed */}

      {completed.length > 0 && (
        <Section>
          <SectionHeader
            title="Recently Completed"
            size="sm"
            action={
              <Link
                to="/library?status=completed&sort=score"
                className="label-cat label-cat-plain hover:text-ink"
              >
                Highest rated
              </Link>
            }
          />
          <div>
            <Rail aria-label="Recently completed">
              {completed.map((entry) => {
                const media = map.get(entry.mediaId)
                return media ? (
                  <div key={entry.mediaId} className="flex w-32 shrink-0 flex-col md:w-38">
                    <ShelfCover media={media} entry={entry} />
                    <p className="label-cat label-cat-plain mt-2.5 truncate">
                      {entry.finishedAt ? fullDate(entry.finishedAt) : ''}
                    </p>
                  </div>
                ) : (
                  <Skeleton
                    key={entry.mediaId}
                    className="aspect-[2/3] w-32 shrink-0 rounded-art md:w-38"
                  />
                )
              })}
            </Rail>
            <ShelfLine className="mt-2" />
          </div>
        </Section>
      )}

      {/* -------------------------------------------------------- numbers row */}

      <section className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          <Eyebrow className="mb-5">This week</Eyebrow>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            <StatTile label="Episodes" value={week.episodes} icon={<Tv className="size-3.5" />} />
            <StatTile
              label="Chapters"
              value={week.chapters}
              icon={<BookOpen className="size-3.5" />}
            />
            <StatTile label="Finished" value={week.completed} icon={<Check className="size-3.5" />} />
            <StatTile label="Rated" value={week.rated} icon={<Star className="size-3.5" />} />
          </div>

          {affinity.length > 0 && (
            <div className="mt-10">
              <Eyebrow className="mb-4">Genres you rate highest</Eyebrow>
              <div className="space-y-2.5">
                {affinity.map((g) => (
                  <BarRow
                    key={g.genre}
                    label={g.genre}
            genre={g.genre}
                    value={g.averageScore ?? 0}
                    max={10}
                    readout={g.averageScore ? scoreText(g.averageScore) : '—'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 lg:col-span-5">
          <Eyebrow className="mb-5">Your scores</Eyebrow>
          {distribution.some(Boolean) ? (
            <ScoreHistogram distribution={distribution} />
          ) : (
            <p className="text-body text-ink-3">No scores yet.</p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------- diary + collections */}

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        <Section className="lg:col-span-7">
          <SectionHeader title="Activity" size="sm" bare />

          {days.length === 0 ? (
            <p className="text-body text-ink-3">Nothing logged yet.</p>
          ) : (
            <div className="space-y-7">
              {days.map(({ day, events }) => (
                <div key={day}>
                  <div className="mb-3 flex items-center gap-3">
                    <Eyebrow tick={false}>{dayLabel(day)}</Eyebrow>
                    <span className="h-px flex-1 bg-line" aria-hidden />
                  </div>
                  <ul className="space-y-0.5 border-l border-line pl-4">
                    {events.slice(0, 7).map((event) => (
                      <ActivityRow key={event.id} event={event} map={map} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section className="lg:col-span-5">
          <SectionHeader
            title="Your Collections"
            size="sm"
            action={
              <Link to="/collections" className="label-cat label-cat-plain hover:text-ink">
                All
              </Link>
            }
          />
          {collections.length === 0 ? (
            <Link
              to="/collections"
              className="flex items-center justify-between rounded-lg border border-dashed border-line px-4 py-4 text-label text-ink-2 transition-colors hover:border-accent-line hover:text-accent"
            >
              Start your first collection
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <div className="space-y-4">
              {collections.slice(0, 3).map((c) => (
                <CollectionStrip key={c.id} collection={c} map={map} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * The masthead.
 *
 * A greeting and the week in numbers — no generated sentence about how you're
 * doing. The date and the count are true; anything else would be filler.
 */
function Masthead({
  name,
  week,
}: {
  name: string | null
  week: { episodes: number; chapters: number; completed: number; rated: number }
}) {
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const figures = [
    week.episodes > 0 && pluralize(week.episodes, 'episode'),
    week.chapters > 0 && pluralize(week.chapters, 'chapter'),
    week.completed > 0 && `${week.completed} finished`,
  ].filter(Boolean) as string[]

  return (
    <header className="border-b border-line pb-8">
      <Eyebrow className="mb-4">{today}</Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <h1 className="text-display-lg text-balance text-ink md:text-display-xl">
          {name ? `${greeting()}, ${name}.` : `${greeting()}.`}
        </h1>
        {figures.length > 0 && (
          <p className="font-mono-num pb-2 text-meta text-ink-3">
            {figures.join(' · ')} <span className="text-ink-3/70">this week</span>
          </p>
        )}
      </div>
    </header>
  )
}

function LeadProgress({ media, progress }: { media: MediaSummary; progress: number }) {
  const total = totalUnits(media)
  return (
    <div className="max-w-xs space-y-2.5">
      <ProgressBar value={progress} max={total} size="md" />
      <p className="font-mono-num text-meta text-ink-3">
        {progress} / {total ?? '?'}
        {total ? ` · ${Math.round((progress / total) * 100)}%` : ''}
      </p>
    </div>
  )
}

/** The compact companion to the hero: art, title, and one bar. */
function SideRow({ media, progress }: { media: MediaSummary; progress: number }) {
  const language = usePrefs((s) => s.titleLanguage)
  const total = totalUnits(media)

  return (
    <Link
      to={`/media/${media.id}`}
      className="group/side frame-lift flex items-center gap-4 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong"
    >
      <div className="w-12 shrink-0">
        <CoverImage src={media.coverImage} alt="" color={media.color} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="truncate text-label font-medium text-ink transition-colors group-hover/side:text-accent">
          {displayTitle(media, language)}
        </p>
        <ProgressBar value={progress} max={total} />
        <p className="font-mono-num text-[0.625rem] text-ink-3">
          {progress}/{total ?? '?'}
        </p>
      </div>
    </Link>
  )
}

function AiringCard({
  media,
  airingAt,
  episode,
}: {
  media: MediaSummary
  airingAt: number
  episode: number
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const soon = airingAt * 1000 - Date.now() < 36 * 3_600_000

  return (
    <Link
      to={`/media/${media.id}`}
      className="group/air frame-lift w-32 shrink-0 md:w-36"
      title={displayTitle(media, language)}
    >
      <CoverImage src={media.coverImage} alt="" color={media.color}>
        <span
          className={cn(
            'font-mono-num absolute top-0 left-0 rounded-br-[7px] px-1.5 py-1 text-[0.625rem] font-semibold backdrop-blur-md',
            soon ? 'bg-accent/95 text-accent-ink' : 'bg-canvas/90 text-ink',
          )}
        >
          {airingDayShort(airingAt)}
        </span>
      </CoverImage>
      <p className="clamp-1 mt-2 text-label font-medium text-ink transition-colors group-hover/air:text-accent">
        {displayTitle(media, language)}
      </p>
      <p className="label-cat label-cat-plain mt-1">
        Ep {episode} · {timeLabel(airingAt * 1000)}
      </p>
    </Link>
  )
}

function NearlyThereCard({
  media,
  progress,
  left,
}: {
  media: MediaSummary
  progress: number
  left: number
}) {
  const language = usePrefs((s) => s.titleLanguage)
  const total = totalUnits(media)
  const unit = unitName(media.kind).toLowerCase()

  return (
    <Link
      to={`/media/${media.id}`}
      className="group/near frame-lift flex items-stretch gap-4 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
    >
      <div className="w-14 shrink-0">
        <CoverImage src={media.coverImage} alt="" color={media.color} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div className="min-w-0">
          <p className="clamp-2 text-label leading-snug font-medium text-ink transition-colors group-hover/near:text-accent">
            {displayTitle(media, language)}
          </p>
        </div>
        <div className="space-y-2">
          <ProgressBar value={progress} max={total} />
          <p className="flex items-baseline gap-1.5">
            <span className="font-mono-num text-display-sm leading-none font-semibold text-accent">
              {left}
            </span>
            <span className="label-cat label-cat-plain">
              {left === 1 ? `${unit} left` : `${unit}s left`}
            </span>
          </p>
        </div>
      </div>
    </Link>
  )
}

function CollectionStrip({
  collection,
  map,
}: {
  collection: Collection
  map: Map<number, MediaSummary>
}) {
  const ids = useCollectionCoverIds(collection.id, 4)
  const covers = ids
    .map((id) => map.get(id))
    .filter(Boolean)
    .map((m) => ({ id: m!.id, src: m!.coverImage, color: m!.color }))

  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group flex items-center gap-5 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
    >
      {covers.length > 0 ? (
        <CoverStack covers={covers} width={44} offset={13} className="shrink-0" />
      ) : (
        <div className="h-[66px] w-[44px] shrink-0 rounded-art border border-dashed border-line-strong" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-title font-semibold text-ink transition-colors group-hover:text-accent">
          {collection.name}
        </p>
        <p className="label-cat label-cat-plain mt-2">{pluralize(ids.length, 'title')}</p>
      </div>

      <ArrowRight
        className="size-4 shrink-0 text-ink-3 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink"
        aria-hidden
      />
    </Link>
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
    <li className="group relative flex items-baseline gap-3 py-1.5 text-body">
      <Icon
        className="size-3.5 shrink-0 translate-y-0.5 text-ink-3 transition-colors group-hover:text-accent"
        strokeWidth={1.8}
        aria-hidden
      />
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
        {event.type === 'score' && event.payload.to != null && (
          <Rating value={Number(event.payload.to)} size="xs" className="ml-2 translate-y-px" />
        )}
      </span>
      <time
        className="font-mono-num shrink-0 text-[0.625rem] text-ink-3"
        dateTime={new Date(event.createdAt).toISOString()}
      >
        {timeLabel(event.createdAt)}
      </time>
    </li>
  )
}

/** Plain past tense. A log, not a personality. */
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
      if (to === 'completed') return 'Completed'
      if (to === 'current') return kind === 'anime' ? 'Started watching' : 'Started reading'
      if (to === 'dropped') return 'Dropped'
      if (to === 'paused') return 'Paused'
      return 'Moved to planning —'
    }
    case 'score':
      return event.payload.to == null ? 'Cleared the score on' : 'Rated'
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
