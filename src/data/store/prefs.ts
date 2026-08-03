import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyTheme, systemTheme } from '@/design/theme'
import type { TitleLanguage } from '@/data/anilist/normalize'
import type { MediaKind } from '@/data/anilist/types'

export type ThemeSetting = 'light' | 'dark' | 'system'
export type ViewMode = 'grid' | 'shelf' | 'list'
export type LibrarySort = 'updated' | 'title' | 'score' | 'rank' | 'progress' | 'added'

interface PrefsState {
  theme: ThemeSetting
  titleLanguage: TitleLanguage
  defaultView: ViewMode
  librarySort: LibrarySort
  lastKind: MediaKind
  /** Whether the first-run tour has been dismissed. */
  onboarded: boolean

  setTheme: (theme: ThemeSetting) => void
  setTitleLanguage: (language: TitleLanguage) => void
  setDefaultView: (view: ViewMode) => void
  setLibrarySort: (sort: LibrarySort) => void
  setLastKind: (kind: MediaKind) => void
  setOnboarded: (value: boolean) => void
}

/**
 * Separate from the library store, and named `shelf.prefs`, because the inline
 * script in index.html reads this key to set `data-theme` before first paint.
 * Keeping it small keeps that blocking read cheap.
 */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      titleLanguage: 'english',
      defaultView: 'grid',
      librarySort: 'updated',
      lastKind: 'anime',
      onboarded: false,

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme === 'system' ? systemTheme() : theme)
      },
      setTitleLanguage: (titleLanguage) => set({ titleLanguage }),
      setDefaultView: (defaultView) => set({ defaultView }),
      setLibrarySort: (librarySort) => set({ librarySort }),
      setLastKind: (lastKind) => set({ lastKind }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'shelf.prefs',
      version: 1,
      onRehydrateStorage: () => (state) => {
        // Re-apply after rehydration in case the inline script guessed 'system'
        // and the stored value is explicit.
        if (state) applyTheme(state.theme === 'system' ? systemTheme() : state.theme)
      },
    },
  ),
)

/** Keeps `system` following the OS while the app is open. */
export function watchSystemTheme() {
  if (typeof window === 'undefined') return () => {}

  const mql = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = () => {
    if (usePrefs.getState().theme === 'system') applyTheme(systemTheme())
  }
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}
