import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the hover lift. Use on anything that navigates or opens something. */
  interactive?: boolean
  padding?: 'none' | 'compact' | 'standard'
}

const PADDING = {
  none: '',
  compact: 'p-5',
  standard: 'p-6',
} as const

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, padding = 'standard', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-line bg-surface',
        PADDING[padding],
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-[110ms] ease-out ' +
            'hover:-translate-y-[3px] hover:border-line-strong hover:shadow-sm',
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
