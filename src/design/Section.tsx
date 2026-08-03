import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SectionHeaderProps {
  /** Small uppercase kicker above the heading. The only uppercase style in the app. */
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  size = 'md',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-micro text-ink-3 uppercase">{eyebrow}</p>}
        <h2
          className={cn(
            'font-display text-balance text-ink',
            size === 'sm' ? 'text-display-sm' : 'text-display-md',
          )}
        >
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-prose text-body text-ink-2">{description}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  )
}

/** Standard vertical rhythm between page sections. */
export function Section({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('space-y-5', className)} {...rest} />
}

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line',
        'px-6 py-16 text-center',
        className,
      )}
    >
      {icon && <div className="mb-4 text-ink-3">{icon}</div>}
      <p className="font-display text-display-sm text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-body text-ink-2 text-balance">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
