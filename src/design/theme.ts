import { useEffect, useState } from 'react'
import type { Theme } from '@/lib/accent'

/**
 * Reads the resolved theme off `<html data-theme>`.
 *
 * Deliberately observes the DOM attribute rather than subscribing to the prefs
 * store: it keeps `design/` free of any dependency on app state, and the
 * attribute is already set before first paint by the inline script in
 * index.html, so there is no flash and no second source of truth.
 */
export function useResolvedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    setTheme(readTheme())
    return () => observer.disconnect()
  }, [])

  return theme
}

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}
