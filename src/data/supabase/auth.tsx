import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSyncConfigured } from './client'
import { startSync, stopSync } from '@/data/sync/engine'
import { useLibrary } from '@/data/store/library'

interface AuthValue {
  session: Session | null
  loading: boolean
  /** False when no Supabase credentials are configured — local-only mode. */
  enabled: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
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

      signIn: async (email, password) => {
        if (!supabase) return { error: 'Sync is not configured.' }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },

      signUp: async (email, password, displayName) => {
        if (!supabase) return { error: 'Sync is not configured.' }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Read by the handle_new_user trigger to seed the profile row.
          options: { data: { display_name: displayName } },
        })
        if (!error) useLibrary.getState().updateProfile({ displayName })
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
