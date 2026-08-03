import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Compass, CornerDownLeft, LayoutGrid, Library, Search, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CoverImage, useEscape, useScrollLock } from '@/design'
import { useMediaMap, useMediaSearch } from '@/data/anilist/hooks'
import { displayTitle } from '@/data/anilist/normalize'
import type { MediaSummary } from '@/data/anilist/types'
import { usePrefs } from '@/data/store/prefs'
import { useTrackedIds } from '@/data/store/selectors'

const ROUTES = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/collections', label: 'Collections', icon: Sparkles },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/profile', label: 'Profile', icon: User },
]

/**
 * Searches your own library first and AniList second, because the overwhelmingly
 * common case is "jump to something I already track". Remote results are clearly
 * separated rather than interleaved, so the two never compete for the top slot.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const language = usePrefs((s) => s.titleLanguage)
  const trackedIds = useTrackedIds()
  const { map } = useMediaMap(trackedIds)

  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 220)
    return () => window.clearTimeout(id)
  }, [query])

  const remote = useMediaSearch({ search: debounced, kind: 'anime', enabled: debounced.length >= 2 })

  useEscape(open, onClose)
  useScrollLock(open)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Autofocus after the enter animation starts so the caret doesn't jump.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const local = useMemo(() => {
    if (!query.trim()) return []
    const needle = query.toLowerCase()
    return [...map.values()]
      .filter((m) => {
        const { romaji, english, native } = m.title
        return [romaji, english, native].some((t) => t?.toLowerCase().includes(needle))
      })
      .slice(0, 6)
  }, [map, query])

  const remoteResults = useMemo(() => {
    const known = new Set(local.map((m) => m.id))
    return (remote.data?.media ?? []).filter((m) => !known.has(m.id)).slice(0, 6)
  }, [remote.data, local])

  const routes = useMemo(() => {
    if (!query.trim()) return ROUTES
    const needle = query.toLowerCase()
    return ROUTES.filter((r) => r.label.toLowerCase().includes(needle))
  }, [query])

  type Row =
    | { kind: 'route'; to: string; label: string; icon: typeof LayoutGrid }
    | { kind: 'media'; media: MediaSummary; section: 'library' | 'anilist' }

  const rows = useMemo<Row[]>(
    () => [
      ...routes.map((r) => ({ kind: 'route' as const, ...r })),
      ...local.map((media) => ({ kind: 'media' as const, media, section: 'library' as const })),
      ...remoteResults.map((media) => ({ kind: 'media' as const, media, section: 'anilist' as const })),
    ],
    [routes, local, remoteResults],
  )

  useEffect(() => setActive(0), [rows.length])

  const go = (row: Row) => {
    onClose()
    navigate(row.kind === 'route' ? row.to : `/media/${row.media.id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(1, rows.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + rows.length) % Math.max(1, rows.length))
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault()
      go(rows[active])
    }
  }

  let cursor = -1

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-60 flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4.5 shrink-0 text-ink-3" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search your library, or all of AniList…"
                aria-label="Search"
                className="h-14 w-full bg-transparent text-title text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {rows.length === 0 && (
                <p className="px-3 py-8 text-center text-body text-ink-3">
                  {debounced.length >= 2 && remote.isLoading ? 'Searching…' : 'Nothing found.'}
                </p>
              )}

              {routes.length > 0 && <PaletteLabel>Go to</PaletteLabel>}
              {routes.map((route) => {
                cursor += 1
                const index = cursor
                return (
                  <PaletteRow
                    key={route.to}
                    active={index === active}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => go({ kind: 'route', ...route })}
                  >
                    <route.icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="flex-1 truncate">{route.label}</span>
                  </PaletteRow>
                )
              })}

              {local.length > 0 && <PaletteLabel>In your library</PaletteLabel>}
              {local.map((media) => {
                cursor += 1
                const index = cursor
                return (
                  <MediaPaletteRow
                    key={`local-${media.id}`}
                    media={media}
                    language={language}
                    active={index === active}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => go({ kind: 'media', media, section: 'library' })}
                  />
                )
              })}

              {remoteResults.length > 0 && <PaletteLabel>On AniList</PaletteLabel>}
              {remoteResults.map((media) => {
                cursor += 1
                const index = cursor
                return (
                  <MediaPaletteRow
                    key={`remote-${media.id}`}
                    media={media}
                    language={language}
                    active={index === active}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => go({ kind: 'media', media, section: 'anilist' })}
                  />
                )
              })}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-micro text-ink-3">
              <span className="flex items-center gap-1.5">
                <Key>↑</Key>
                <Key>↓</Key>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Key>
                  <CornerDownLeft className="size-2.5" />
                </Key>
                open
              </span>
              <span className="flex items-center gap-1.5">
                <Key>esc</Key>
                close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function PaletteLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-3 pb-1.5 text-micro text-ink-3 uppercase">{children}</p>
}

function PaletteRow({
  active,
  children,
  ...rest
}: { active: boolean } & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-label',
        active ? 'bg-surface-2 text-ink' : 'text-ink-2',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

function MediaPaletteRow({
  media,
  language,
  active,
  ...rest
}: {
  media: MediaSummary
  language: ReturnType<typeof usePrefs.getState>['titleLanguage']
  active: boolean
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <PaletteRow active={active} {...rest}>
      <span className="w-7 shrink-0">
        <CoverImage src={media.coverImage} alt="" color={media.color} rounded="sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{displayTitle(media, language)}</span>
        <span className="tnum block truncate text-meta text-ink-3">
          {[media.seasonYear, media.format?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
        </span>
      </span>
    </PaletteRow>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[4px] border border-line bg-surface-2 px-1 font-sans text-micro text-ink-3">
      {children}
    </kbd>
  )
}
