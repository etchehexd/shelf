/**
 * Title matching.
 *
 * The upstream catalog's own `search` argument is a single-pass fuzzy match and
 * it is not good enough on its own for the three things people actually type:
 *
 *   "rezero"   punctuation and spaces removed entirely
 *   "re zero"  punctuation replaced by a space
 *   "attck"    a typo
 *   "snk"      an initialism nobody wrote down anywhere
 *
 * So the network call is treated as a *candidate generator* — deliberately
 * over-fetched, several spellings at once — and the ordering is decided here,
 * locally, against every title a record carries: romaji, english, native and
 * synonyms. That split matters: ranking on the client means the ordering can be
 * fixed without a schema, a server, or a rate-limit budget.
 *
 * Nothing in this file knows what an anime is. It ranks strings.
 */

/* ----------------------------------------------------------------- shapes -- */

export interface Rankable {
  /** The canonical titles — what the thing is actually called. */
  names: (string | null | undefined)[]
  /**
   * Alternate spellings. Scored slightly below the canonical titles, because a
   * hit on an official title is stronger evidence than a hit on one of a
   * record's fourteen synonyms — without the discount, an obscure title whose
   * synonym list happens to contain the literal query outranks the famous one
   * the query was obviously about.
   */
  aliases?: (string | null | undefined)[]
  /** Tiebreaker only — how many people track it. Never outranks a better tier. */
  popularity?: number | null
}

/** How much of a name's score survives when it came from an alias. */
const ALIAS_WEIGHT = 0.88

/* ------------------------------------------------------------ normalizing -- */

/**
 * Lowercase, de-accented, punctuation reduced to spaces.
 *
 * The diacritic strip is what makes "kaguya sama" find "Kaguya-sama" and
 * "sousou no frieren" find "Sōsō no Frieren" — the single most common way a
 * romaji title gets typed differently from how it is stored.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Letters and digits in *any* script survive; only punctuation and symbols
    // are reduced. Restricting this to `[^a-z0-9]` — as it first did — deletes
    // every Japanese, Cyrillic and Hebrew character, which turns the native
    // title `ONE ～輝く季節へ～` into the bare string "one" and hands an obscure
    // visual novel a perfect exact-match score for the query "one". A title
    // that is mostly non-Latin has to stay mostly non-Latin, or the ranker is
    // comparing queries against rubble.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** The same string with the spaces taken out too: "re:zero" → "rezero". */
export function squash(input: string): string {
  return normalize(input).replace(/ /g, '')
}

export function tokens(input: string): string[] {
  const n = normalize(input)
  return n.length === 0 ? [] : n.split(' ')
}

/**
 * Words that carry no matching signal in this catalog.
 *
 * Dropped only when *other* tokens survive — a search for exactly "no" should
 * still search for "no".
 */
const NOISE = new Set(['the', 'a', 'an', 'of', 'no', 'to', 'wa', 'ga', 'season', 'part'])

function meaningfulTokens(input: string): string[] {
  const all = tokens(input)
  const kept = all.filter((t) => !NOISE.has(t))
  return kept.length > 0 ? kept : all
}

/* -------------------------------------------------------------- distances -- */

/**
 * Damerau–Levenshtein, capped.
 *
 * Capped because the answer only ever gets compared against a small threshold:
 * once a row's best possible score exceeds the cap the loop can stop, which
 * turns the worst case (a long query against a long title) from quadratic work
 * into a couple of rows. Transpositions are counted as one edit rather than two
 * because the overwhelmingly common typo is two adjacent letters swapped —
 * "attakc", "shigneki" — and charging those two edits pushes them past any
 * threshold worth having.
 */
export function editDistance(a: string, b: string, cap = 4): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev2: number[] = []
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr: number[] = []

  for (let i = 1; i <= a.length; i += 1) {
    curr = new Array<number>(b.length + 1)
    curr[0] = i
    let rowMin = curr[0]

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)

      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1)
      }

      curr[j] = v
      if (v < rowMin) rowMin = v
    }

    // Every remaining row can only add to the minimum, so this is safe.
    if (rowMin > cap) return cap + 1

    prev2 = prev
    prev = curr
  }

  return prev[b.length]
}

/** 1 for identical, 0 for nothing in common. */
function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  const cap = Math.max(2, Math.floor(longest * 0.34))
  const d = editDistance(a, b, cap)
  if (d > cap) return 0
  return 1 - d / longest
}

