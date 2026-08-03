import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronDown, ExternalLink, Heart, ListPlus, Repeat, Trophy } from 'lucide-react'
import {
  Button,
  Card,
  CoverImage,
  CoverSkeleton,
  Pill,
  ProgressBar,
  ProgressStepper,
  Rail,
  Section,
  SectionHeader,
  Skeleton,
  Stars,
  useResolvedTheme,
} from '@/design'
import { useMedia } from '@/data/anilist/hooks'
import { displayTitle, subTitle } from '@/data/anilist/normalize'
import {
  KIND_LABEL_SINGULAR,
  tracksVolumes,
  unitName,
  type Media,
} from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { useCollectionsContaining, useMediaActivity, useRank } from '@/data/store/selectors'
import { statusLabel } from '@/data/store/types'
import { useTracking } from '@/features/tracking/useTracking'
import {
  CollectionPicker,
  RankDialog,
  RatePopover,
  StatusMenu,
  StatusDot,
} from '@/features/tracking/controls'
import { MediaCard } from '@/features/tracking/cards'
import { artAccent, artAccentQuiet, artScrim } from '@/lib/accent'
import { cn } from '@/lib/cn'
import { dayLabel, fullDate } from '@/lib/dates'
import { compactNumber, humanize, ordinal, pluralize, scoreText, stripHtml } from '@/lib/format'

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
        <p className="font-display text-display-md text-ink">We couldn't load this title</p>
        <p className="mt-2 text-body text-ink-2">
          AniList may be rate-limiting or offline. Your library is unaffected.
        </p>
      </div>
    )
  }

  return (
    <div
      // Published once here; every descendant reads var(--art-accent) rather
      // than threading a colour prop through the tree.
      style={
        {
          ...(accent ? { '--art-accent': accent } : {}),
          ...(accentQuiet ? { '--art-accent-quiet': accentQuiet } : {}),
        } as React.CSSProperties
      }
      className="-mx-5 -mt-6 md:-mx-10"
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
    <div className="relative h-56 w-full overflow-hidden md:h-[340px]" aria-hidden>
      {media.bannerImage ? (
        <img
          src={media.bannerImage}
          alt=""
          className="size-full object-cover object-center"
          fetchPriority="high"
        />
      ) : (
        <div
          className="size-full"
          style={{ background: scrim ?? 'var(--surface-2)' }}
        />
      )}

      {/* Fades the artwork into the page rather than cutting it off. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, rgb(var(--scrim) / 0.1) 0%, rgb(var(--scrim) / 0.55) 55%, rgb(var(--scrim) / 1) 100%)`,
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- hero -- */

function Hero({ media }: { media: Media }) {
  const language = usePrefs((s) => s.titleLanguage)
  const { entry, inLibrary, total, setProgress, setVolumes, add, addRepeat, toggleFavourite } =
    useTracking(media)
  const rank = useRank(media.kind, media.id)
  const [rankOpen, setRankOpen] = useState(false)

  const title = displayTitle(media, language)
  const sub = subTitle(media, language)
  const studio = media.studios.find((s) => s.isMain)?.name

  const meta = [
    KIND_LABEL_SINGULAR[media.kind],
    humanize(media.format),
    media.seasonYear,
    studio,
  ].filter(Boolean)

  return (
    <div className="relative -mt-20 grid gap-6 md:-mt-24 md:grid-cols-[200px_1fr] md:gap-8">
      <div className="w-32 md:w-[200px]">
        <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-ink/10">
          <CoverImage
            src={media.coverImageLarge}
            alt={title}
            color={media.color}
            rounded="lg"
            priority
          />
        </div>

        <div className="mt-4 hidden flex-col gap-2 md:flex">
          {!inLibrary ? (
            <Button variant="art" block onClick={() => add()}>
              Add to library
            </Button>
          ) : (
            <StatusMenu
              media={media}
              trigger={
                <Button block icon={<StatusDot status={entry?.status ?? 'planning'} />} trailing={<ChevronDown className="ml-auto size-4" />}>
                  {statusLabel(entry?.status ?? 'planning', media.kind)}
                </Button>
              }
            />
          )}

          <CollectionPicker
            media={media}
            trigger={
              <Button block icon={<ListPlus className="size-4" />}>
                Add to collection
              </Button>
            }
          />

          {media.siteUrl && (
            <a
              href={media.siteUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1.5 text-meta text-ink-3 hover:text-ink-2"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              View on AniList
            </a>
          )}
        </div>
      </div>

      <div className="min-w-0 pt-2 md:pt-24">
        <p className="text-micro text-ink-3 uppercase">{meta.join(' · ')}</p>

        <h1 className="mt-2 font-display text-display-lg text-balance text-ink md:text-display-xl">
          {title}
        </h1>
        {sub && <p className="mt-2 text-body text-ink-3">{sub}</p>}

        {/* Your relationship with the title, before any of AniList's numbers. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <RatePopover
            media={media}
            trigger={
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-md"
                aria-label="Your rating"
              >
                <Stars value={entry?.score ?? null} size="lg" art />
                <span className="tnum font-display text-display-sm text-ink">
                  {entry?.score != null ? scoreText(entry.score) : '—'}
                </span>
              </button>
            }
          />

          <button
            type="button"
            onClick={() => setRankOpen(true)}
            className="flex items-center gap-2 rounded-md text-label text-ink-2 hover:text-ink"
          >
            <Trophy className="size-4 text-ink-3" aria-hidden />
            {rank ? (
              <span>
                <span className="font-medium text-ink">{ordinal(rank)}</span> in your{' '}
                {KIND_LABEL_SINGULAR[media.kind].toLowerCase()}
              </span>
            ) : (
              'Set a ranking'
            )}
          </button>

          {entry && (
            <button
              type="button"
              onClick={toggleFavourite}
              aria-pressed={entry.favourite}
              className="flex items-center gap-2 rounded-md text-label text-ink-2 hover:text-ink"
            >
              <Heart
                className={cn('size-4', entry.favourite ? 'fill-current text-dropped' : 'text-ink-3')}
                aria-hidden
              />
              {entry.favourite ? 'Favourite' : 'Add to favourites'}
            </button>
          )}
        </div>

        {/* The tracking bar — the thing people came here to touch. */}
        {inLibrary && (
          <Card padding="compact" className="mt-6 max-w-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-micro text-ink-3 uppercase">{unitName(media.kind)}</p>
                <div className="mt-1.5 -ml-1">
                  <ProgressStepper
                    value={entry?.progress ?? 0}
                    max={total}
                    unit={unitName(media.kind)}
                    onChange={setProgress}
                    size="lg"
                    art
                  />
                </div>
              </div>

              {tracksVolumes(media.kind) && (
                <div>
                  <p className="text-micro text-ink-3 uppercase">Volume</p>
                  <div className="mt-1.5 -ml-1">
                    <ProgressStepper
                      value={entry?.progressVolumes ?? 0}
                      max={media.volumes}
                      unit="Volume"
                      onChange={setVolumes}
                    />
                  </div>
                </div>
              )}

              {entry?.status === 'completed' && (
                <Button size="sm" icon={<Repeat className="size-4" />} onClick={addRepeat}>
                  {entry.repeats > 0 ? `Rewatched ${entry.repeats}×` : 'Start again'}
                </Button>
              )}
            </div>

            <ProgressBar value={entry?.progress ?? 0} max={total} size="md" art className="mt-4" />

            <p className="tnum mt-2.5 text-meta text-ink-3">
              {total
                ? `${Math.round(((entry?.progress ?? 0) / total) * 100)}% complete`
                : `${pluralize(entry?.progress ?? 0, unitName(media.kind).toLowerCase())} so far`}
              {entry?.note && ` · "${entry.note}"`}
            </p>
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
          <CollectionPicker
            media={media}
            trigger={<Button icon={<ListPlus className="size-4" />}>Collection</Button>}
          />
        </div>
      </div>

      <RankDialog media={media} open={rankOpen} onClose={() => setRankOpen(false)} />
    </div>
  )
}

/* -------------------------------------------------------------------- body -- */

function Body({ media }: { media: Media }) {
  const collections = useCollectionsContaining(media.id)
  const history = useMediaActivity(media.id, 20)
  const { entry } = useTracking(media)
  const [expanded, setExpanded] = useState(false)

  const synopsis = useMemo(() => stripHtml(media.description), [media.description])
  const isLong = synopsis.length > 420

  return (
    <div className="mt-14 grid gap-12 pb-8 lg:grid-cols-12 lg:gap-14">
      <div className="space-y-14 lg:col-span-8">
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
                  className="mt-2 text-label font-medium text-art hover:underline"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {media.genres.map((g) => (
                <Link key={g} to={`/discover?genre=${encodeURIComponent(g)}`}>
                  <Pill>{g}</Pill>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Your relationship with the title comes before AniList's metadata —
            this is the difference between a library and an encyclopedia. */}
        {collections.length > 0 && (
          <Section>
            <SectionHeader eyebrow="Yours" title="In your collections" size="sm" />
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <Link key={c.id} to={`/collections/${c.id}`}>
                  <Pill tone="art" size="md">
                    {c.name}
                  </Pill>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {history.length > 0 && (
          <Section>
            <SectionHeader eyebrow="Yours" title="Your history" size="sm" />
            <ol className="space-y-2.5">
              {history.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 text-body">
                  <span className="tnum w-24 shrink-0 text-meta text-ink-3">
                    {dayLabel(e.createdAt)}
                  </span>
                  <span className="text-ink-2">{describeHistory(e.type, e.payload, media)}</span>
                </li>
              ))}
            </ol>
            {entry && (
              <p className="tnum pt-2 text-meta text-ink-3">
                Added {fullDate(entry.createdAt)}
                {entry.startedAt && ` · started ${fullDate(entry.startedAt)}`}
                {entry.finishedAt && ` · finished ${fullDate(entry.finishedAt)}`}
              </p>
            )}
          </Section>
        )}

        {media.characters.length > 0 && (
          <Section>
            <SectionHeader eyebrow="Cast" title="Characters" size="sm" />
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {media.characters.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <img
                    src={c.image ?? ''}
                    alt=""
                    loading="lazy"
                    className="size-12 shrink-0 rounded-md bg-surface-2 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label font-medium text-ink">{c.name}</p>
                    <p className="truncate text-meta text-ink-3">{humanize(c.role)}</p>
                  </div>
                  {c.voiceActor && (
                    <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 sm:flex">
                      <p className="truncate text-right text-meta text-ink-3">{c.voiceActor.name}</p>
                      <img
                        src={c.voiceActor.image ?? ''}
                        alt=""
                        loading="lazy"
                        className="size-12 shrink-0 rounded-md bg-surface-2 object-cover"
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
            <SectionHeader eyebrow="Related" title="Elsewhere in this story" size="sm" />
            <Rail aria-label="Related media" gap="sm">
              {media.relations.slice(0, 12).map((r) => (
                <div key={`${r.relationType}-${r.media.id}`} className="w-32 shrink-0">
                  <p className="mb-1.5 truncate text-micro text-ink-3 uppercase">
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
            <SectionHeader
              eyebrow="If you liked this"
              title="You might also like"
              size="sm"
            />
            <Rail aria-label="Recommendations" gap="sm">
              {media.recommendations.slice(0, 12).map((r) => (
                <div key={r.media.id} className="w-32 shrink-0">
                  <MediaCard media={r.media} showProgress={false} />
                </div>
              ))}
            </Rail>
          </Section>
        )}
      </div>

      {/* Information is a quiet sidebar, not the headline. */}
      <aside className="lg:col-span-4">
        <Card padding="compact" className="lg:sticky lg:top-24">
          <h2 className="mb-4 text-micro text-ink-3 uppercase">Information</h2>
          <dl className="space-y-3 text-label">
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
            <Info
              label="Community score"
              value={media.averageScore ? `${(media.averageScore / 10).toFixed(1)} / 10` : '—'}
            />
            <Info label="Popularity" value={compactNumber(media.popularity)} />
          </dl>

          {media.staff.length > 0 && (
            <>
              <h2 className="mt-6 mb-3 text-micro text-ink-3 uppercase">Staff</h2>
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
              <h2 className="mt-6 mb-3 text-micro text-ink-3 uppercase">Tags</h2>
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
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="tnum truncate text-right text-ink">{value}</dd>
    </div>
  )
}

function dateOf(d: Media['startDate']): string | null {
  if (!d?.year) return null
  return `${d.year}-${String(d.month ?? 1).padStart(2, '0')}-${String(d.day ?? 1).padStart(2, '0')}`
}

function describeHistory(
  type: string,
  payload: Record<string, unknown>,
  media: Media,
): string {
  const unit = payload.unit === 'volume' ? 'volume' : unitName(media.kind).toLowerCase()

  switch (type) {
    case 'progress':
      return `Reached ${unit} ${payload.to}`
    case 'status':
      return `Marked as ${statusLabel(payload.to as never, media.kind).toLowerCase()}`
    case 'score':
      return payload.to == null ? 'Cleared your rating' : `Rated ${scoreText(Number(payload.to))}`
    case 'rank':
      return payload.to == null ? 'Removed your ranking' : `Ranked ${ordinal(Number(payload.to))}`
    case 'collection':
      return `Added to ${(payload.collectionName as string) ?? 'a collection'}`
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
    <div className="-mx-5 -mt-6 md:-mx-10">
      <Skeleton className="h-56 w-full rounded-none md:h-[340px]" />
      <div className="mx-auto w-full max-w-(--container-page) px-5 md:px-10">
        <div className="relative -mt-20 grid gap-6 md:-mt-24 md:grid-cols-[200px_1fr] md:gap-8">
          <div className="w-32 md:w-[200px]">
            <CoverSkeleton />
          </div>
          <div className="space-y-4 pt-2 md:pt-24">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full max-w-2xl rounded-lg" />
          </div>
        </div>
        <div className="mt-14 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full max-w-2xl" />
        </div>
      </div>
    </div>
  )
}
