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

/**
 * "Tonight 01:00" / "Friday 01:00" / "in 12 days" — for airing schedules.
 * Takes AniList's `airingAt`, which is unix *seconds*.
 */
export function airingLabel(airingAt: number): string {
  const ts = airingAt * 1000
  const days = Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY)
  const time = timeLabel(ts)

  if (days === 0) return `Today ${time}`
  if (days === 1) return `Tomorrow ${time}`
  if (days > 1 && days < 7)
    return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(ts)} ${time}`
  if (days < 0) return dayLabel(ts)

  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(ts)
}

/** Short form for badges: "Fri", "Today", "2 Sep". */
export function airingDayShort(airingAt: number): string {
  const ts = airingAt * 1000
  const days = Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 1 && days < 7)
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(ts)
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(ts)
}

/**
 * "in 3d 4h" / "in 5h 20m" / "in 12m" / "aired 2d ago" — for a countdown that
 * is re-read rather than watched.
 *
 * Two units, never three: "in 3d 4h 12m" is a stopwatch, and nobody waiting
 * three days for an episode is counting its minutes. The last hour is the one
 * exception worth having, so under an hour it drops to minutes alone.
 *
 * Times in the past are the case that matters most and the one that was wrong:
 * this used to answer "airing now" for anything at or before the present
 * moment, which for an episode that went out on Monday is a lie the calendar
 * then repeated all week. A broadcast is a moment, not a state — five minutes
 * either side of it is "now", and everything before that has aired.
 */
export function countdown(airingAt: number, now = Date.now()): string {
  const secs = airingAt - Math.floor(now / 1000)

  if (secs <= 0) {
    const past = -secs
    if (past < 300) return 'airing now'
    const d = Math.floor(past / 86_400)
    const h = Math.floor(past / 3_600)
    if (d > 0) return `aired ${d}d ago`
    if (h > 0) return `aired ${h}h ago`
    return `aired ${Math.max(1, Math.floor(past / 60))}m ago`
  }

  const d = Math.floor(secs / 86_400)
  const h = Math.floor((secs % 86_400) / 3_600)
  const m = Math.floor((secs % 3_600) / 60)

  if (d > 0) return h > 0 ? `in ${d}d ${h}h` : `in ${d}d`
  if (h > 0) return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`
  return `in ${Math.max(1, m)}m`
}

/** Whether a broadcast time (unix **seconds**) has already happened. */
export function hasAired(airingAt: number, now = Date.now()): boolean {
  return airingAt * 1000 <= now
}

/**
 * The Monday-based week `ts` falls in, as a local-midnight timestamp.
 *
 * Monday rather than Sunday because a broadcast week is discussed that way —
 * "this season's Monday slot" — and because it keeps the weekend adjacent
 * instead of splitting it across two columns.
 */
export function startOfWeek(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0 = Sunday. Shift so Monday is 0 and Sunday is 6.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** The seven local-midnight timestamps of the week starting at `weekStart`. */
export function weekDays(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    // Adding days on the Date rather than adding 86.4M milliseconds: a week
    // containing a DST change is 167 or 169 hours long, and arithmetic on the
    // epoch quietly produces a day that starts at 23:00 the evening before.
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })
}

/** "Mon" / "Tue" — the column heads of a week. */
export function weekdayShort(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(ts)
}

/** "4 Aug" — the date under a column head. */
export function dayMonth(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(ts)
}

/**
 * A week's name: "Aug 3 – 9", "Jul 28 – Aug 3", "Dec 30, 2025 – Jan 5, 2026".
 *
 * `formatRange` rather than two formats glued with a dash. It is the only thing
 * that knows *where* the shared part of a range goes, and the answer is
 * per-locale: hand-building "3–Aug 9" from a day number and a formatted date is
 * how this read before, which is correct in exactly the locales that put the
 * day first.
 */
export function weekRangeLabel(weekStart: number): string {
  const days = weekDays(weekStart)
  const first = days[0]
  const last = days[6]

  const crossesYear = new Date(first).getFullYear() !== new Date().getFullYear()

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    ...(crossesYear ? { year: 'numeric' } : {}),
  }).formatRange(first, last)
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
