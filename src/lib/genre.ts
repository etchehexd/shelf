/**
 * A color per genre.
 *
 * Genres were drawn as identical neutral pills everywhere they appeared, which
 * made a row of eight of them a wall of grey text you had to read one word at a
 * time. Giving each one a fixed hue turns that row into something you scan:
 * after a day of use you know your own genres by color before you read them,
 * and the same tag is the same color on a poster, in a filter panel and on a
 * profile.
 *
 * ------------------------------------------------------------------- the rules
 *
 * **Hues are assigned, not computed.** A hash of the genre name would be
 * one line and would put Action and Adventure — the two most commonly adjacent
 * tags in this catalog — at whatever distance chance handed out. These are
 * spaced deliberately so neighbours in the list are far apart on the wheel.
 *
 * **Anything unlisted still gets a color**, derived from the string, so the
 * catalog can add a genre tomorrow without shipping a release. It just isn't
 * guaranteed to be well spaced against the fixed ones.
 *
 * **Only the hue is stored.** Saturation and lightness are decided at render
 * time from the theme, so one table serves light and dark instead of two
 * tables that drift apart.
 */

const HUE: Record<string, number> = {
  Action: 6,
  Adventure: 32,
  Comedy: 48,
  Drama: 274,
  Ecchi: 330,
  Fantasy: 264,
  Horror: 0,
  Mahou: 310,
  Mecha: 210,
  Music: 288,
  Mystery: 232,
  Psychological: 196,
  Romance: 342,
  'Sci-Fi': 186,
  'Slice of Life': 96,
  Sports: 140,
  Supernatural: 250,
  Thriller: 20,
  'Mahou Shoujo': 310,
}

/** Stable, well-distributed fallback for anything not in the table. */
function hashHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function genreHue(genre: string): number {
  return HUE[genre] ?? hashHue(genre)
}

export interface GenreColors {
  /** Text and border. */
  fg: string
  /** The quiet fill behind it. */
  bg: string
  /** A solid fill, for the rare case that wants one. */
  solid: string
  /** Ink that sits on `solid`. */
  solidInk: string
}

/**
 * Colors for one genre in one theme.
 *
 * Dark mode lifts lightness and drops saturation — a fully saturated chip on
 * near-black reads as a notification badge. Light mode does the reverse. Both
 * keep the fill very low-alpha so a row of eight chips is legible rather than
 * looking like a paint chart.
 */
export function genreColors(genre: string, theme: 'light' | 'dark'): GenreColors {
  const h = genreHue(genre)

  return theme === 'dark'
    ? {
        fg: `hsl(${h} 62% 72%)`,
        bg: `hsl(${h} 40% 62% / 0.14)`,
        solid: `hsl(${h} 52% 60%)`,
        solidInk: `hsl(${h} 60% 8%)`,
      }
    : {
        fg: `hsl(${h} 58% 32%)`,
        bg: `hsl(${h} 62% 45% / 0.11)`,
        solid: `hsl(${h} 52% 40%)`,
        solidInk: `hsl(${h} 40% 98%)`,
      }
}
