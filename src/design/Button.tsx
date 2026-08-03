import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger' | 'art'
type Size = 'sm' | 'md' | 'lg'

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-[110ms] ease-out ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-sm',
  // `art` borrows the current page's artwork accent — see lib/accent.ts
  art: 'bg-art text-canvas hover:brightness-110 shadow-sm',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  quiet: 'bg-surface-2 text-ink hover:bg-surface-3',
  danger: 'text-dropped hover:bg-dropped/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-meta',
  md: 'h-9.5 px-4 text-label',
  lg: 'h-11 px-5 text-title',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  trailing?: ReactNode
  loading?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, trailing, loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {trailing}
    </button>
  )
})

type IconSize = 'sm' | 'md' | 'lg'

const ICON_SIZES: Record<IconSize, string> = {
  sm: 'size-8',
  md: 'size-9.5',
  lg: 'size-11',
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: icon-only controls must still have an accessible name. */
  label: string
  icon: ReactNode
  variant?: Variant
  size?: IconSize
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], ICON_SIZES[size], 'shrink-0 p-0', className)}
      {...rest}
    >
      {icon}
    </button>
  )
})
