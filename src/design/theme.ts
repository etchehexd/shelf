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
  { id: 'sand', label: 'Sand', swatch: '#8a6a45' },
  { id: 'citrus', label: 'Citrus', swatch: '#97701a' },
  { id: 'forest', label: 'Forest', swatch: '#2f6b46' },
  { id: 'teal', label: 'Teal', swatch: '#14706b' },
  { id: 'sea', label: 'Sea', swatch: '#1f6183' },
  { id: 'slate', label: 'Slate', swatch: '#4a5f7a' },
  { id: 'plum', label: 'Plum', swatch: '#6a3f86' },
  { id: 'rose', label: 'Rose', swatch: '#a83a5b' },
  { id: 'crimson', label: 'Crimson', swatch: '#a82a35' },
  { id: 'ink', label: 'Ink', swatch: '#2f2a24' },
] as const

/**
 * `custom` is not in the list above because it has no fixed swatch — it *is*
 * the hue slider. Everything else about it behaves like a palette, which is
 * why it shares the id space rather than living in a second setting.
 */
export type PaletteId = (typeof PALETTES)[number]['id'] | 'custom'

/** The five variables a palette owns, and the only ones it may ever touch. */
const ACCENT_VARS = [
  '--accent',
  '--accent-hover',
  '--accent-quiet',
  '--accent-line',
  '--accent-ink',
] as const

export const CUSTOM_HUE_DEFAULT = 24

/**
 * One hue → the whole accent stack, per theme.
 *
 * The bands are the ones the eleven named palettes were hand-tuned into: a
 * light accent lands around L 36 so it can carry white ink, a dark one around
 * L 65 so it reads as lamplight rather than as a highlighter. Holding lightness
 * fixed while hue rotates is not perceptually uniform — a hand-picked yellow
 * would sit a few points lower than a hand-picked blue — but it keeps every
 * position on the slider inside the contrast range the rest of the product was
 * designed against, which is the property that actually matters here.
 */
export function customAccent(hue: number, theme: Theme): Record<string, string> {
  const h = ((Math.round(hue) % 360) + 360) % 360

  return theme === 'light'
    ? {
        '--accent': `hsl(${h} 58% 36%)`,
        '--accent-hover': `hsl(${h} 62% 28%)`,
        '--accent-quiet': `hsl(${h} 60% 93%)`,
        '--accent-line': `hsl(${h} 42% 78%)`,
        '--accent-ink': `hsl(${h} 60% 99%)`,
      }
    : {
        '--accent': `hsl(${h} 78% 65%)`,
        '--accent-hover': `hsl(${h} 86% 73%)`,
        '--accent-quiet': `hsl(${h} 38% 12%)`,
        '--accent-line': `hsl(${h} 32% 26%)`,
        '--accent-ink': `hsl(${h} 55% 8%)`,
      }
}

/**
 * Paints the accent. The single entry point — palette *and* custom hue, because
 * the two are one decision and applying them separately is how a theme change
 * used to leave a custom accent painted for the wrong background.
 *
 * A named palette is an attribute and nothing else; the CSS in palettes.css
 * does the work. `custom` has no stylesheet to select, so it writes the five
 * variables inline, and every other palette clears them on the way past —
 * otherwise switching away from custom would leave its accent stuck on top of
 * the new one at higher specificity.
 */
export function paintAccent(palette: PaletteId, hue: number, theme: Theme) {
  const root = document.documentElement
  root.dataset.palette = palette

  if (palette === 'custom') {
    for (const [key, value] of Object.entries(customAccent(hue, theme))) {
      root.style.setProperty(key, value)
    }
  } else {
    for (const key of ACCENT_VARS) root.style.removeProperty(key)
  }
}

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}
