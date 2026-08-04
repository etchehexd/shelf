import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  ChevronDown,
  Heart,
  ListPlus,
  Lock,
  Repeat,
  Trophy,
} from 'lucide-react'
import {
  Button,
  Card,
  CommunityScore,
  CoverImage,
  CoverSkeleton,
  Eyebrow,
  Pill,
  ProgressBar,
  ProgressStepper,
  Rail,
  Rating,
  RatingInput,
  ratingWord,
  Section,
  SectionHeader,
  Skeleton,
  useResolvedTheme,
} from '@/design'
import { useMedia } from '@/data/anilist/hooks'
import { displayTitle, subTitle } from '@/data/anilist/normalize'
import { KIND_LABEL_SINGULAR, tracksVolumes, unitName, type Media } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { useCollectionsContaining, useMediaActivity, useRank } from '@/data/store/selectors'
import { canRate, statusLabel } from '@/data/store/types'
import { useTracking } from '@/features/tracking/useTracking'
import { RankDialog, RatePopover, StatusMenu, StatusDot } from '@/features/tracking/controls'
import { MediaCard } from '@/features/tracking/cards'
import { AddToCollectionDialog } from '@/features/tracking/AddToCollectionDialog'
import { artAccent, artAccentQuiet, artScrim } from '@/lib/accent'
import { cn } from '@/lib/cn'
import { airingLabel, dayLabel, fullDate } from '@/lib/dates'
import { compactNumber, humanize, ordinal, pluralize, stripHtml } from '@/lib/format'

