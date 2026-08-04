import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { coverPlaceholder } from '@/lib/accent'
import { useResolvedTheme } from './theme'

type Ratio = 'poster' | 'wide' | 'square' | 'banner'

const RATIOS: Record<Ratio, string> = {
  poster: 'aspect-[2/3]',
  wide: 'aspect-[16/9]',
  square: 'aspect-square',
  banner: 'aspect-[21/9]',
}

export interface CoverImageProps {
  src: string | null | undefined
  alt: string
  /** AniList `coverImage.color` — used as the blur-up placeholder. */
  color?: string | null
  ratio?: Ratio
  className?: string
  priority?: boolean
  /** Content laid over the artwork — badges, scrims, hover panels. */
  children?: ReactNode
  /** Drop the frame's shadow (for artwork already inside a shadowed panel). */
  flat?: boolean
}

/**
 * Artwork, framed.
 *
 * Near-square corners, a hairline inset so pale covers don't dissolve into
 * pale paper, and a contact shadow underneath. The point is that a cover reads
 * as a *printed object standing on a shelf*, not as an `<img>` in a card — it
 * is what makes a grid of these look like a collection rather than a result
 * set.
 *
 * Aspect-locked so a grid never reflows when images land, and it blurs up from
 * the artwork's own dominant color rather than a gray box, so the page
 * arrives already tinted correctly.
 */
export function CoverImage({
  src,
  alt,
  color,
  ratio = 'poster',
  className,
  priority,
  children,
  flat,
}: CoverImageProps) {
  const theme = useResolvedTheme()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={cn('frame w-full', RATIOS[ratio], flat && 'shadow-none', className)}
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
            'size-full object-cover transition-opacity duration-500 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface CoverStackProps {
  covers: { src: string | null; color?: string | null; id: number | string }[]
  /** Width of the front-most cover, in px. */
  width?: number
  /** How far each card behind peeks out. */
  offset?: number
  /** Fan the stack open on hover of an ancestor with `group` set. */
  fan?: boolean
  className?: string
}

/**
 * The cover stack.
 *
 * A handful of covers layered and rotated like a pile of records pulled half
 * out of a crate. Collections use it as their identity, the dashboard uses it
 * for groups, and the profile uses it for favorites — same motif, three
 * places, which is how it becomes recognizable.
 *
 * On hover the stack fans open. That is the second signature interaction after
 * the poster lift.
 */
export function CoverStack({ covers, width = 96, offset = 22, fan = true, className }: CoverStackProps) {
  const theme = useResolvedTheme()
  const shown = covers.slice(0, 4)
  if (shown.length === 0) return null

  const mid = (shown.length - 1) / 2

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: width + offset * (shown.length - 1), height: width * 1.5 }}
      aria-hidden
    >
      {shown.map((cover, i) => {
        const tilt = (i - mid) * 4
        return (
          <div
            key={cover.id}
            className={cn('frame fan-card absolute top-0 origin-bottom', fan && 'fan-card-open')}
            style={
              {
                width,
                height: width * 1.5,
                left: i * offset,
                zIndex: i,
                backgroundColor: coverPlaceholder(cover.color, theme),
                transitionDelay: fan ? `${i * 40}ms` : undefined,
                '--rest': `rotate(${tilt}deg) translateY(${Math.abs(i - mid) * 3}px)`,
                '--fan': `rotate(${tilt * 1.9}deg) translateY(${-8 + Math.abs(i - mid) * 4}px) translateX(${(i - mid) * 9}px)`,
              } as React.CSSProperties
            }
          >
            {cover.src && (
              <img src={cover.src} alt="" loading="lazy" className="size-full object-cover" />
            )}
          </div>
        )
      })}
    </div>
  )
}
