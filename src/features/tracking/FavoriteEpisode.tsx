import { useEffect, useMemo, useState } from 'react'
import { Clapperboard, Star } from 'lucide-react'
import {
  Button,
  Dialog,
  Eyebrow,
  SearchInput,
  Skeleton,
  toast,
} from '@/design'
import {
  isEpisodeDataConfigured,
  useTmdbEpisodes,
  useTmdbMatch,
  useTmdbSeasons,
} from '@/data/tmdb/hooks'
import { tmdbImage } from '@/data/tmdb/client'
import { useLibrary } from '@/data/store/library'
import type { FavoriteEpisode as FavoriteEpisodeValue } from '@/data/store/types'
import type { Media } from '@/data/anilist/types'
import { requireSignIn } from '@/features/auth/gate'
import { useAuth } from '@/data/supabase/auth'
import { cn } from '@/lib/cn'

/**
 * The one episode you'd point at.
 *
 * A score says how good a series was; this says which twenty minutes of it you
 * would actually show somebody. They are different questions and the second one
 * is the one people answer in conversation, so it deserves to be storable.
 *
 * Episode names come from TMDB, which is a second catalog and an optional one —
 * see `data/tmdb/client`. With no key configured this renders an explanation
 * rather than a dead button, because a feature you cannot turn on should say so.
 */
