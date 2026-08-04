import { useState } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

const SIZES = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-meta',
  md: 'size-10 text-label',
  lg: 'size-16 text-title',
  xl: 'size-28 text-display-md',
} as const

export interface AvatarProps {
  src?: string | null
  name: string
  size?: keyof typeof SIZES
  className?: string
  ring?: boolean
}

export function Avatar({ src, name, size = 'md', className, ring }: AvatarProps) {
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-surface-3 font-semibold text-ink-2 select-none',
        SIZES[size],
        ring && 'ring-3 ring-canvas',
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  )
}
