import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

export interface RailProps {
  children: ReactNode
  className?: string
  /** Gap between items. */
  gap?: 'sm' | 'md'
  'aria-label'?: string
}

/**
 * Horizontal scroller with arrow affordances that only appear when there is
 * somewhere to go. Scrolls by ~90% of the visible width so an item is never
 * cut exactly in half at the new position.
 */
export function Rail({ children, className, gap = 'md', 'aria-label': ariaLabel }: RailProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft >= max - 2)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [measure])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  const showArrows = !(atStart && atEnd)

  return (
    <div className={cn('group/rail relative', className)}>
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        className={cn(
          // pt-2/-mt-2: overflow-x:auto implies overflow-y:auto, so a card
          // lifting 6px on hover was being clipped at the top of every rail in
          // the product. The padding gives it room; the negative margin gives
          // the space back to the layout.
          'no-scrollbar flex overflow-x-auto scroll-smooth pt-2 -mt-2 pb-1',
          gap === 'sm' ? 'gap-3' : 'gap-5',
        )}
      >
        {children}
      </div>

      {showArrows && (
        <>
          <RailArrow side="left" disabled={atStart} onClick={() => scrollBy(-1)} />
          <RailArrow side="right" disabled={atEnd} onClick={() => scrollBy(1)} />
        </>
      )}
    </div>
  )
}

function RailArrow({
  side,
  disabled,
  onClick,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-0 bottom-1 z-10 flex w-20 items-center',
        side === 'left' ? 'left-0 justify-start' : 'right-0 justify-end',
        // Only reveal on hover of the rail, or when focus lands inside it.
        'opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 focus-within:opacity-100',
        disabled && 'group-hover/rail:opacity-0',
      )}
    >
      <IconButton
        label={side === 'left' ? 'Scroll left' : 'Scroll right'}
        icon={side === 'left' ? <ChevronLeft className="size-4.5" /> : <ChevronRight className="size-4.5" />}
        variant="secondary"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'pointer-events-auto rounded-full shadow-md',
          disabled && 'invisible',
        )}
      />
    </div>
  )
}
