/**
 * Artwork-driven accent colour.
 *
 * AniList hands us a dominant hex per cover (`coverImage.color`). Raw, it is
 * unusable as UI colour — it ranges from near-white to near-black and from
 * grey to fluorescent. We clamp lightness and saturation into a band that is
 * guaranteed legible against the current theme's surfaces, while preserving
 * the hue so each title keeps its identity.
 *
 * See ARCHITECTURE.md §Artwork-driven accent for why this beats canvas-based
 * pixel extraction.
 */

export type Theme = 'light' | 'dark'

type HSL = { h: number; s: number; l: number }

function hexToHsl(hex: string): HSL | null {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null

  let raw = m[1]
  if (raw.length === 3) raw = raw.replace(/./g, (c) => c + c)

  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l: l * 100 }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    default:
      h = ((r - g) / d + 4) / 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Bands tuned so accent-on-surface and ink-on-accent both stay legible. */
const BANDS: Record<Theme, { l: [number, number]; s: [number, number] }> = {
  light: { l: [28, 46], s: [20, 62] },
  dark: { l: [62, 78], s: [18, 58] },
}

/**
 * @param hex   AniList `coverImage.color`, or any hex. Null-safe.
 * @param theme which band to clamp into.
 * @returns an `hsl()` string, or null when there is nothing usable — callers
 *          then fall back to the brand accent rather than inventing a colour.
 */
export function artAccent(hex: string | null | undefined, theme: Theme): string | null {
  if (!hex) return null
  const hsl = hexToHsl(hex)
  if (!hsl) return null

  // A near-grey cover has no hue worth borrowing; let the brand accent win.
  if (hsl.s < 8) return null

  const band = BANDS[theme]
  const s = clamp(hsl.s, band.s[0], band.s[1])
  const l = clamp(hsl.l, band.l[0], band.l[1])

  return `hsl(${Math.round(hsl.h)} ${Math.round(s)}% ${Math.round(l)}%)`
}

/** The faint tinted wash used behind accented chips and rails. */
export function artAccentQuiet(hex: string | null | undefined, theme: Theme): string | null {
  if (!hex) return null
  const hsl = hexToHsl(hex)
  if (!hsl || hsl.s < 8) return null

  return theme === 'light'
    ? `hsl(${Math.round(hsl.h)} ${Math.round(clamp(hsl.s, 20, 50))}% 95%)`
    : `hsl(${Math.round(hsl.h)} ${Math.round(clamp(hsl.s, 14, 34))}% 12%)`
}

/**
 * A very dark, desaturated version of the cover colour, used as the base of
 * media-page banner scrims so the fade reads as part of the artwork.
 */
export function artScrim(hex: string | null | undefined, theme: Theme): string | null {
  if (!hex) return null
  const hsl = hexToHsl(hex)
  if (!hsl) return null

  return theme === 'light'
    ? `hsl(${Math.round(hsl.h)} ${Math.round(clamp(hsl.s, 8, 24))}% 96%)`
    : `hsl(${Math.round(hsl.h)} ${Math.round(clamp(hsl.s, 10, 28))}% 8%)`
}

/** Placeholder fill shown while a cover image decodes. */
export function coverPlaceholder(hex: string | null | undefined, theme: Theme): string {
  const hsl = hex ? hexToHsl(hex) : null
  if (!hsl) return theme === 'light' ? '#eae7e0' : '#1e1e23'

  return theme === 'light'
    ? `hsl(${Math.round(hsl.h)} ${Math.round(clamp(hsl.s, 10, 34))}% 88%)`
    : `hsl(${Math.round(hsl.h)} ${Math.round(clamp(hsl.s, 10, 30))}% 16%)`
}
