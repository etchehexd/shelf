import { Link } from 'react-router'
import { Bookmark } from 'lucide-react'
import { Button, Dialog, buttonClasses } from '@/design'
import { useAuthGate } from './gate'

/**
 * What happens when a signed-out visitor tries to change something.
 *
 * Mounted once, in the layout, because the thing it interrupts could be any
 * control on any page.
 *
 * The copy names the specific action that was refused rather than saying
 * "sign in to continue" — being told you need an account is much easier to
 * accept when the sentence proves the app understood what you were doing. It
 * also states plainly what stays open, so the wall reads as a boundary rather
 * than as a bait-and-switch.
 */
export function AuthGateDialog() {
  const reason = useAuthGate((s) => s.reason)
  const close = useAuthGate((s) => s.close)

  return (
    <Dialog
      open={reason != null}
      onClose={close}
      title="Sign in to keep this"
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close}>
            Not now
          </Button>
          <Link to="/auth" onClick={close} className={buttonClasses('primary', 'sm')}>
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex gap-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-quiet text-accent"
          aria-hidden
        >
          <Bookmark className="size-5" strokeWidth={1.6} />
        </span>

        <div className="min-w-0 space-y-3">
          <p className="text-body text-ink-2">
            You need an account to {reason ?? 'save changes'} — a shelf has to belong to
            somebody before anything can go on it.
          </p>
          <p className="text-meta text-ink-3">
            Browsing, searching and reading stay open either way. Nothing you've looked at is
            lost by signing in.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
