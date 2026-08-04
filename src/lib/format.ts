/** Small formatting helpers. Deliberately dependency-free. */

/**
 * Scores are whole numbers, 1–10. They print as whole numbers everywhere —
 * "8", never "8.0" — because the scale has no fractions to disambiguate.
 * Averages are the one place a decimal is meaningful, so they round to one.
 */
export function scoreText(score: number | null | undefined): string {
  if (score == null) return '—'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}m`
}

/** 1_284 minutes → "21h 24m". Used for watch-time stats. */
export function duration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = Math.round(minutes % 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/**
 * Values whose correct casing a generic sentence-caser can't know. Without
 * these, the information panel proudly reads "Format: Tv".
 */
const HUMANIZED: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV short',
  OVA: 'OVA',
  ONA: 'ONA',
  MOVIE: 'Film',
  MANGA: 'Manga',
  NOVEL: 'Light novel',
  ONE_SHOT: 'One shot',
  NOT_YET_RELEASED: 'Not yet released',
  VIDEO_GAME: 'Video game',
  LIGHT_NOVEL: 'Light novel',
  VISUAL_NOVEL: 'Visual novel',
  WEB_NOVEL: 'Web novel',
  MULTIMEDIA_PROJECT: 'Multimedia project',
  PICTURE_BOOK: 'Picture book',
  ALTERNATIVE: 'Alternative version',
  SIDE_STORY: 'Side story',
  SPIN_OFF: 'Spin-off',
  PARENT: 'Parent story',
}

/** AniList SCREAMING_SNAKE → "Screaming snake", with acronyms preserved. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  if (HUMANIZED[value]) return HUMANIZED[value]

  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** AniList descriptions carry a little HTML; strip it for previews. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
