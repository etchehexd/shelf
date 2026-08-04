import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Globe, LayoutGrid, Link2, Lock, Plus, Sparkles } from 'lucide-react'
import { Button, CoverStack, EmptyState, IconButton, Pill } from '@/design'
import { useMediaMap } from '@/data/anilist/hooks'
import { useCollections, useTrackedIds } from '@/data/store/selectors'
import { useLibrary } from '@/data/store/library'
import { useAuth } from '@/data/supabase/auth'
import { SignInWall } from '@/features/auth/SignInWall'
import type { Collection } from '@/data/store/types'
import type { MediaSummary } from '@/data/anilist/types'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { AddTitlesDialog } from './AddTitlesDialog'
import { CollectionBoard } from './CollectionBoard'
import { CollectionEditor } from './CollectionEditor'

const PRIVACY_ICON = { private: Lock, unlisted: Link2, public: Globe } as const

/**
 * Collections are the point of the product, so they get the most design.
 *
 * They are exhibitions, not folders: the biggest one takes the top of the page
 * as a banner, and the rest cycle through three different cover treatments —
 * a fanned stack, a mosaic, a split — so scrolling the page never settles into
 * a repeating tile. No two adjacent cards look the same.
 */
export default function CollectionsPage() {
  const { signedOut } = useAuth()
  const collections = useCollections()
  const hasLibrary = useLibrary((s) => Object.keys(s.entries).length > 0)
  const [editing, setEditing] = useState(false)
  const [organizing, setOrganizing] = useState(false)

  const trackedIds = useTrackedIds()
  const { map } = useMediaMap(trackedIds)

  const [featured, ...rest] = collections

  if (signedOut) {
    return (
      <SignInWall section="Collections" headline="Curation is the point.">
        Collections are the signature of this product — the comfort rewatches, the five you'd
        defend, the best openings. They're something you make and something you share, and
        both of those need an account behind them.
      </SignInWall>
    )
  }

  return (
    <div className="space-y-12 pt-1">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-line pb-7">
        <h1 className="text-display-lg text-ink">Collections</h1>

        <div className="flex flex-wrap items-center gap-2">
          {collections.length > 0 && hasLibrary && (
            <Button
              icon={<LayoutGrid className="size-4" />}
              aria-pressed={organizing}
              onClick={() => setOrganizing((v) => !v)}
            >
              {organizing ? 'Done' : 'Organize'}
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="size-4" />}
            onClick={() => setEditing(true)}
          >
            New collection
          </Button>
        </div>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" strokeWidth={1.5} />}
          title="No collections yet"
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing(true)}>
              New collection
            </Button>
          }
        />
      ) : organizing ? (
        <CollectionBoard onDone={() => setOrganizing(false)} />
      ) : (
        <>
          <FeaturedCollection collection={featured} map={map} />

          {rest.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((c, i) => (
                <CollectionCard key={c.id} collection={c} map={map} variant={i % 3} />
              ))}

              <button
                type="button"
                onClick={() => setEditing(true)}
                className={cn(
                  'group flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-xl',
                  'border border-dashed border-line text-ink-3 transition-colors',
                  'hover:border-accent-line hover:bg-accent-quiet/40 hover:text-accent',
                )}
              >
                <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-current transition-transform duration-300 group-hover:scale-110">
                  <Plus className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="label-cat label-cat-plain">New collection</span>
              </button>
            </div>
          )}
        </>
      )}

      <CollectionEditor open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function useCovers(collectionId: string, map: Map<number, MediaSummary>, limit = 6) {
  const allItems = useLibrary((s) => s.collectionItems)

  // Select the raw array and narrow in useMemo. Filtering inside the selector
  // returns a new array every render, which useSyncExternalStore treats as a
  // changed snapshot — an infinite render loop, not just wasted work.
  return useMemo(() => {
    const items = allItems
      .filter((i) => i.collectionId === collectionId)
      .sort((a, b) => a.position - b.position)

    return {
      count: items.length,
      covers: items
        .slice(0, limit)
        .map((i) => map.get(i.mediaId))
        .filter(Boolean) as MediaSummary[],
    }
  }, [allItems, collectionId, map, limit])
}

/**
 * The banner. Covers bleed across the full width behind a scrim, with the
 * collection's name set large over them — the poster outside a gallery rather
 * than a tile in a grid.
 */
