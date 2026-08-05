import { Children, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Rail } from './Rail'
import { ShelfLine } from './Card'

/**
 * The shelf primitives.
 *
 * DESIGN.md describes a house style built from a handful of motifs — the
 * frame, the lift, the shelf line, the cover stack, the lean, the art wash.
 * They existed as CSS and as one-off usages, which is how the product ended up
 * looking like a competent dark dashboard: every surface reached for the same
 * horizontal rail of equal-width posters, and the motifs that give the app its
 * character appeared once or twice in the entire codebase.
 *
 * These are the motifs as *components*, so a page picks a shelf form the way
 * it picks a heading level. Three forms, deliberately distinguishable at a
 * glance from across the room:
 *
 *   ShelfRail   a rail standing on a shelf line — the default, and the one
 *               that makes a row of covers read as a bookshelf
 *   LeanRow     covers leaning on each other, spreading apart on hover
 *   StackRow    cover stacks, fanning open — for shelves *of shelves*
 *
 * A page that alternates between them stops feeling like a feed.
 */

/* ------------------------------------------------------------------ rail -- */

export interface ShelfRailProps {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Drop the shelf line — only for rails that already sit on one. */
  bare?: boolean
  gap?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

/**
 * One width per size. The lead is *not* wider any more.
 *
 * Graduating the widths sounded like rhythm and rendered as a mistake: the
 * first cover a few pixels taller than its neighbours, every title beneath it
 * bottom-aligning at a different line count, and a row that reads as broken
 * rather than as composed. Rhythm between sections is the shelf *form's* job —
 * rail versus lean versus grid — not a size ramp inside a single row.
 */
const RAIL_WIDTH: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-28 md:w-32',
  md: 'w-32 md:w-40',
  lg: 'w-40 md:w-52',
}

export function ShelfRail({
  children,
  size = 'md',
  bare,
  gap = 'md',
  className,
  'aria-label': ariaLabel,
}: ShelfRailProps) {
  const items = Children.toArray(children)
  if (items.length === 0) return null

  return (
    <div className={cn('min-w-0', className)}>
      <Rail aria-label={ariaLabel} gap={gap}>
        {items.map((child, i) => (
          <div key={i} className={cn('shrink-0', RAIL_WIDTH[size])}>
            {child}
          </div>
        ))}
      </Rail>
      {!bare && <ShelfLine className="mt-2.5" />}
    </div>
  )
}

/* ------------------------------------------------------------------ lean -- */

export interface LeanRowProps {
  children: ReactNode
  /** How far each cover tucks behind the one before it. */
  overlap?: number
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

/**
 * Covers shelved too tightly, leaning on each other.
 *
 * The whole row breathes outward when the pointer enters it and the hovered
 * cover pulls forward — the cheapest way to make a static row of artwork feel
 * like objects rather than images. Used where a row is *browsable* rather than
 * exhaustive: recommendations, relations, "more like this".
 *
 * Not a rail: this one does not scroll, because the lean only reads when you
 * can see the whole row leaning. Cap the list before you hand it over.
 */
export function LeanRow({
  children,
  // 0.9rem, not 2.25. At the old value a 128px cover showed roughly 40px of
  // itself — a row of vertical slivers you could not identify a single title
  // from. The lean has to read as "shelved tightly", not as "shredded".
  overlap = 0.9,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: LeanRowProps) {
  const items = Children.toArray(children)
  if (items.length === 0) return null

  return (
    <div className={cn('min-w-0', className)} role="list" aria-label={ariaLabel}>
      <div
        className="overlap-row no-scrollbar overflow-x-auto"
        style={{ '--overlap': `-${overlap}rem` } as React.CSSProperties}
      >
        {items.map((child, i) => (
          <div
            key={i}
            role="listitem"
            className={cn('shrink-0', size === 'sm' ? 'w-24 md:w-28' : 'w-30 md:w-36')}
            // Later covers sit further back, so the row has a depth order and
            // the leftmost is unambiguously the front of the stack.
            style={{ zIndex: items.length - i }}
          >
            {child}
          </div>
        ))}
      </div>
      <ShelfLine className="mt-2.5" />
    </div>
  )
}

/* ------------------------------------------------------------------ band -- */

export interface ArtBandProps {
  /** The artwork the band takes its color from. Usually the lead item's cover. */
  src: string | null | undefined
  children: ReactNode
  /** Bleed past the page gutters — for the one band per page that earns it. */
  bleed?: boolean
  className?: string
}

/**
 * A section standing in a pool of its own artwork.
 *
 * The art wash — a cover blown up, blurred past recognition and dimmed — is
 * how a section takes its color from the work without introducing a single new
 * UI color. It is the motif that most changes how a page *feels*, and it was
 * being used on exactly two screens.
 *
 * One per page. It stops working the moment there are two.
 */
export function ArtBand({ src, children, bleed, className }: ArtBandProps) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden',
        bleed ? 'bleed-x border-y border-line px-5 py-10 md:px-10 md:py-12' : 'rounded-xl px-6 py-8',
        className,
      )}
    >
      {src && (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <img src={src} alt="" className="art-wash size-full object-cover" />
          <div className="absolute inset-0 bg-canvas/74" />
        </div>
      )}
      <div className="mx-auto w-full max-w-(--container-page)">{children}</div>
    </section>
  )
}
