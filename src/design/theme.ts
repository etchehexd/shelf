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

/**
 * The accent palettes, in the order they are offered.
 *
 * `swatch` is the light-mode accent, used to paint the chooser itself — the
 * control has to show the color, not name it, because "plum" and "rose" are
 * indistinguishable as words and obvious as circles.
 */
export const PALETTES = [
  { id: 'ember', label: 'Ember', swatch: '#b0541f' },
  { id: 'rose', label: 'Rose', swatch: '#a83a5b' },
  { id: 'plum', label: 'Plum', swatch: '#6a3f86' },
  { id: 'sea', label: 'Sea', swatch: '#1f6183' },
  { id: 'forest', label: 'Forest', swatch: '#2f6b46' },
  { id: 'citrus', label: 'Citrus', swatch: '#97701a' },
  { id: 'ink', label: 'Ink', swatch: '#2f2a24' },
] as const

export type PaletteId = (typeof PALETTES)[number]['id']

export function applyPalette(palette: PaletteId) {
  document.documentElement.dataset.palette = palette
}

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}
