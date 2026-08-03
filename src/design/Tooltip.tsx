import { cloneElement, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { useAnchoredPosition, type Align, type Side } from './hooks'

/**
 * A shared timer means moving between neighbouring tooltips is instant while
 * the first one still costs 400ms — the standard "tooltip group" behaviour that
 * stops a toolbar from feeling laggy.
 */
let groupOpenUntil = 0

type TriggerProps = {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (e: React.PointerEvent) => void
  onPointerLeave?: (e: React.PointerEvent) => void
  onFocus?: (e: React.FocusEvent) => void
  onBlur?: (e: React.FocusEvent) => void
}

export interface TooltipProps {
  content: ReactNode
  children: ReactElement<TriggerProps>
  side?: Side
  align?: Align
  delay?: number
}

export function Tooltip({ content, children, side = 'top', align = 'center', delay = 400 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  const pos = useAnchoredPosition(anchorRef, floatingRef, open, { side, align, offset: 6 })

  const show = () => {
    if (timer.current) window.clearTimeout(timer.current)
    const wait = Date.now() < groupOpenUntil ? 0 : delay
    timer.current = window.setTimeout(() => setOpen(true), wait)
  }

  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current)
    groupOpenUntil = Date.now() + 300
    setOpen(false)
  }

  const anchored = cloneElement(children, {
    ref: anchorRef,
    onPointerEnter: (e: React.PointerEvent) => {
      children.props.onPointerEnter?.(e)
      show()
    },
    onPointerLeave: (e: React.PointerEvent) => {
      children.props.onPointerLeave?.(e)
      hide()
    },
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e)
      setOpen(true)
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e)
      hide()
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
              role="tooltip"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
              style={{
                position: 'fixed',
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                visibility: pos ? 'visible' : 'hidden',
              }}
              className={cn(
                'pointer-events-none z-60 max-w-64 rounded-sm bg-ink px-2 py-1',
                'text-meta font-medium text-canvas shadow-md',
              )}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
