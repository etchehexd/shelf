import {
  cloneElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import {
  useAnchoredPosition,
  useEscape,
  useFocusTrap,
  useIsoLayoutEffect,
  useOutsideDismiss,
  type Align,
  type Side,
} from './hooks'

type TriggerProps = {
  ref?: Ref<HTMLElement>
  onClick?: (e: React.MouseEvent) => void
  'aria-expanded'?: boolean
  'aria-haspopup'?: 'dialog' | 'menu'
}

export interface PopoverProps {
  trigger: ReactElement<TriggerProps>
  children: ReactNode | ((api: { close: () => void }) => ReactNode)
  side?: Side
  align?: Align
  offset?: number
  className?: string
  /** Popovers holding a form or a list trap focus; hover cards don't. */
  trapFocus?: boolean
  role?: 'dialog' | 'menu'
  label?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'center',
  offset = 8,
  className,
  trapFocus = true,
  role = 'dialog',
  label,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const isControlled = controlledOpen != null
  const open = isControlled ? controlledOpen : uncontrolled

  const anchorRef = useRef<HTMLElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const close = useCallback(() => setOpen(false), [setOpen])

  const pos = useAnchoredPosition(anchorRef, floatingRef, open, { side, align, offset })
  const dismissRefs = useMemo(() => [anchorRef, floatingRef], [])

  useOutsideDismiss(dismissRefs, open, close)
  useEscape(open, close)
  useFocusTrap(floatingRef, open && trapFocus)

  const anchored = cloneElement(trigger, {
    ref: anchorRef,
    'aria-expanded': open,
    'aria-haspopup': role,
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e)
      setOpen(!open)
    },
  })

  return (
    <>
      {anchored}
      {open &&
        createPortal(
          /**
           * Mounted only while open, with a CSS entrance and no exit animation.
           *
           * There used to be an AnimatePresence exit here, and it was the
           * source of the rating panel's worst behavior: while a panel is
           * exiting it is rendered from a *frozen snapshot* of its last props,
           * so a panel that was reopened before the fade finished could show a
           * stale score, and the dying copy still occupied the same pixels.
           *
           * A menu should also just be gone the moment you dismiss it —
           * a lingering fade is what makes a popover feel unresponsive.
           */
          <div
            ref={floatingRef}
            role={role}
            aria-label={label}
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              // Keep it out of the way until the first measurement lands,
              // otherwise it flashes at the top-left corner.
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={cn(
              'z-50 rounded-lg border border-line bg-surface p-1.5 shadow-md',
              'origin-top focus:outline-none',
              'motion-safe:animate-[pop-in_170ms_var(--ease-out-expo)]',
              className,
            )}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          document.body,
        )}
    </>
  )
}

/* ------------------------------------------------------------ context menu -- */

export interface ContextPoint {
  x: number
  y: number
}

/**
 * Right-click menus.
 *
 * Same menu furniture as `Popover`, but anchored to a point rather than an
 * element — so any poster in the app can carry the full set of actions without
 * spending a visible button on them.
 */
export function useContextMenu() {
  const [point, setPoint] = useState<ContextPoint | null>(null)

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPoint({ x: e.clientX, y: e.clientY })
  }, [])

  const close = useCallback(() => setPoint(null), [])

  return { point, open, close, isOpen: point != null }
}

export function ContextMenu({
  point,
  onClose,
  label,
  children,
  className,
}: {
  point: ContextPoint | null
  onClose: () => void
  label?: string
  children: ReactNode | ((api: { close: () => void }) => ReactNode)
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const refs = useMemo(() => [ref], [])
  const open = point != null

  useOutsideDismiss(refs, open, onClose)
  useEscape(open, onClose)
  useFocusTrap(ref, open)

  /**
   * Measured after mount so the menu can flip away from the viewport edges;
   * until then it is laid out but not painted.
   *
   * A ResizeObserver rather than a one-shot read: a menu measured before its
   * webfont lands comes back a few pixels short, and a few pixels short is
   * exactly enough to leave the last item hanging off the bottom of the screen.
   */
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useIsoLayoutEffect(() => {
    if (!open) {
      setSize(null)
      return
    }
    const el = ref.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize((prev) =>
        prev && prev.w === rect.width && prev.h === rect.height
          ? prev
          : { w: rect.width, h: rect.height },
      )
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  if (!open) return null

  const pad = 8
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const left = Math.max(pad, size ? Math.min(point.x, vw - size.w - pad) : point.x)
  const top = Math.max(pad, size ? Math.min(point.y, vh - size.h - pad) : point.y)

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      style={{
        position: 'fixed',
        top,
        left,
        // A long menu scrolls inside itself rather than off the screen.
        maxHeight: vh - top - pad,
        visibility: size ? 'visible' : 'hidden',
      }}
      className={cn(
        'z-50 min-w-52 overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface p-1.5 shadow-lg focus:outline-none',
        'motion-safe:animate-[pop-in_160ms_var(--ease-out-expo)]',
        className,
      )}
    >
      {typeof children === 'function' ? children({ close: onClose }) : children}
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */

export interface MenuItemProps {
  icon?: ReactNode
  children: ReactNode
  onSelect?: () => void
  selected?: boolean
  danger?: boolean
  trailing?: ReactNode
  disabled?: boolean
}

export function MenuItem({
  icon,
  children,
  onSelect,
  selected,
  danger,
  trailing,
  disabled,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-label',
        'transition-colors duration-[110ms] disabled:pointer-events-none disabled:opacity-45',
        danger ? 'text-dropped hover:bg-dropped/10' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        selected && !danger && 'text-ink',
      )}
    >
      {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="label-cat label-cat-plain px-2.5 pt-2 pb-1.5">{children}</p>
}