/**
 * Does every character of `query` appear in `text`, in order?
 *
 * This is what makes an initialism work: "snk" is a subsequence of
 * "shingekinokyojin". On its own it is far too permissive — almost any short
 * query is a subsequence of any long string — so it scores low and is only ever
 * a last resort below every real match.
 */
function isSubsequence(query: string, text: string): boolean {
  let i = 0
  for (let j = 0; j < text.length && i < query.length; j += 1) {
    if (text[j] === query[i]) i += 1
  }
  return i === query.length
}

/** "shingeki no kyojin" → "snk". */
function initials(text: string): string {
  return tokens(text)
    .map((t) => t[0])
    .join('')
}

/* ------------------------------------------------------------- the scorer -- */

/**
 * How well one query matches one name, 0–1000.
 *
 * The tiers are deliberately far apart rather than blended. A blended score
 * lets a great fuzzy match on a long obscure title beat an exact match on a
 * short famous one, which is precisely the "random partial matches" failure
 * this replaces. Ordering within a tier is what the smaller terms are for.
 */
export function matchScore(query: string, name: string): number {
  const q = normalize(query)
  const n = normalize(name)
  if (q.length === 0 || n.length === 0) return 0

  const qs = squash(q)
  const ns = squash(n)

  // ---- exact -------------------------------------------------------------
  if (n === q) return 1000
  // "rezero" vs "re zero" vs "re:zero" — the same title, typed three ways.
  if (ns === qs) return 980

  // ---- prefix ------------------------------------------------------------
  // The length ratio nudges toward the *shorter* title — "One Piece" over
  // "One Piece: Heart of Gold Special Edition" — but it is deliberately worth
  // only 20 points. Given a bigger budget it starts deciding real questions:
  // at 60 points "One Outs" outranked "One Piece" for the query "one", purely
  // for being one character shorter. Within-tier ordering is popularity's job
  // (see `popularityBoost`); this term only separates near-identical lengths.
  const ratio = (short: string, long: string) => short.length / long.length

  if (n.startsWith(q)) return 860 + 20 * ratio(q, n)
  if (ns.startsWith(qs)) return 820 + 20 * ratio(qs, ns)

  // ---- token matching ----------------------------------------------------
  const qTokens = meaningfulTokens(q)
  const nTokens = tokens(n)

  if (qTokens.length > 0) {
    // Every query word begins a word of the title: "attack titan" →
    // "Attack on Titan". Word-prefix rather than equality so "frier" hits
    // "Frieren" without the user finishing the word.
    const everyTokenPrefixes = qTokens.every((qt) => nTokens.some((nt) => nt.startsWith(qt)))
    if (everyTokenPrefixes) {
      const covered = qTokens.join('').length / Math.max(1, ns.length)
      return 700 + 80 * covered
    }

    // Every query word appears somewhere inside the title.
    const everyTokenSomewhere = qTokens.every((qt) => ns.includes(qt))
    if (everyTokenSomewhere) return 620
  }

  // ---- substring ---------------------------------------------------------
  if (ns.includes(qs)) return 560 + 20 * ratio(qs, ns)

  // ---- initialism --------------------------------------------------------
  const acronym = initials(n)
  if (acronym.length >= 2 && acronym === qs) return 540
  if (acronym.length >= 3 && acronym.startsWith(qs) && qs.length >= 3) return 480

  // ---- fuzzy -------------------------------------------------------------
  // Whole-string first, then the best single word. The per-word pass is what
  // catches a typo in a long title — "shigneki no kyojin" is nowhere near
  // "shingeki no kyojin" as one string once the other words dilute it.
  const whole = similarity(qs, ns)
  if (whole >= 0.82) return 400 + 100 * whole

  let bestToken = 0
  for (const qt of qTokens) {
    if (qt.length < 3) continue
    for (const nt of nTokens) {
      if (Math.abs(nt.length - qt.length) > 3) continue
      const s = similarity(qt, nt)
      if (s > bestToken) bestToken = s
    }
  }
  if (bestToken >= 0.75) {
    // Scaled by how much of the query that one word accounts for, so a single
    // fuzzy hit inside a five-word query does not outrank a clean match.
    const share = qTokens.length === 1 ? 1 : 1 / qTokens.length
    return 240 + 120 * bestToken * (0.5 + 0.5 * share)
  }

  if (whole >= 0.6) return 160 + 80 * whole

  // ---- last resort -------------------------------------------------------
  if (qs.length >= 3 && isSubsequence(qs, ns)) return 60

  return 0
}