export default function MediaPage() {
  const { id } = useParams()
  const mediaId = Number(id)
  const { data: media, isLoading, isError } = useMedia(mediaId)
  const theme = useResolvedTheme()

  const accent = artAccent(media?.color, theme)
  const accentQuiet = artAccentQuiet(media?.color, theme)
  const scrim = artScrim(media?.color, theme)

  if (isLoading) return <MediaPageSkeleton />
  if (isError || !media) {
    return (
      <div className="py-24 text-center">
        <p className="text-display-md text-ink">Couldn't load this one</p>
        <p className="mt-2 text-body text-ink-2">Your library is untouched. Try again in a moment.</p>
      </div>
    )
  }

  return (
    <div
      // Published once here; every descendant reads var(--art-accent) rather
      // than threading a color prop through the tree.
      style={
        {
          ...(accent ? { '--art-accent': accent } : {}),
          ...(accentQuiet ? { '--art-accent-quiet': accentQuiet } : {}),
        } as React.CSSProperties
      }
      className="bleed-x -mt-6"
    >
      <Banner media={media} scrim={scrim} />

      <div className="mx-auto w-full max-w-(--container-page) px-5 md:px-10">
        <Hero media={media} />
        <Body media={media} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ banner -- */

function Banner({ media, scrim }: { media: Media; scrim: string | null }) {
  return (
    <div className="relative h-56 w-full overflow-hidden md:h-[22rem]" aria-hidden>
      {media.bannerImage ? (
        <img
          src={media.bannerImage}
          alt=""
          className="size-full scale-105 object-cover object-center"
          fetchPriority="high"
        />
      ) : (
        <div className="size-full" style={{ background: scrim ?? 'var(--surface-2)' }} />
      )}

      {/* Fades the artwork into the page rather than cutting it off. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgb(var(--scrim) / 0.08) 0%, rgb(var(--scrim) / 0.55) 52%, rgb(var(--scrim) / 1) 100%)',
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- hero -- */

function Hero({ media }: { media: Media }) {
  const language = usePrefs((s) => s.titleLanguage)
  const { entry, inLibrary, total, setProgress, setVolumes, add, addRepeat, toggleFavorite } =
    useTracking(media)
  const rank = useRank(media.kind, media.id)
  const collections = useCollectionsContaining(media.id)
  const [rankOpen, setRankOpen] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)

  const title = displayTitle(media, language)
  const sub = subTitle(media, language)
  const studio = media.studios.find((s) => s.isMain)?.name
  const unlocked = canRate(entry?.status)

  const meta = [
    KIND_LABEL_SINGULAR[media.kind],
    humanize(media.format),
    media.seasonYear,
    studio,
  ].filter(Boolean)

  return (
    <div className="relative -mt-24 grid gap-6 md:-mt-28 md:grid-cols-[212px_1fr] md:gap-9">
      <div className="w-32 md:w-[212px]">
        <div className="frame-lift">
          <CoverImage
            src={media.coverImageLarge}
            alt={title}
            color={media.color}
            priority
            className="shadow-lg"
          />
        </div>

        <div className="mt-5 hidden flex-col gap-2 md:flex">
          {!inLibrary ? (
            <Button variant="art" block onClick={() => add()}>
              Add to library
            </Button>
          ) : (
            <StatusMenu
              media={media}
              trigger={
                <Button
                  block
                  icon={<StatusDot status={entry?.status ?? 'planning'} />}
                  trailing={<ChevronDown className="ml-auto size-4" />}
                >
                  {statusLabel(entry?.status ?? 'planning', media.kind)}
                </Button>
              }
            />
          )}

          {/* One click, one dialog. Search, tick as many shelves as you like,
              and make a new one without leaving. */}
          <Button
            block
            icon={<ListPlus className="size-4" />}
            onClick={() => setCollectOpen(true)}
          >
            Add to Collection
          </Button>
        </div>
      </div>

      <div className="min-w-0 pt-2 md:pt-28">
        <p className="label-cat">{meta.join(' · ')}</p>

        <h1 className="mt-3 text-balance text-display-lg text-ink md:text-display-xl">{title}</h1>
        {sub && <p className="mt-2.5 text-body text-ink-3">{sub}</p>}

        {media.nextAiringEpisode && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-art/40 bg-art-quiet px-3.5 py-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-art" aria-hidden />
            <span className="text-meta font-medium text-ink">
              Episode {media.nextAiringEpisode.episode} · {airingLabel(media.nextAiringEpisode.airingAt)}
            </span>
          </p>
        )}

        {/* The two numbers, side by side and impossible to confuse: a neutral
            ring out of 100 for everyone else, ember stars out of 10 for you. */}
        <div className="mt-7 flex flex-wrap items-stretch gap-x-8 gap-y-5">
          {media.averageScore != null && (
            <div className="flex items-center gap-3 pr-8 sm:border-r sm:border-line">
              <CommunityScore value={media.averageScore} variant="hero" />
              {media.popularity > 0 && (
                <span className="label-cat label-cat-plain self-end pb-0.5">
                  {compactNumber(media.popularity)} tracking
                </span>
              )}
            </div>
          )}

          <RatePopover
            media={media}
            trigger={
              <button
                type="button"
                className="group/rate flex items-center gap-3 rounded-sm"
                aria-label="Your score"
              >
                <Rating value={entry?.score ?? null} size="lg" art />
                <span className="flex flex-col items-start">
                  <span className="font-mono-num text-display-sm leading-none font-semibold text-ink">
                    {entry?.score ?? '—'}
                    <span className="text-ink-3">/10</span>
                  </span>
                  <span className="label-cat label-cat-plain mt-1 flex items-center gap-1.5">
                    {!unlocked && entry?.score == null && <Lock className="size-2.5" aria-hidden />}
                    {entry?.score != null ? `Yours · ${ratingWord(entry.score)}` : unlocked ? 'Your score' : 'Finish to score'}
                  </span>
                </span>
              </button>
            }
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3">
          <button
            type="button"
            onClick={() => setRankOpen(true)}
            className="flex items-center gap-2 rounded-sm text-label text-ink-2 hover:text-ink"
          >
            <Trophy className="size-4 text-ink-3" aria-hidden />
            {rank ? (
              <span>
                <span className="font-medium text-ink">{ordinal(rank)}</span> in your{' '}
                {KIND_LABEL_SINGULAR[media.kind].toLowerCase()}
              </span>
            ) : (
              'Rank it'
            )}
          </button>

          {entry && (
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={entry.favorite}
              className="flex items-center gap-2 rounded-sm text-label text-ink-2 hover:text-ink"
            >
              <Heart
                className={cn(
                  'size-4 transition-transform duration-300',
                  entry.favorite ? 'scale-110 fill-current text-dropped' : 'text-ink-3',
                )}
                aria-hidden
              />
              {entry.favorite ? 'Favorite' : 'Add to favorites'}
            </button>
          )}

          {collections.length > 0 && (
            <span className="flex flex-wrap items-center gap-2">
              {collections.map((c) => (
                <Link key={c.id} to={`/collections/${c.id}`}>
                  <Pill tone="art" size="sm">
                    {c.name}
                  </Pill>
                </Link>
              ))}
            </span>
          )}
        </div>

        {/* The tracking panel — the thing people came here to touch. */}
        {inLibrary && (
          <Card padding="compact" radius="lg" className="mt-7 max-w-2xl">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <Eyebrow className="mb-3">Progress</Eyebrow>
                <ProgressStepper
                  value={entry?.progress ?? 0}
                  max={total}
                  unit={unitName(media.kind)}
                  onChange={setProgress}
                  size="lg"
                  art
                />
              </div>

              {tracksVolumes(media.kind) && (
                <div>
                  <Eyebrow className="mb-3">Volume</Eyebrow>
                  <ProgressStepper
                    value={entry?.progressVolumes ?? 0}
                    max={media.volumes}
                    unit="Volume"
                    onChange={setVolumes}
                  />
                </div>
              )}

              {entry?.status === 'completed' && (
                <Button size="sm" icon={<Repeat className="size-4" />} onClick={addRepeat}>
                  {entry.repeats > 0 ? `Rewatch ${entry.repeats + 1}` : 'Rewatch'}
                </Button>
              )}
            </div>

            <ProgressBar value={entry?.progress ?? 0} max={total} size="lg" art className="mt-5" />

            <p className="font-mono-num mt-3 text-meta text-ink-3">
              {total
                ? `${Math.round(((entry?.progress ?? 0) / total) * 100)}%`
                : pluralize(entry?.progress ?? 0, unitName(media.kind).toLowerCase())}
            </p>

            {entry?.note && (
              <p className="mt-4 border-l-2 border-art pl-4 text-body text-ink-2 italic">
                {entry.note}
              </p>
            )}
          </Card>
        )}

        {/* Mobile actions — the sidebar column is hidden below md. */}
        <div className="mt-5 flex flex-wrap gap-2 md:hidden">
          {!inLibrary ? (
            <Button variant="art" onClick={() => add()}>
              Add to library
            </Button>
          ) : (
            <StatusMenu
              media={media}
              trigger={
                <Button icon={<StatusDot status={entry?.status ?? 'planning'} />}>
                  {statusLabel(entry?.status ?? 'planning', media.kind)}
                </Button>
              }
            />
          )}
          <Button icon={<ListPlus className="size-4" />} onClick={() => setCollectOpen(true)}>
            Collection
          </Button>
        </div>
      </div>

      <RankDialog media={media} open={rankOpen} onClose={() => setRankOpen(false)} />
      <AddToCollectionDialog
        media={media}
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- body -- */

function Body({ media }: { media: Media }) {
  const history = useMediaActivity(media.id, 20)
  const { entry, canRate: unlocked, setScore } = useTracking(media)
  const [expanded, setExpanded] = useState(false)

  const synopsis = useMemo(() => stripHtml(media.description), [media.description])
  const isLong = synopsis.length > 420

  return (
    <div className="mt-16 grid gap-12 pb-10 lg:grid-cols-12 lg:gap-14">
      <div className="min-w-0 space-y-16 lg:col-span-8">
        {synopsis && (
          <Section>
            <SectionHeader title="Synopsis" size="sm" />
            <div className="prose-width">
              <p
                className={cn(
                  'text-body whitespace-pre-line text-ink-2',
                  !expanded && isLong && 'line-clamp-6',
                )}
              >
                {synopsis}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="label-cat label-cat-plain mt-3 text-art hover:underline"
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {media.genres.map((g) => (
                <Link key={g} to={`/discover?genre=${encodeURIComponent(g)}`}>
                  <Pill>{g}</Pill>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* The rating control is the most polished thing in the app, so on the
            media page it gets its own block rather than hiding in a popover —
            but only once the title has actually been finished. */}
        {unlocked && (
          <Section>
            <SectionHeader title="Your Score" size="sm" />
            <Card tone="sunk" radius="lg" padding="compact" className="max-w-xl">
              <RatingInput
                value={entry?.score ?? null}
                onChange={setScore}
                size="xl"
                art
                label={`Rate ${media.title.romaji}`}
              />
              <p className="mt-4 text-meta text-ink-3">
                Click a star, or press a number key.
              </p>
            </Card>
          </Section>
        )}

        {history.length > 0 && (
          <Section>
            <SectionHeader title="History" size="sm" />
            <ol className="space-y-0 border-l border-line pl-5">
              {history.map((e) => (
                <li key={e.id} className="relative flex items-baseline gap-4 py-2 text-body">
                  <span
                    className="absolute -left-[1.4rem] top-[0.85rem] size-1.5 rounded-full bg-line-strong"
                    aria-hidden
                  />
                  <span className="label-cat label-cat-plain w-24 shrink-0">{dayLabel(e.createdAt)}</span>
                  <span className="text-ink-2">{describeHistory(e.type, e.payload, media)}</span>
                </li>
              ))}
            </ol>
            {entry && (
              <p className="font-mono-num pt-2 text-meta text-ink-3">
                Added {fullDate(entry.createdAt)}
                {entry.startedAt && ` · started ${fullDate(entry.startedAt)}`}
                {entry.finishedAt && ` · finished ${fullDate(entry.finishedAt)}`}
              </p>
            )}
          </Section>
        )}

        {media.characters.length > 0 && (
          <Section>
            <SectionHeader title="Characters" size="sm" />
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {media.characters.slice(0, 10).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-md py-1.5 transition-colors hover:bg-surface-2/70"
                >
                  <img
                    src={c.image ?? ''}
                    alt=""
                    loading="lazy"
                    className="size-11 shrink-0 rounded-[3px] bg-surface-2 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label font-medium text-ink">{c.name}</p>
                    <p className="label-cat label-cat-plain truncate">{humanize(c.role)}</p>
                  </div>
                  {c.voiceActor && (
                    <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 sm:flex">
                      <p className="truncate text-right text-meta text-ink-3">{c.voiceActor.name}</p>
                      <img
                        src={c.voiceActor.image ?? ''}
                        alt=""
                        loading="lazy"
                        className="size-11 shrink-0 rounded-[3px] bg-surface-2 object-cover"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {media.relations.length > 0 && (
          <Section>
            <SectionHeader title="Related" size="sm" />
            <Rail aria-label="Related media" gap="sm">
              {media.relations.slice(0, 12).map((r) => (
                <div key={`${r.relationType}-${r.media.id}`} className="w-30 shrink-0">
                  <p className="label-cat label-cat-plain mb-2 truncate">
                    {humanize(r.relationType)}
                  </p>
                  <MediaCard media={r.media} showProgress={false} />
                </div>
              ))}
            </Rail>
          </Section>
        )}

        {media.recommendations.length > 0 && (
          <Section>
            <SectionHeader title="Recommended" size="sm" />
            <Rail aria-label="Recommendations" gap="sm">
              {media.recommendations.slice(0, 12).map((r) => (
                <div key={r.media.id} className="w-30 shrink-0">
                  <MediaCard media={r.media} showProgress={false} />
                </div>
              ))}
            </Rail>
          </Section>
        )}
      </div>

      {/* The catalog card: a quiet sidebar, not the headline. */}
      <aside className="min-w-0 lg:col-span-4">
        <Card tone="sunk" radius="lg" padding="compact" className="lg:sticky lg:top-24">
          <Eyebrow className="mb-4">Details</Eyebrow>
          <dl className="space-y-2.5 text-label">
            <Info label="Format" value={humanize(media.format)} />
            <Info label="Status" value={humanize(media.status)} />
            {media.kind === 'anime' ? (
              <>
                <Info label="Episodes" value={media.episodes ?? '—'} />
                <Info label="Duration" value={media.duration ? `${media.duration} min` : '—'} />
                <Info
                  label="Season"
                  value={
                    media.season ? `${humanize(media.season)} ${media.seasonYear ?? ''}`.trim() : '—'
                  }
                />
              </>
            ) : (
              <>
                <Info label="Chapters" value={media.chapters ?? '—'} />
                <Info label="Volumes" value={media.volumes ?? '—'} />
              </>
            )}
            <Info label="Source" value={humanize(media.source)} />
            <Info
              label="Studio"
              value={media.studios.find((s) => s.isMain)?.name ?? media.studios[0]?.name ?? '—'}
            />
            <Info label="Started" value={fullDate(dateOf(media.startDate))} />
            <Info label="Ended" value={fullDate(dateOf(media.endDate))} />
            <Info label="Favorites" value={compactNumber(media.favorites)} />
          </dl>

          {media.staff.length > 0 && (
            <>
              <Eyebrow className="mt-7 mb-3">Staff</Eyebrow>
              <ul className="space-y-2">
                {media.staff.slice(0, 6).map((s) => (
                  <li key={`${s.id}-${s.role}`} className="flex items-baseline justify-between gap-4">
                    <span className="truncate text-label text-ink">{s.name}</span>
                    <span className="shrink-0 text-meta text-ink-3">{s.role}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {media.tags.length > 0 && (
            <>
              <Eyebrow className="mt-7 mb-3">Tags</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {media.tags
                  .filter((t) => !t.isSpoiler)
                  .slice(0, 10)
                  .map((t) => (
                    <Pill key={t.id} size="sm">
                      {t.name}
                    </Pill>
                  ))}
              </div>
            </>
          )}
        </Card>
      </aside>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 pb-2.5 last:border-0">
      <dt className="label-cat label-cat-plain shrink-0">{label}</dt>
      <dd className="font-mono-num truncate text-right text-meta text-ink">{value}</dd>
    </div>
  )
}

function dateOf(d: Media['startDate']): string | null {
  if (!d?.year) return null
  return `${d.year}-${String(d.month ?? 1).padStart(2, '0')}-${String(d.day ?? 1).padStart(2, '0')}`
}

function describeHistory(type: string, payload: Record<string, unknown>, media: Media): string {
  const unit = payload.unit === 'volume' ? 'volume' : unitName(media.kind).toLowerCase()

  switch (type) {
    case 'progress':
      return `Reached ${unit} ${payload.to}`
    case 'status':
      return `Marked as ${statusLabel(payload.to as never, media.kind).toLowerCase()}`
    case 'score':
      return payload.to == null
        ? 'Took back your verdict'
        : `Rated it ${payload.to} — ${ratingWord(Number(payload.to)).toLowerCase()}`
    case 'rank':
      return payload.to == null ? 'Removed your ranking' : `Ranked ${ordinal(Number(payload.to))}`
    case 'collection':
      return `Filed into ${(payload.collectionName as string) ?? 'a collection'}`
    case 'note':
      return 'Wrote a note'
    case 'added':
      return 'Added to your library'
    default:
      return type
  }
}

/* -------------------------------------------------------------------------- */

function MediaPageSkeleton() {
  return (
    <div className="bleed-x -mt-6">
      <Skeleton className="h-56 w-full rounded-none md:h-[22rem]" />
      <div className="mx-auto w-full max-w-(--container-page) px-5 md:px-10">
        <div className="relative -mt-24 grid gap-6 md:-mt-28 md:grid-cols-[212px_1fr] md:gap-9">
          <div className="w-32 md:w-[212px]">
            <CoverSkeleton />
          </div>
          <div className="space-y-4 pt-2 md:pt-28">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-28 w-full max-w-2xl rounded-lg" />
          </div>
        </div>
        <div className="mt-16 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full max-w-2xl" />
        </div>
      </div>
    </div>
  )
}