function FeaturedCollection({
  collection,
  map,
}: {
  collection: Collection
  map: Map<number, MediaSummary>
}) {
  const { covers, count } = useCovers(collection.id, map, 6)
  const PrivacyIcon = PRIVACY_ICON[collection.privacy]

  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group relative block overflow-hidden rounded-xl border border-line bg-surface-2"
    >
      {/* The bleed: a strip of covers, cropped hard, dimmed under the type. */}
      <div className="absolute inset-0 flex" aria-hidden>
        {covers.map((m, i) => (
          <div
            key={m.id}
            className="h-full flex-1 overflow-hidden"
            style={{ opacity: 1 - i * 0.06 }}
          >
            {m.coverImage && (
              <img
                src={m.coverImage}
                alt=""
                className="size-full object-cover transition-transform duration-[1400ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
                style={{ transitionDelay: `${i * 50}ms` }}
              />
            )}
          </div>
        ))}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(95deg, rgb(var(--scrim) / 0.98) 0%, rgb(var(--scrim) / 0.92) 45%, rgb(var(--scrim) / 0.45) 100%)',
          }}
        />
      </div>

      <div className="relative flex min-h-[16rem] flex-col justify-end gap-4 p-7 md:min-h-[19rem] md:p-9">
        <h2 className="max-w-xl text-balance text-display-lg text-ink">{collection.name}</h2>

        {collection.description && (
          <p className="max-w-lg text-body text-ink-2">{collection.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="label-cat label-cat-plain">{pluralize(count, 'title')}</span>
          <span className="size-1 rounded-full bg-ink-3" aria-hidden />
          <span className="label-cat label-cat-plain flex items-center gap-1.5">
            <PrivacyIcon className="size-3" aria-hidden />
            {collection.privacy}
          </span>
          {collection.tags.slice(0, 3).map((tag) => (
            <Pill key={tag} size="sm">
              {tag}
            </Pill>
          ))}
          <span className="ml-auto flex items-center gap-2 text-label font-medium text-ink">
            Open
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-1.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Three cover treatments, rotated by position in the grid. Same information,
 * three compositions — which is what keeps a page of collections from reading
 * as a spreadsheet with pictures.
 */
function CollectionCard({
  collection,
  map,
  variant,
}: {
  collection: Collection
  map: Map<number, MediaSummary>
  variant: number
}) {
  const { covers, count } = useCovers(collection.id, map, 4)
  const PrivacyIcon = PRIVACY_ICON[collection.privacy]
  const [adding, setAdding] = useState(false)

  return (
    <div className="group relative">
      <Link
        to={`/collections/${collection.id}`}
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface',
          'transition-[transform,box-shadow,border-color] duration-[420ms] ease-[var(--ease-out-expo)]',
          'hover:-translate-y-1.5 hover:border-line-strong hover:shadow-md',
        )}
      >
        <div className="relative h-44 overflow-hidden bg-surface-2">
          {covers.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <span className="label-cat label-cat-plain">Empty</span>
            </div>
          ) : variant === 0 ? (
            <StackArt covers={covers} />
          ) : variant === 1 ? (
            <MosaicArt covers={covers} />
          ) : (
            <SplitArt covers={covers} />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 border-t border-line p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-display-sm leading-tight text-ink transition-colors group-hover:text-accent">
              {collection.name}
            </h2>
            <PrivacyIcon
              className="mt-1 size-3.5 shrink-0 text-ink-3"
              aria-label={collection.privacy}
            />
          </div>

          {collection.description && (
            <p className="clamp-2 text-meta text-ink-2">{collection.description}</p>
          )}

          <div className="mt-auto flex items-center gap-2 pt-2">
            <span className="label-cat label-cat-plain">{pluralize(count, 'title')}</span>
            {collection.tags.slice(0, 2).map((tag) => (
              <Pill key={tag} size="sm">
                {tag}
              </Pill>
            ))}
          </div>
        </div>
      </Link>

      {/* Quick add. Outside the link, so it can never navigate by accident. */}
      <IconButton
        label={`Add titles to ${collection.name}`}
        icon={<Plus className="size-4" />}
        variant="secondary"
        size="sm"
        onClick={() => setAdding(true)}
        className="absolute top-3 right-3 rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />

      <AddTitlesDialog
        collectionId={collection.id}
        collectionName={collection.name}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </div>
  )
}

/** Treatment 1 — the fanned stack, pulled half out of a crate. */
function StackArt({ covers }: { covers: MediaSummary[] }) {
  return (
    <div className="flex h-full items-end justify-center pt-7">
      <CoverStack
        covers={covers.map((m) => ({ id: m.id, src: m.coverImage, color: m.color }))}
        width={74}
        offset={30}
      />
    </div>
  )
}

/** Treatment 2 — a hard mosaic, covers cropped square and butted together. */
function MosaicArt({ covers }: { covers: MediaSummary[] }) {
  const four = covers.slice(0, 4)
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-px bg-line">
      {four.map((m, i) => (
        <div key={m.id} className="overflow-hidden bg-surface-2">
          {m.coverImage && (
            <img
              src={m.coverImage}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-110"
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/** Treatment 3 — one hero cover, three spines beside it. */
function SplitArt({ covers }: { covers: MediaSummary[] }) {
  const [hero, ...others] = covers
  return (
    <div className="flex h-full gap-px bg-line">
      <div className="w-[58%] overflow-hidden bg-surface-2">
        {hero?.coverImage && (
          <img
            src={hero.coverImage}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-px">
        {others.slice(0, 3).map((m) => (
          <div key={m.id} className="flex-1 overflow-hidden bg-surface-2">
            {m.coverImage && (
              <img
                src={m.coverImage}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-110"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
