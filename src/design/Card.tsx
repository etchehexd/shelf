import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'raised' | 'sunk' | 'outline' | 'plain'
type Radius = 'sm' | 'md' | 'lg' | 'xl'

const TONES: Record<Tone, string> = {
  /* The default room: paper on paper, one hairline. */
  raised: 'bg-surface border border-line',
  /* A well pressed into the page — used for anything nested. */
  sunk: 'bg-surface-2 border border-transparent',
  /* Structure without weight. Reads as a placeholder or a secondary block. */
  outline: 'bg-transparent border border-line',
  plain: '',
}

const RADII: Record<Radius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
}

const PADDING = {
  none: '',
  tight: 'p-3.5',
  compact: 'p-5',
  standard: 'p-6',
  loose: 'p-8',
} as const

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the hover lift. Use on anything that navigates or opens something. */
  interactive?: boolean
  tone?: Tone
  radius?: Radius
  padding?: keyof typeof PADDING
}

/**
 * The soft container that sharp artwork sits inside.
 *
 * Radius is a prop rather than a constant on purpose: the house style mixes
 * corner sizes deliberately — big soft outer panels, tighter inner wells,
 * near-square artwork — so that the page reads as designed rather than as a
 * stack of identical rounded rectangles.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, tone = 'raised', radius = 'lg', padding = 'standard', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative',
        TONES[tone],
        RADII[radius],
        PADDING[padding],
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)] ' +
            'hover:-translate-y-1 hover:border-line-strong hover:shadow-md',
        className,
      )}
      {...rest}
    />
  )
})

/** A quieter container for content that sits *inside* a card. */
export function Well({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md bg-surface-2 p-4', className)} {...rest} />
}

/**
 * The shelf: a hairline with a pool of shadow above it and a short ember
 * end-cap. Draw it under any row of artwork and the row becomes a bookcase.
 * It is the most repeated structural motif in the product.
 */
export function ShelfLine({ className }: { className?: string }) {
  return <div className={cn('shelf-line', className)} aria-hidden />
}

/**
 * The section rule — a short solid segment that fades to a hairline. Closes
 * section headers so a page reads as chapters rather than as one long scroll.
 */
export function Rule({ className }: { className?: string }) {
  return <div className={cn('rule', className)} aria-hidden />
}
