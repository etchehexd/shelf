import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The catalog label — mono, wide, uppercase, with a diamond tick. It is the
 * most repeated mark in the product and the fastest way to recognize a
 * screenshot of it.
 */
export function Eyebrow({
  children,
  tick = true,
  className,
}: {
  children: ReactNode
  tick?: boolean
  className?: string
}) {
  return (
    <span className={cn('label-cat', !tick && 'label-cat-plain', className)}>{children}</span>
  )
}

export interface SectionHeaderProps {
  /** The catalog label above the heading. */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Drop the hairline that runs from the eyebrow to the action. */
  bare?: boolean
  className?: string
}

/**
 * Section header, editorial style.
 *
 * The title, a hairline running out from it, and the section's one action at
 * the far end. That rule is what gives every section a visible top edge — the
 * thing that stops a long page reading as one undifferentiated scroll —
 * without spending a heavy divider on it.
 *
 * The title carries the whole message. There is no second line of copy
 * explaining the first: if a section needs a sentence to justify itself, it
 * probably shouldn't be a section.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  size = 'md',
  bare,
  className,
}: SectionHeaderProps) {
  const heading =
    size === 'lg' ? 'text-display-lg' : size === 'sm' ? 'text-display-sm' : 'text-display-md'

  return (
    <div className={cn('space-y-2.5', className)}>
      {eyebrow && <Eyebrow className="block">{eyebrow}</Eyebrow>}

      {/* Wraps rather than overflows: on a phone the title and the action are
          often both long enough that the connecting rule has to go. */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h2 className={cn('min-w-0 text-balance text-ink', heading)}>{title}</h2>
        {!bare && (
          <span className="hidden h-px min-w-8 flex-1 translate-y-[-0.35em] bg-line sm:block" aria-hidden />
        )}
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {description && <p className="max-w-prose text-body text-ink-2">{description}</p>}
    </div>
  )
}

/**
 * Standard vertical rhythm between the header and the body of a section.
 *
 * `min-w-0` is load-bearing: a grid or flex item defaults to `min-width: auto`,
 * so a section containing a horizontal rail would otherwise widen its column
 * to the rail's full unscrolled length and push the whole page sideways.
 */
export function Section({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('min-w-0 space-y-5', className)} {...rest} />
}

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  /** Only when it says something the title can't. Usually leave it out. */
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Empty states are drawn as an empty shelf rather than as a dashed box — the
 * absence should still look like part of the furniture.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-surface-2/60 px-6 py-14', className)}>
      {/* Three empty slots where covers would stand. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 opacity-[0.55]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-t-[3px] border border-dashed border-line-strong border-b-0"
            style={{ width: 64, height: [78, 96, 70][i] }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-line-strong" aria-hidden />

      <div className="relative flex flex-col items-center text-center">
        {icon && <div className="mb-4 text-ink-3">{icon}</div>}
        <p className="text-display-sm text-ink">{title}</p>
        {description && (
          <p className="mt-2 max-w-sm text-balance text-body text-ink-2">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  )
}
