import { genreColors } from '@/lib/genre'
import { cn } from '@/lib/cn'
import { useResolvedTheme } from './theme'

export interface GenrePillProps {
  genre: string
  size?: 'sm' | 'md'
  /** Filled rather than washed — for the one or two that are "yours". */
  solid?: boolean
  className?: string
}

/**
 * A genre, in its own color.
 *
 * The color comes from `lib/genre` rather than from a prop, which is the whole
 * point: every genre chip in the product asks the same function, so Action is
 * the same red on a media page, in the Discover filter panel, on a profile and
 * in a library filter row. A chip that took a `tone` prop would be a chip that
 * is a different color depending on which screen you are on.
 *
 * Inline styles rather than classes, because the palette is 20+ hues computed
 * at runtime and enumerating them as utilities would mean a class per genre per
 * theme — a table nobody would keep in sync with the catalog.
 */
export function GenrePill({ genre, size = 'md', solid, className }: GenrePillProps) {
  const theme = useResolvedTheme()
  const c = genreColors(genre, theme)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color] duration-200',
        size === 'sm' ? 'h-6 px-2.5 text-[0.6875rem]' : 'h-7 px-3 text-meta',
        className,
      )}
      style={
        solid
          ? { background: c.solid, color: c.solidInk, borderColor: 'transparent' }
          : { background: c.bg, color: c.fg, borderColor: c.bg }
      }
    >
      {genre}
    </span>
  )
}
