import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSyncConfigured } from './client'
import { startSync, stopSync } from '@/data/sync/engine'

interface AuthValue {
  session: Session | null
  loading: boolean
  /** False when no Supabase credentials are configured — local-only mode. */
  enabled: boolean
  /**
   * Whether this visitor may change anything.
   *
   * The single authority for it, so no screen can invent its own answer. Two
   * cases resolve to true and they are not the same thing:
   *
   *   signed in            — an account exists to attach the change to
   *   sync not configured  — there is no sign-in to require, so requiring one
   *                          would brick the app with no way out from inside it
   *
   * Everything else is a read-only visit: browse, search, open a title, see
   * what the product is. Nothing is written until there is somewhere to put it.
   */
  canWrite: boolean
  /** True only when a sign-in is possible and hasn't happened. */
  signedOut: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // With no backend there is nothing to wait for, so the app renders instantly.
  const [loading, setLoading] = useState(isSyncConfigured)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // The sync engine's lifetime is exactly the session's lifetime.
  useEffect(() => {
    if (!session?.user) {
      stopSync()
      return
    }
    void startSync(session.user.id)
    return () => stopSync()
  }, [session?.user?.id])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      enabled: isSyncConfigured,
      canWrite: !isSyncConfigured || Boolean(session),
      signedOut: isSyncConfigured && !session,

      signIn: async (email, password) => {
        if (!supabase) return { error: 'Sync is not configured.' }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },

      /**
       * Signing up creates an account and nothing else.
       *
       * No display name is collected and none is derived from the email — a
       * profile named after the left-hand side of someone's address is exactly
       * the kind of assumed identity this app is supposed to have stopped
       * making. The room starts empty and gets a name when its owner gives it
       * one, in Profile → Edit.
       */
      signUp: async (email, password) => {
        if (!supabase) return { error: 'Sync is not configured.' }
        const { error } = await supabase.auth.signUp({ email, password })
        return { error: error?.message ?? null }
      },

      signOut: async () => {
        if (!supabase) return
        stopSync()
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
