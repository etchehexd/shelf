import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface FieldProps {
  label: string
  hint?: string
  error?: string
  /** Right-aligned counter, e.g. "18 / 280". */
  counter?: string
  children: (props: { id: string; 'aria-describedby'?: string }) => ReactNode
  className?: string
}

export function Field({ label, hint, error, counter, children, className }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label font-medium text-ink">
          {label}
        </label>
        {counter && <span className="font-mono-num text-meta text-ink-3">{counter}</span>}
      </div>

      {children({ id, 'aria-describedby': describedBy })}

      {error ? (
        <p id={`${id}-error`} className="text-meta text-dropped">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-meta text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'w-full rounded-md border border-line-strong bg-surface-2 px-3 text-label text-ink ' +
  'placeholder:text-ink-3 transition-colors duration-[110ms] ' +
  'focus:border-accent focus:bg-surface focus:outline-none ' +
  'disabled:opacity-45'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-9.5', className)} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(CONTROL, 'resize-y py-2.5', className)} {...rest} />
  },
)

/**
 * The one search field in the product.
 *
 * Four screens used to build this by hand out of an Input and an absolutely
 * positioned icon, with four slightly different paddings. Now they don't.
 */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, ...rest }, ref) {
    return (
      <div className={cn('relative min-w-0', className)}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <Input ref={ref} type="search" className="pl-9" {...rest} />
      </div>
    )
  },
)

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-6',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      <span className="min-w-0">
        <span className="block text-label font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-meta text-ink-2">{description}</span>}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5.5 w-9.5 shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-accent' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4.5 rounded-full bg-surface shadow-sm transition-[left] duration-200',
            'ease-[cubic-bezier(.2,0,0,1)]',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </button>
    </label>
  )
}
