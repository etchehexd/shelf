import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyTheme, systemTheme } from '@/design/theme'
import type { TitleLanguage } from '@/data/anilist/normalize'
import type { MediaKind } from '@/data/anilist/types'

export type ThemeSetting = 'light' | 'dark' | 'system'
export type ViewMode = 'grid' | 'shelf' | 'list'
/** No 'rank' — ordering by taste lives in its own section now. */
export type LibrarySort = 'updated' | 'title' | 'score' | 'progress' | 'added'

interface PrefsState {
  theme: ThemeSetting
  titleLanguage: TitleLanguage
  defaultView: ViewMode
  librarySort: LibrarySort
  lastKind: MediaKind
  /** Whether the first-run tour has been dismissed. */
  onboarded: boolean
  /** Icon-only navigation rail. Persisted, because it is a posture, not a mode. */
  railCollapsed: boolean

  setTheme: (theme: ThemeSetting) => void
  setTitleLanguage: (language: TitleLanguage) => void
  setDefaultView: (view: ViewMode) => void
  setLibrarySort: (sort: LibrarySort) => void
  setLastKind: (kind: MediaKind) => void
  setOnboarded: (value: boolean) => void
  setRailCollapsed: (value: boolean) => void
  toggleRail: () => void
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
      // Shelves, not a grid: the library should look like a bookcase the first
      // time you open it.
      defaultView: 'shelf',
      librarySort: 'updated',
      lastKind: 'anime',
      onboarded: false,
      railCollapsed: false,

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme === 'system' ? systemTheme() : theme)
      },
      setTitleLanguage: (titleLanguage) => set({ titleLanguage }),
      setDefaultView: (defaultView) => set({ defaultView }),
      setLibrarySort: (librarySort) => set({ librarySort }),
      setLastKind: (lastKind) => set({ lastKind }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setRailCollapsed: (railCollapsed) => set({ railCollapsed }),
      toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
    }),
    {
      name: 'shelf.prefs',
      version: 2,
      /**
       * v1 → v2: `rank` stopped being a library sort when rankings moved to
       * their own section. A stored value that no longer exists in the union
       * would leave the sort menu showing nothing selected, so it is folded
       * back to the default rather than left dangling.
       */
      migrate: (persisted) => {
        const state = persisted as Record<string, unknown>
        if (state?.librarySort === 'rank') state.librarySort = 'updated'
        return state as unknown as PrefsState
      },
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
