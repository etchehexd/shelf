import { useEffect, useRef } from 'react'

/**
 * Sections arrive as you reach them.
 *
 * The complaint this answers is "nothing happens between sections": every
 * shelf on a long page was simply *there*, fully painted, from the moment the
 * route mounted, so scrolling was a camera pan across a static poster. One
 * short rise as a section crosses into view turns the same page into something
 * that unfolds.
 *
 * Deliberately austere:
 *
 *  - it fires **once** per element. A section that re-animates every time it
 *    re-enters the viewport is a section you cannot scroll past twice without
 *    being annoyed, and it makes scrolling back up feel broken.
 *  - it only ever moves 14px and 320ms. Anything longer reads as the page
 *    being slow rather than as the page being alive.
 *  - `rootMargin` starts the animation slightly *before* the element reaches
 *    the fold, so by the time it is comfortably on screen it has finished. A
 *    reveal you have to wait for is worse than no reveal.
 *  - if IntersectionObserver is missing, or motion is reduced, everything is
 *    visible immediately and nothing here runs.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.dataset.revealed = 'true'
      return
    }

    // Already on screen at mount — the first two sections of any page. Those
    // should not animate at all: the page load is the animation.
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.9) {
      el.dataset.revealed = 'true'
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.revealed = 'true'
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
