import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** Escape key, scoped to whichever layer is currently on top. */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onEscape])
}

/**
 * Dismiss on pointer-down outside. Uses pointerdown rather than click so a
 * drag that starts inside and ends outside doesn't close the layer.
 */
export function useOutsideDismiss(
  refs: React.RefObject<HTMLElement | null>[],
  active: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (refs.some((r) => r.current?.contains(target))) return
      onDismiss()
    }
    // Deferred so the click that opened the layer doesn't immediately close it.
    const id = window.setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [refs, active, onDismiss])
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Traps Tab within `ref` and restores focus to the opener on unmount. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    if (!node) return

    const focusables = () =>
      [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    // Focus the first meaningful control, not the container, so screen readers
    // announce something useful.
    const initial = node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node
    initial.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKey)
    return () => {
      node.removeEventListener('keydown', onKey)
      opener?.focus?.({ preventScroll: true })
    }
  }, [ref, active])
}

/** Prevents background scroll while a modal layer is open. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [active])
}

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'

type Position = { top: number; left: number; side: Side }

/**
 * Anchored positioning with edge collision. Deliberately minimal — fixed
 * coordinates recomputed on scroll/resize, flipping to the opposite side when
 * the preferred one doesn't fit. No middleware system, because the app only
 * ever needs flip + clamp.
 */
export function useAnchoredPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  floatingRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  { side = 'bottom', align = 'center', offset = 8 }: { side?: Side; align?: Align; offset?: number } = {},
) {
  const [pos, setPos] = useState<Position | null>(null)

  const compute = useCallback(() => {
    const anchor = anchorRef.current
    const floating = floatingRef.current
    if (!anchor || !floating) return

    const a = anchor.getBoundingClientRect()
    const f = floating.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const pad = 8

    let resolved = side
    if (side === 'bottom' && a.bottom + offset + f.height > vh - pad && a.top - offset - f.height > pad) {
      resolved = 'top'
    } else if (side === 'top' && a.top - offset - f.height < pad && a.bottom + offset + f.height < vh - pad) {
      resolved = 'bottom'
    } else if (side === 'right' && a.right + offset + f.width > vw - pad) {
      resolved = 'left'
    } else if (side === 'left' && a.left - offset - f.width < pad) {
      resolved = 'right'
    }

    let top: number
    let left: number

    if (resolved === 'bottom' || resolved === 'top') {
      top = resolved === 'bottom' ? a.bottom + offset : a.top - offset - f.height
      left =
        align === 'start' ? a.left : align === 'end' ? a.right - f.width : a.left + a.width / 2 - f.width / 2
    } else {
      left = resolved === 'right' ? a.right + offset : a.left - offset - f.width
      top =
        align === 'start' ? a.top : align === 'end' ? a.bottom - f.height : a.top + a.height / 2 - f.height / 2
    }

    left = Math.round(Math.min(Math.max(pad, left), vw - f.width - pad))
    top = Math.round(Math.min(Math.max(pad, top), vh - f.height - pad))

    // Bail out when nothing moved. A ResizeObserver on the floating element
    // fires for every content change inside it, and returning a fresh object
    // each time would re-render — and visibly jitter — a popover whose content
    // is animating, which is exactly what the rating panel does.
    setPos((prev) =>
      prev && prev.top === top && prev.left === left && prev.side === resolved
        ? prev
        : { top, left, side: resolved },
    )
  }, [anchorRef, floatingRef, side, align, offset])

  useIsoLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    compute()

    const onChange = () => compute()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)

    const ro = new ResizeObserver(onChange)
    if (floatingRef.current) ro.observe(floatingRef.current)

    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
      ro.disconnect()
    }
  }, [open, compute])

  return pos
}

/**
 * Hold-to-repeat, used by the progress stepper so binge-logging six episodes is
 * one press rather than six taps. Accelerates from 400ms to 60ms.
 */
export function useHoldRepeat(onTick: () => void) {
  const timer = useRef<number | null>(null)
  const delay = useRef(400)
  const cb = useRef(onTick)
  cb.current = onTick

  const stop = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
    delay.current = 400
  }, [])

  const start = useCallback(() => {
    stop()
    const tick = () => {
      cb.current()
      delay.current = Math.max(60, delay.current * 0.72)
      timer.current = window.setTimeout(tick, delay.current)
    }
    timer.current = window.setTimeout(tick, delay.current)
  }, [stop])

  useEffect(() => stop, [stop])

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  }
}