/** The best score across every name a record answers to. */
export function bestMatch(
  query: string,
  names: (string | null | undefined)[],
  aliases: (string | null | undefined)[] = [],
): number {
  let best = 0
  for (const name of names) {
    if (!name) continue
    const s = matchScore(query, name)
    if (s > best) best = s
  }
  for (const alias of aliases) {
    if (!alias) continue
    const s = matchScore(query, alias) * ALIAS_WEIGHT
    if (s > best) best = s
  }
  return best
}

/* ------------------------------------------------------------- the ranker -- */

/**
 * Popularity as a within-tier tiebreaker, compressed hard.
 *
 * Log-scaled and capped at 60 points. The gap between any two tiers above is
 * at least 120, so a famous title can reorder its own tier and can never climb
 * out of one — that is the entire rule. Without the cap this becomes a
 * popularity chart with a search box on top; without the term at all, "one"
 * returns whichever obscure record upstream happened to hand back first, which
 * is exactly the failure this exists to fix.
 *
 * 60 points is roughly `log10(1_000_000) * 10`, so the biggest titles in the
 * catalog sit at the ceiling and everything else is spread underneath them.
 */
function popularityBoost(popularity: number | null | undefined): number {
  if (!popularity || popularity <= 0) return 0
  return Math.min(60, Math.log10(popularity) * 10)
}

export interface Ranked<T> {
  item: T
  score: number
}

/**
 * Order candidates by how well they answer the query, dropping the ones that
 * do not answer it at all.
 *
 * `minScore` defaults just above the subsequence tier: a result that matched
 * only because its letters happen to appear in order is noise, and showing it
 * is what makes a search feel like it is guessing.
 */
export function rankBy<T>(
  query: string,
  items: T[],
  toRankable: (item: T) => Rankable,
  minScore = 100,
): Ranked<T>[] {
  const q = normalize(query)
  if (q.length === 0) return items.map((item) => ({ item, score: 0 }))

  const out: Ranked<T>[] = []

  for (const item of items) {
    const { names, aliases, popularity } = toRankable(item)
    const base = bestMatch(q, names, aliases)
    if (base < minScore) continue
    out.push({ item, score: base + popularityBoost(popularity) })
  }

  out.sort((a, b) => b.score - a.score)
  return out
}

/* ---------------------------------------------------------- query variants -- */

/**
 * The spellings worth asking upstream for.
 *
 * Upstream matches on its own stored strings, so "rezero" finds nothing while
 * "re zero" finds everything. Rather than guess which form is right, ask for
 * the two or three plausible ones and let the local ranker merge the answers —
 * the requests are cached and de-duplicated, so a second variant is nearly
 * free and a wrong guess costs nothing but a cache entry.
 *
 * Capped at three: this runs on every keystroke after the debounce, and the
 * fourth variant has never been the one that mattered.
 */
export function queryVariants(raw: string): string[] {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return []

  const out: string[] = [trimmed]
  const push = (s: string) => {
    const v = s.trim()
    if (v.length >= 2 && !out.some((existing) => existing.toLowerCase() === v.toLowerCase())) {
      out.push(v)
    }
  }

  const n = normalize(trimmed)

  // Punctuation stripped: "Re:Zero" → "re zero".
  push(n)

  // A single squashed word split at the point where a known prefix ends.
  // "rezero" → "re zero", "onepiece" → "one piece". Only for one-word queries,
  // because splitting inside a multi-word query is guesswork.
  if (!n.includes(' ') && n.length >= 5) {
    for (const prefix of SPLIT_PREFIXES) {
      if (n.startsWith(prefix) && n.length > prefix.length + 1) {
        push(`${prefix} ${n.slice(prefix.length)}`)
        break
      }
    }
  }

  // A known shorthand people type instead of the title.
  const alias = ALIASES[n]
  if (alias) push(alias)

  return out.slice(0, 3)
}

