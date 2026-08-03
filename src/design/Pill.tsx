import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

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
   * Status is never communicated by colour alone — the dot always sits beside
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
        'inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface-2 font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2 text-micro' : 'h-7 px-2.5 text-meta',
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

/** Genre / tag chips — same shape, but clickable and unstyled by tone. */
export function Chip({
  active,
  className,
  ...rest
}: { active?: boolean } & HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 items-center rounded-sm border px-2.5 text-meta font-medium whitespace-nowrap',
        'transition-colors duration-[110ms]',
        active
          ? 'border-accent bg-accent-quiet text-accent'
          : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink',
        className,
      )}
      {...rest}
    />
  )
}
