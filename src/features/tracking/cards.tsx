import { Link } from 'react-router'
import { Check, MoreHorizontal, Plus, Star } from 'lucide-react'
import { cn } from '@/lib/cn'
import { scoreText } from '@/lib/format'
import { relativeShort } from '@/lib/dates'
import {
  CoverImage,
  IconButton,
  Pill,
  ProgressBar,
  ProgressStepper,
  Stars,
  Tooltip,
} from '@/design'
import { usePrefetchMedia } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import { totalUnits, unitName, type MediaSummary } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { useRank } from '@/data/store/selectors'
import { statusLabel, type LibraryEntry } from '@/data/store/types'
import { useTracking } from './useTracking'
import { RatePopover, StatusMenu, StatusDot } from './controls'

/* -------------------------------------------------------------- grid card -- */

export interface MediaCardProps {
  media: MediaSummary
  /** Show the progress bar + inline +1. Off for Discover results. */
  showProgress?: boolean
  showRank?: boolean
  className?: string
}

/**
 * The workhorse. Hover reveals exactly two actions — advance progress and rate
 * — because those are the only two things people do dozens of times a day.
 * Everything else lives one click deeper in the overflow menu.
 */
export function MediaCard({ media, showProgress = true, showRank, className }: MediaCardProps) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const { entry, inLibrary, bump, add } = useTracking(media)
  const rank = useRank(media.kind, media.id)

  const total = totalUnits(media)
  const title = displayTitle(media, language)
  const atEnd = total != null && (entry?.progress ?? 0) >= total

  return (
    <div className={cn('group/card relative', className)}>
      <Link
        to={`/media/${media.id}`}
        onPointerEnter={() => prefetch(media.id)}
        onFocus={() => prefetch(media.id)}
        className="block rounded-md"
      >
        <div className="relative overflow-hidden rounded-md transition-transform duration-[110ms] ease-out group-hover/card:-translate-y-[3px]">
          <CoverImage src={media.coverImage} alt="" color={media.color} rounded="md" />

          {showRank && rank && (
            <span className="tnum absolute top-0 left-0 rounded-br-md bg-canvas/92 px-2 py-1 font-display text-label text-ink backdrop-blur-sm">
              {rank}
            </span>
          )}

          {entry?.score != null && (
            <span className="tnum absolute top-1.5 right-1.5 flex items-center gap-1 rounded-sm bg-canvas/92 px-1.5 py-0.5 text-micro text-ink backdrop-blur-sm">
              <Star className="size-2.5 fill-current text-accent" aria-hidden />
              {scoreText(entry.score)}
            </span>
          )}

          {/* Hover actions. Hidden from pointer-less devices, where the whole
              card is a link and the media page carries the controls. */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 hidden items-center justify-between gap-1',
              'bg-gradient-to-t from-canvas/95 via-canvas/70 to-transparent p-2 pt-8',
              'opacity-0 transition-opacity duration-150',
              'group-hover/card:opacity-100 group-focus-within/card:opacity-100 md:flex',
            )}
          >
            {inLibrary ? (
              <>
                <span className="tnum pl-1 text-micro text-ink-2">
                  {entry?.progress ?? 0}
                  {total ? ` / ${total}` : ''}
                </span>
                <span className="pointer-events-auto flex items-center gap-1">
                  <RatePopover
                    media={media}
                    trigger={
                      <IconButton
                        label="Rate"
                        icon={<Star className="size-3.5" />}
                        variant="secondary"
                        size="sm"
                        onClick={(e) => e.preventDefault()}
                      />
                    }
                  />
                  <Tooltip content={atEnd ? 'All caught up' : `Watched ${(entry?.progress ?? 0) + 1}`}>
                    <IconButton
                      label="One more"
                      icon={atEnd ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                      variant="primary"
                      size="sm"
                      disabled={atEnd}
                      onClick={(e) => {
                        e.preventDefault()
                        bump()
                      }}
                    />
                  </Tooltip>
                </span>
              </>
            ) : (
              <span className="pointer-events-auto ml-auto">
                <IconButton
                  label="Add to library"
                  icon={<Plus className="size-3.5" />}
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    add()
                  }}
                />
              </span>
            )}
          </div>
        </div>

        <div className="mt-2.5 space-y-1">
          <p className="clamp-2 text-label leading-snug font-medium text-ink">{title}</p>
          <p className="tnum text-meta text-ink-3">
            {[media.seasonYear, formatOf(media)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>

      {showProgress && inLibrary && total != null && (entry?.progress ?? 0) > 0 && !atEnd && (
        <ProgressBar value={entry?.progress ?? 0} max={total} className="mt-2" />
      )}
    </div>
  )
}

