import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Card, Field, Input, toast } from '@/design'
import { useAuth } from '@/data/supabase/auth'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const { enabled, session, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!enabled) {
    return (
      <Centered>
        <h1 className="text-display-md text-ink">Sync isn't configured</h1>
        <p className="mt-3 text-body text-ink-2">
          Shelf is running in local-only mode. Your library works exactly as it does with an
          account — it just lives in this browser.
        </p>
        <p className="mt-4 text-meta text-ink-3">
          To enable sync, add your Supabase URL and anon key to{' '}
          <code className="rounded-sm bg-surface-2 px-1">.env.local</code> and run the migration in{' '}
          <code className="rounded-sm bg-surface-2 px-1">supabase/migrations</code>.
        </p>
        <Link to="/" className="mt-6 inline-block text-label font-medium text-accent hover:underline">
          Back to your dashboard
        </Link>
      </Centered>
    )
  }

  if (session) {
    return (
      <Centered>
        <h1 className="text-display-md text-ink">You're signed in</h1>
        <p className="mt-3 text-body text-ink-2">
          Syncing as {session.user.email}. Everything you track is saved locally first and pushed
          up in the background.
        </p>
        <Link to="/" className="mt-6 inline-block text-label font-medium text-accent hover:underline">
          Back to your dashboard
        </Link>
      </Centered>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const result =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

    setBusy(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === 'signup') {
      toast({ message: 'Check your email to confirm your account' })
    } else {
      toast({ message: 'Signed in — syncing your library' })
      navigate('/')
    }
  }

  return (
    <Centered>
      <h1 className="text-display-md text-ink">
        {mode === 'signin' ? 'Welcome back' : 'Make a shelf'}
      </h1>
      <p className="mt-2 mb-8 text-body text-ink-2">
        {mode === 'signin'
          ? 'Sign in to sync your library across devices.'
          : 'Your library syncs across devices, and collections become shareable.'}
      </p>

      <Card padding="compact">
        {/* No display-name field. A new account is an empty room, not a
            half-filled form — the name goes on the door in Profile → Edit,
            when there is something behind it worth naming. */}
        <form onSubmit={submit} className="space-y-4 text-left">
          <Field label="Email">
            {(props) => (
              <Input
                {...props}
                data-autofocus
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="Password"
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            error={error ?? undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>

          <Button type="submit" variant="primary" block loading={busy}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-label text-ink-2">
        {mode === 'signin' ? "Don't have an account?" : 'Already have one?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
          className="font-medium text-accent hover:underline"
        >
          {mode === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>

      {/* Guest mode is the default, not a fallback, so the way out of this
          screen is never hidden. Nothing in the app is gated behind an
          account except the profile, which has nothing to hold without one. */}
      <p className="mt-8 text-meta text-ink-3">
        You don't need an account. Everything — tracking, ranking, collections — already works
        signed out and stays on this device. Signing in adds sync, sharing, and a profile.
      </p>
      <Link
        to="/"
        className="label-cat label-cat-plain mt-5 inline-block hover:text-ink"
      >
        Keep looking around
      </Link>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-left sm:text-center">{children}</div>
    </div>
  )
}
