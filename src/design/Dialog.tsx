import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useEscape, useFocusTrap, useScrollLock } from './hooks'
import { IconButton } from './Button'

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
} as const

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: keyof typeof WIDTHS
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEscape(open, onClose)
  useScrollLock(open)
  useFocusTrap(panelRef, open)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <motion.div
            className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className={cn(
              'relative my-auto w-full rounded-xl border border-line bg-surface shadow-lg',
              WIDTHS[size],
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div className="min-w-0">
                <h2 className="text-display-sm text-ink">{title}</h2>
                {description && <p className="mt-1.5 text-body text-ink-2">{description}</p>}
              </div>
              <IconButton
                label="Close"
                icon={<X className="size-4.5" />}
                size="sm"
                onClick={onClose}
                className="-mt-1 -mr-2"
              />
            </header>

            <div className="max-h-[min(60vh,600px)] overflow-y-auto px-6 pb-6">{children}</div>

            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