/**
 * Spellings to try *after* the first wave came back empty.
 *
 * Upstream's own matcher turns out to be strict in a specific way: it will
 * prefix-match a trailing word when earlier words matched exactly ("attack on
 * tit" finds Attack on Titan) but a single mistyped token finds nothing at all
 * — "shigneki", "atack", even the clean truncation "shingek" all return zero
 * rows. Local ranking cannot fix that, because ranking needs candidates and
 * there are none.
 *
 * So when a search comes back empty, the query is *repaired* rather than the
 * results being re-sorted. Three edits, chosen because they are the typos
 * people actually make:
 *
 *   transposition   two adjacent letters swapped  — shigneki → shingeki
 *   deletion        one letter too many           — attackk  → attack
 *   doubling        one letter too few, doubled   — atack    → attack
 *
 * Substitutions and free insertions are deliberately absent: they are 25× and
 * 26× the request count for a fraction of the real-world hit rate.
 *
 * Only the longest token is repaired — a typo in "the" is not what stopped the
 * search from matching — and the whole thing is capped, because this fires as
 * a second network wave and a rate limit is a worse failure than a missed typo.
 */
export function repairVariants(raw: string, cap = 8): string[] {
  const trimmed = raw.trim()
  if (trimmed.length < 4 || trimmed.length > 40) return []

  const parts = trimmed.split(/\s+/)
  let target = 0
  for (let i = 1; i < parts.length; i += 1) {
    if (parts[i].length > parts[target].length) target = i
  }

  const word = parts[target].toLowerCase()
  if (word.length < 4) return []

  const rebuild = (next: string) =>
    parts.map((p, i) => (i === target ? next : p)).join(' ')

  const seen = new Set<string>([trimmed.toLowerCase()])
  const out: string[] = []
  const add = (candidate: string) => {
    const full = rebuild(candidate)
    const key = full.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(full)
    }
  }

  // Transpositions first — by far the most common single-word typo, and the
  // only one of the three that leaves the letter count correct.
  for (let i = 0; i < word.length - 1; i += 1) {
    if (word[i] === word[i + 1]) continue
    add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2))
  }

  for (let i = 0; i < word.length; i += 1) {
    add(word.slice(0, i) + word.slice(i + 1))
  }

  for (let i = 0; i < word.length; i += 1) {
    add(word.slice(0, i) + word[i] + word.slice(i))
  }

  return out.slice(0, cap)
}

/**
 * Prefixes worth splitting a squashed one-word query on.
 *
 * Short, extremely common leading words in this catalog. Kept small and
 * hand-picked on purpose — a general "split anywhere" heuristic turns every
 * query into three bad ones.
 */
const SPLIT_PREFIXES = ['re', 'one', 'my', 'no', 'god', 'to', 'the', 'dr', 'mob', 'jojo']

/**
 * Initialisms and shorthands that are not stored anywhere upstream.
 *
 * Deliberately a short list of the ones people genuinely type. It is a
 * convenience on top of the ranker, not a substitute for it — everything here
 * would still be findable by typing more letters.
 */
const ALIASES: Record<string, string> = {
  snk: 'shingeki no kyojin',
  aot: 'attack on titan',
  fmab: 'fullmetal alchemist brotherhood',
  fma: 'fullmetal alchemist',
  jjk: 'jujutsu kaisen',
  kny: 'kimetsu no yaiba',
  ds: 'demon slayer',
  ops: 'one punch man',
  opm: 'one punch man',
  op: 'one piece',
  hxh: 'hunter x hunter',
  mha: 'my hero academia',
  bnha: 'boku no hero academia',
  tbhk: 'jibaku shounen hanako kun',
  konosuba: 'kono subarashii sekai ni shukufuku wo',
  oregairu: 'yahari ore no seishun love come wa machigatteiru',
  bocchi: 'bocchi the rock',
  csm: 'chainsaw man',
  spyxfamily: 'spy x family',
  aoashi: 'ao ashi',
  '86': 'eighty six',
  sao: 'sword art online',
  nge: 'neon genesis evangelion',
  eva: 'neon genesis evangelion',
  ygo: 'yu gi oh',
  jjba: 'jojo no kimyou na bouken',
  tbate: 'the beginning after the end',
  otome: 'otome game',
  rezero: 're zero kara hajimeru isekai seikatsu',
  frieren: 'sousou no frieren',
  vinland: 'vinland saga',
  mushoku: 'mushoku tensei',
  overlord: 'overlord',
  danmachi: 'dungeon ni deai wo motomeru no wa machigatteiru darou ka',
}
