import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { Eyebrow, ShelfLine, buttonClasses } from '@/design'

/**
 * A section that has nothing to show until there is an account behind it.
 *
 * Deliberately not a locked door and not a paywall. Every wall in the app leads
 * with what the section *is* and follows with what stays open, because a
 * product that refuses you on the first screen without explaining what it does
 * has not earned the account it is asking for.
 *
 * One component for all six gated routes, so the boundary reads identically
 * wherever you hit it — six bespoke sign-in screens is how an app ends up
 * feeling like six apps.
 */
export function SignInWall({
  section,
  headline,
  children,
  aside,
}: {
  /** The catalog label above the headline — the section's own name. */
  section: string
  headline: string
  /** One short paragraph on what this section is for. */
  children: ReactNode
  /** What remains available without an account. */
  aside?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <Eyebrow className="mb-5">{section}</Eyebrow>
      <h1 className="text-balance text-display-lg text-ink">{headline}</h1>
      <div className="prose-width mt-4 text-body text-ink-2">{children}</div>

      <ShelfLine className="mt-9" />

      <p className="mt-9 text-body text-ink-2">
        {aside ?? (
          <>
            Discover stays open without an account — search anything, open any title, read the
            whole record. Signing in is what gives you somewhere to put it.
          </>
        )}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/auth" className={buttonClasses('primary', 'lg')}>
          Sign in or create an account
        </Link>
        <Link to="/discover" className={buttonClasses('secondary', 'lg')}>
          Look around first
        </Link>
      </div>
    </div>
  )
}
