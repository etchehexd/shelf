import { create } from 'zustand'

/**
 * The sign-in prompt, callable from anywhere.
 *
 * Writes are refused in dozens of places — a poster's ＋, the stepper, the star
 * row, a collection checkbox, a drag handle — and every one of them needs to
 * say the same thing when it refuses. A module-level function backed by one
 * store means the message and the wording live in exactly one file, the same
 * arrangement `toast()` already uses.
 *
 * `reason` is the half-sentence that completes "Sign in to …". Keep it in the
 * user's language ("keep track of this"), not the schema's ("create an entry").
 */

interface GateState {
  reason: string | null
  open: (reason: string) => void
  close: () => void
}

export const useAuthGate = create<GateState>((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}))

/** Show the prompt. Always returns false, so callers can `return requireSignIn(…)`. */
export function requireSignIn(reason: string): false {
  useAuthGate.getState().open(reason)
  return false
}