export function FavoriteEpisodeCard({ media }: { media: Media }) {
  const entry = useLibrary((s) => s.entries[media.id])
  const setFavoriteEpisode = useLibrary((s) => s.setFavoriteEpisode)
  const { canWrite } = useAuth()
  const [open, setOpen] = useState(false)

  // Only series have episodes. A film's "favorite episode" is the film.
  if (media.kind !== 'anime' || media.format === 'MOVIE') return null

  const pick = entry?.favoriteEpisode ?? null

  return (
    <>
      <button
        type="button"
        onClick={() => (canWrite ? setOpen(true) : requireSignIn('remember a favorite episode'))}
        className={cn(
          'group/fav flex w-full items-center gap-3.5 rounded-lg border p-3 text-left',
          'transition-[border-color,background-color] duration-200',
          pick
            ? 'border-accent-line bg-accent-quiet/50 hover:border-accent'
            : 'border-dashed border-line-strong hover:border-accent-line hover:bg-accent-quiet/30',
        )}
      >
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md',
            pick?.stillPath ? '' : 'bg-surface-2 text-ink-3',
          )}
        >
          {pick?.stillPath ? (
            <img src={tmdbImage(pick.stillPath) ?? undefined} alt="" className="size-full object-cover" />
          ) : (
            <Clapperboard className="size-5" strokeWidth={1.5} aria-hidden />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="label-cat label-cat-plain block">Favorite episode</span>
          <span className="clamp-1 mt-1 block text-label font-medium text-ink">
            {pick ? `S${pick.season}E${pick.episode} · ${pick.name}` : 'Pick the one you would show someone'}
          </span>
        </span>

        <Star
          className={cn('size-4 shrink-0', pick ? 'fill-accent text-accent' : 'text-ink-3')}
          aria-hidden
        />
      </button>

      <EpisodePicker
        media={media}
        open={open}
        current={pick}
        onClose={() => setOpen(false)}
        onPick={(next) => {
          setFavoriteEpisode(media.id, next)
          toast({
            message: next ? `S${next.season}E${next.episode} — ${next.name}` : 'Favorite episode cleared',
          })
          setOpen(false)
        }}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */

function EpisodePicker({
  media,
  open,
  current,
  onClose,
  onPick,
}: {
  media: Media
  open: boolean
  current: FavoriteEpisodeValue | null
  onClose: () => void
  onPick: (next: FavoriteEpisodeValue | null) => void
}) {
  const { data: show, isLoading: matching } = useTmdbMatch(open ? media : undefined)
  const { data: seasons } = useTmdbSeasons(show?.id)
  const [season, setSeason] = useState(current?.season ?? 1)
  const [query, setQuery] = useState('')

  const { data: episodes, isLoading } = useTmdbEpisodes(show?.id, season)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = episodes ?? []
    if (!needle) return list
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) || String(e.episode_number).includes(needle),
    )
  }, [episodes, query])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Favorite episode"
      description={media.title.english ?? media.title.romaji}
      size="lg"
      footer={
        <>
          {current && (
            <Button variant="danger" size="sm" className="mr-auto" onClick={() => onPick(null)}>
              Clear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {!isEpisodeDataConfigured ? (
        <div className="py-8 text-center">
          <p className="text-body text-ink-2">Episode names need one more key.</p>
          <p className="mt-3 text-meta text-ink-3">
            Add <code className="rounded-sm bg-surface-2 px-1">VITE_TMDB_API_KEY</code> to{' '}
            <code className="rounded-sm bg-surface-2 px-1">.env.local</code> and restart the dev
            server. Everything else in the app works without it.
          </p>
        </div>
      ) : matching ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !show ? (
        <div className="py-8 text-center">
          <p className="text-body text-ink-2">No episode list found for this title.</p>
          <p className="mt-2 text-meta text-ink-3">
            The two catalogs are matched by name and year, and this one did not match confidently.
            A wrong match would be worse than none.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an episode"
              aria-label="Find an episode"
              className="min-w-0 flex-1"
            />
            {(seasons?.length ?? 0) > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {seasons?.map((s) => (
                  <button
                    key={s.season_number}
                    type="button"
                    onClick={() => setSeason(s.season_number)}
                    className={cn(
                      'h-7 rounded-full border px-2.5 text-meta font-medium transition-colors',
                      s.season_number === season
                        ? 'border-accent-line bg-accent text-accent-ink'
                        : 'border-line bg-surface-2 text-ink-2 hover:text-ink',
                    )}
                  >
                    {s.season_number === 0 ? 'Specials' : `S${s.season_number}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-[52vh] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
            {isLoading
              ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)
              : shown.map((e) => {
                  const active =
                    current?.season === e.season_number && current?.episode === e.episode_number

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() =>
                        onPick({
                          season: e.season_number,
                          episode: e.episode_number,
                          name: e.name,
                          stillPath: e.still_path,
                        })
                      }
                      className={cn(
                        'flex w-full items-center gap-3.5 rounded-lg border p-2.5 text-left',
                        'transition-[border-color,background-color] duration-200',
                        active
                          ? 'border-accent-line bg-accent-quiet/60'
                          : 'border-transparent hover:border-line hover:bg-surface-2/70',
                      )}
                    >
                      <span className="w-24 shrink-0 overflow-hidden rounded-md bg-surface-2">
                        {e.still_path ? (
                          <img
                            src={tmdbImage(e.still_path) ?? undefined}
                            alt=""
                            loading="lazy"
                            className="aspect-video size-full object-cover"
                          />
                        ) : (
                          <span className="flex aspect-video items-center justify-center text-ink-3">
                            <Clapperboard className="size-4" strokeWidth={1.5} aria-hidden />
                          </span>
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="font-mono-num label-cat label-cat-plain block">
                          E{e.episode_number}
                        </span>
                        <span className="clamp-1 mt-0.5 block text-label font-medium text-ink">
                          {e.name}
                        </span>
                        {e.overview && (
                          <span className="clamp-2 mt-1 block text-meta text-ink-3">
                            {e.overview}
                          </span>
                        )}
                      </span>

                      {active && <Star className="size-4 shrink-0 fill-accent text-accent" aria-hidden />}
                    </button>
                  )
                })}

            {!isLoading && shown.length === 0 && (
              <p className="py-8 text-center text-body text-ink-3">Nothing matches that.</p>
            )}
          </div>

          <Eyebrow className="justify-center">Episode data by TMDB</Eyebrow>
        </div>
      )}
    </Dialog>
  )
}
