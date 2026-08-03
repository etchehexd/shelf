/** Date helpers. Intl does the heavy lifting; no date library needed. */

const DAY = 86_400_000

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function daysAgo(n: number): number {
  return startOfDay(Date.now()) - n * DAY
}

/** "Today" / "Yesterday" / "Tuesday" / "3 August" / "3 August 2024" */
export function dayLabel(ts: number): string {
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  const diff = Math.round((today - day) / DAY)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(day)

  const sameYear = new Date(day).getFullYear() === new Date(today).getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(day)
}

/** "just now" / "12m" / "4h" / "3d" / "6 Mar" — for dense activity rows. */
export function relativeShort(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`

  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(ts)
}

export function timeLabel(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(ts)
}

export function fullDate(value: string | number | null | undefined): string {
  if (!value) return '—'
  const ts = typeof value === 'string' ? parseDateString(value) : value
  if (Number.isNaN(ts)) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ts)
}

/**
 * `Date.parse('2026-08-01')` is defined to mean UTC midnight, so anywhere west
 * of Greenwich it formats as 31 July — a calendar date the user picked silently
 * shifts by a day. Date-only strings are calendar dates, not instants, so parse
 * them in local time.
 */
function parseDateString(value: string): number {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime()
  return Date.parse(value)
}

/** Greeting for the dashboard. */
export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Buckets timestamps into the last `n` days, oldest first. Used by heatmaps. */
export function dayBuckets(timestamps: number[], days: number): { day: number; count: number }[] {
  const start = daysAgo(days - 1)
  const buckets = new Map<number, number>()
  for (let i = 0; i < days; i += 1) buckets.set(start + i * DAY, 0)

  for (const ts of timestamps) {
    const day = startOfDay(ts)
    if (day >= start) buckets.set(day, (buckets.get(day) ?? 0) + 1)
  }

  return [...buckets.entries()].map(([day, count]) => ({ day, count }))
}