function formatOf(media: MediaSummary): string {
  if (!media.format) return ''
  return media.format
    .replace('TV_SHORT', 'TV Short')
    .replace('ONE_SHOT', 'One shot')
    .replace('MANGA', 'Manga')
    .replace('NOVEL', 'Novel')
    .replace('MOVIE', 'Film')
    .replace('SPECIAL', 'Special')
    .replace(/_/g, ' ')
}

/* --------------------------------------------------------------- list row -- */

export function MediaRow({ media, entry }: { media: MediaSummary; entry?: LibraryEntry }) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const { setProgress } = useTracking(media)
  const rank = useRank(media.kind, media.id)
  const total = totalUnits(media)

  return (
    <div className="group/row flex items-center gap-4 border-b border-line py-3 last:border-0">
      <Link
        to={`/media/${media.id}`}
        onPointerEnter={() => prefetch(media.id)}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="w-10 shrink-0">
          <CoverImage src={media.coverImage} alt="" color={media.color} rounded="sm" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-label font-medium text-ink">{displayTitle(media, language)}</p>
          <p className="tnum mt-0.5 flex items-center gap-2 text-meta text-ink-3">
            {entry && (
              <>
                <StatusDot status={entry.status} className="size-3" />
                {statusLabel(entry.status, media.kind)}
                <span aria-hidden>·</span>
              </>
            )}
            {[media.seasonYear, formatOf(media)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>

      {entry && (
        <div className="hidden shrink-0 md:block">
          <ProgressStepper
            value={entry.progress}
            max={total}
            unit={unitName(media.kind)}
            onChange={setProgress}
          />
        </div>
      )}

      <div className="hidden w-20 shrink-0 justify-end sm:flex">
        <Stars value={entry?.score ?? null} size="sm" />
      </div>

      <span className="tnum hidden w-10 shrink-0 text-right text-meta text-ink-3 lg:block">
        {rank ? `#${rank}` : '—'}
      </span>

      <span className="tnum hidden w-14 shrink-0 text-right text-meta text-ink-3 lg:block">
        {entry ? relativeShort(entry.updatedAt) : ''}
      </span>

      <StatusMenu
        media={media}
        trigger={
          <IconButton
            label="More actions"
            icon={<MoreHorizontal className="size-4" />}
            size="sm"
            className="shrink-0"
          />
        }
      />
    </div>
  )
}

/* --------------------------------------------------------- continue card -- */

/**
 * The dashboard's hero. Wider than a poster so the progress control can sit
 * beside the art — updating from here is a single click with no navigation,
 * which is the whole point of the dashboard.
 */
export function ContinueCard({ media, entry }: { media: MediaSummary; entry: LibraryEntry }) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const { setProgress } = useTracking(media)
  const total = totalUnits(media)

  return (
    <article className="flex w-80 shrink-0 gap-4 rounded-lg border border-line bg-surface p-3 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm">
      <Link
        to={`/media/${media.id}`}
        onPointerEnter={() => prefetch(media.id)}
        className="w-20 shrink-0 rounded-md"
      >
        <CoverImage src={media.coverImage} alt="" color={media.color} rounded="md" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <Link to={`/media/${media.id}`}>
            <h3 className="clamp-2 text-label leading-snug font-medium text-ink">
              {displayTitle(media, language)}
            </h3>
          </Link>
          <p className="tnum mt-1 text-meta text-ink-3">
            {unitName(media.kind)} {entry.progress}
            {total ? ` of ${total}` : ''}
          </p>
        </div>

        <div className="space-y-2">
          <ProgressBar value={entry.progress} max={total} />
          <div className="-ml-1">
            <ProgressStepper
              value={entry.progress}
              max={total}
              unit={unitName(media.kind)}
              onChange={setProgress}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------- shelf item -- */

/** Shelf mode: bigger art, no chrome, a hairline "shelf" drawn by the parent. */
export function ShelfCover({ media, entry }: { media: MediaSummary; entry?: LibraryEntry }) {
  const language = usePrefs((s) => s.titleLanguage)
  const prefetch = usePrefetchMedia()
  const total = totalUnits(media)

  return (
    <Link
      to={`/media/${media.id}`}
      onPointerEnter={() => prefetch(media.id)}
      className="group/shelf w-36 shrink-0 md:w-40"
      title={displayTitle(media, language)}
    >
      <div className="transition-transform duration-200 ease-out group-hover/shelf:-translate-y-1.5">
        <CoverImage src={media.coverImage} alt={displayTitle(media, language)} color={media.color} />
      </div>
      {entry && total != null && entry.progress > 0 && entry.progress < total && (
        <ProgressBar value={entry.progress} max={total} className="mt-2" />
      )}
    </Link>
  )
}

/* ------------------------------------------------------------------ misc -- */

export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return null
  return (
    <Pill tone="accent" size="sm">
      <Star className="size-3 fill-current" aria-hidden />
      {scoreText(score)}
    </Pill>
  )
}
