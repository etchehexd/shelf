import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { uuid } from '@/lib/ids'

/**
 * A module-level emitter rather than context, so any layer — including store
 * middleware and the sync outbox — can raise a toast without a hook.
 *
 * Undo is first-class: every mutation in the app records `from` in its activity
 * event, which is exactly what an undo callback needs. See ARCHITECTURE.md.
 */

export interface ToastOptions {
  message: ReactNode
  /** Optional single action. Deliberately one, not a row of buttons. */
  action?: { label: string; onClick: () => void }
  tone?: 'neutral' | 'danger'
  duration?: number
}

interface ToastRecord extends ToastOptions {
  id: string
}

type Listener = (toasts: ToastRecord[]) => void

let toasts: ToastRecord[] = []
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l([...toasts])
}

export function toast(options: ToastOptions) {
  const record: ToastRecord = { id: uuid(), duration: 4000, tone: 'neutral', ...options }
  toasts = [...toasts, record].slice(-3)
  emit()
  return record.id
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function ToastHost() {
  const [items, setItems] = useState<ToastRecord[]>([])

  useEffect(() => {
    listeners.add(setItems)
    return () => {
      listeners.delete(setItems)
    }
  }, [])

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-70 flex flex-col items-center gap-2 p-6"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function ToastItem({ toast: t }: { toast: ToastRecord }) {
  useEffect(() => {
    if (!t.duration) return
    const id = window.setTimeout(() => dismissToast(t.id), t.duration)
    return () => window.clearTimeout(id)
  }, [t.id, t.duration])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.14 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex items-center gap-4 rounded-md border border-line',
        'bg-surface py-2.5 pr-2.5 pl-4 shadow-lg',
      )}
    >
      <span className={cn('text-label', t.tone === 'danger' ? 'text-dropped' : 'text-ink')}>
        {t.message}
      </span>

      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action?.onClick()
            dismissToast(t.id)
          }}
          className="shrink-0 rounded-sm px-2 py-1 text-label font-medium text-accent hover:bg-accent-quiet"
        >
          {t.action.label}
        </button>
      )}
    </motion.div>
  )
}
