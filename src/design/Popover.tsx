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
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { useAnchoredPosition, useEscape, useFocusTrap, useOutsideDismiss, type Align, type Side } from './hooks'

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
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={floatingRef}
              role={role}
              aria-label={label}
              initial={{ opacity: 0, scale: 0.97, y: side === 'top' ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
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
                className,
              )}
            >
              {typeof children === 'function' ? children({ close }) : children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
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
  return <p className="px-2.5 pt-2 pb-1 text-micro text-ink-3 uppercase">{children}</p>
}
