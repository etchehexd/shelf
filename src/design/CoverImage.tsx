import { useState } from 'react'
import { cn } from '@/lib/cn'
import { coverPlaceholder } from '@/lib/accent'
import { useResolvedTheme } from './theme'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<Size, string> = {
  xs: 'w-10',
  sm: 'w-16',
  md: 'w-full',
  lg: 'w-full',
  xl: 'w-full',
}

export interface CoverImageProps {
  src: string | null | undefined
  alt: string
  /** AniList `coverImage.color` — used as the blur-up placeholder. */
  color?: string | null
  size?: Size
  className?: string
  rounded?: 'sm' | 'md' | 'lg'
  priority?: boolean
}

/**
 * Aspect-locked to 2:3 so a grid never reflows when images land, and blurs up
 * from the artwork's own dominant colour rather than a grey box — the page
 * arrives already tinted correctly.
 */
export function CoverImage({
  src,
  alt,
  color,
  size = 'md',
  className,
  rounded = 'md',
  priority,
}: CoverImageProps) {
  const theme = useResolvedTheme()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const radius = rounded === 'sm' ? 'rounded-sm' : rounded === 'lg' ? 'rounded-lg' : 'rounded-md'

  return (
    <div
      className={cn(
        'relative aspect-[2/3] overflow-hidden bg-surface-2',
        radius,
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: coverPlaceholder(color, theme) }}
    >
      {src && !failed && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'size-full object-cover transition-opacity duration-300 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {/* A hairline inset keeps light covers from bleeding into a light canvas. */}
      <div
        className={cn('pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/8', radius)}
        aria-hidden
      />
    </div>
  )
}
