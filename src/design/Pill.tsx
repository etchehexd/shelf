import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { genreColors } from '@/lib/genre'
import { useResolvedTheme } from './theme'

export type Tone =
  | 'neutral'
  | 'accent'
  | 'art'
  | 'current'
  | 'completed'
  | 'planning'
  | 'paused'
  | 'dropped'

const DOT: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  accent: 'bg-accent',
  art: 'bg-art',
  current: 'bg-watching',
  completed: 'bg-completed',
  planning: 'bg-planning',
  paused: 'bg-paused',
  dropped: 'bg-dropped',
}

const TEXT: Record<Tone, string> = {
  neutral: 'text-ink-2',
  accent: 'text-accent',
  art: 'text-art',
  current: 'text-watching',
  completed: 'text-completed',
  planning: 'text-planning',
  paused: 'text-paused',
  dropped: 'text-dropped',
}

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /**
   * Status is never communicated by color alone — the dot always sits beside
   * a text label. See DESIGN.md §Accessibility.
   */
  dot?: boolean
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Pill({
  tone = 'neutral',
  dot,
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2.5 text-[0.6875rem]' : 'h-7 px-3 text-meta',
        tone === 'neutral' ? 'text-ink-2' : TEXT[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} aria-hidden />}
      {icon}
      {children}
    </span>
  )
}

/**
 * Genre / tag chips — same shape, but clickable.
 *
 * Passing `genre` tints the inactive state with that genre's own color, so a
 * row of them is scannable rather than a wall of identical grey. The active
 * state stays brand accent regardless: "selected" has to look the same for
 * every chip in the product, or selection stops being readable.
 */
export function Chip({
  active,
  genre,
  className,
  ...rest
}: { active?: boolean; genre?: string } & HTMLAttributes<HTMLButtonElement>) {
  const theme = useResolvedTheme()
  const c = genre && !active ? genreColors(genre, theme) : null

  return (
    <button
      type="button"
      style={c ? { background: c.bg, color: c.fg, borderColor: c.bg } : undefined}
      className={cn(
        'inline-flex h-7.5 items-center rounded-full border px-3 text-meta font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]',
        active
          ? // Squishes on the way in, like a real button being pressed. Keyed
            // by the class alone — a chip that is already active and re-renders
            // does not replay it, because the animation belongs to the moment
            // of turning on, not to being on.
            'border-accent-line bg-accent text-accent-ink shadow-xs motion-safe:animate-[squish_300ms_var(--ease-spring)]'
          : c
            ? 'hover:brightness-125'
            : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink',
        className,
      )}
      {...rest}
    />
  )
}
