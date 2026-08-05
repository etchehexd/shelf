import { useEffect } from 'react'
import { NavLink } from 'react-router'
import { Compass, Home, Layers, Library, PanelLeft, Trophy, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tooltip, useMediaQuery } from '@/design'
import { usePrefs } from '@/data/store/prefs'

interface Destination {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

/** Destinations, named for what they are. No nicknames. */
const NAV: Destination[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/rankings', label: 'Rankings', icon: Trophy },
  { to: '/collections', label: 'Collections', icon: Layers },
  { to: '/discover', label: 'Discover', icon: Compass },
]

/**
 * Every destination, always — including the ones a signed-out visitor can't
 * use yet.
 *
 * Hiding them would leave two items in the rail and make the product look like
 * a search box, which is the opposite of the truth and exactly the wrong
 * impression to give the people deciding whether to make an account. Each
 * gated route explains itself when you get there; that is a far better sales
 * pitch than an absence.
 */
const ALL: Destination[] = [...NAV, { to: '/profile', label: 'Profile', icon: User }]

/**
 * The rail.
 *
 * Expanded it is 236px of labeled navigation; collapsed it is a 76px column of
 * icons, and the preference survives reloads because it is a posture rather
 * than a mode — someone who wants the horizontal space back wants it back every
 * time, not once.
 *
 * Below 1024px the collapse control disappears and the rail is always icon-only:
 * at that width the choice isn't the user's to make, it's the viewport's.
 *
 * The active marker is a short ember spine on the left edge — the same shape as
 * the end-cap on every shelf line in the app, so the chrome and the content are
 * speaking the same language.
 */
export function NavRail() {
  const collapsed = usePrefs((s) => s.railCollapsed)
  const toggleRail = usePrefs((s) => s.toggleRail)

  // Below 1024px the rail is icon-only whatever the preference says, so the
  // tooltip is the only label there — it must stay on.
  const wide = useMediaQuery('(min-width: 1024px)')
  const labeled = wide && !collapsed

  // `[` is the near-universal binding for this, and it costs no chrome.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (el instanceof HTMLElement && el.isContentEditable) return
      e.preventDefault()
      toggleRail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRail])

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-canvas md:flex',
        // Width and its transition both come from `.rail-shell`, which reads
        // the same `--rail-w` the content column offsets itself by. No width
        // utility here at all — two declarations of the same property is how
        // the collapse quietly stopped working the first time.
        'rail-shell overflow-hidden',
      )}
    >
      <div className="flex h-16 items-center px-6 lg:px-7">
        <NavLink to="/" className="group flex items-center gap-3" aria-label="Shelf — home">
          <ShelfMark />
          <RailLabel collapsed={collapsed} className="text-display-sm text-ink">
            Shelf
          </RailLabel>
        </NavLink>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-3 py-3 lg:px-4">
        {ALL.map((item) => (
          <li key={item.to}>
            {/* The tooltip is the label when the label isn't there. */}
            <Tooltip content={item.label} side="right" disabled={labeled}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-11 items-center gap-3.5 rounded-md px-3.5 text-label font-medium',
                    'transition-colors duration-200',
                    'justify-center',
                    collapsed ? 'lg:justify-center' : 'lg:justify-start',
                    isActive
                      ? 'bg-surface-2 text-ink'
                      : 'text-ink-3 hover:bg-surface-2/60 hover:text-ink-2',
                  )
                }
              >
                {({ isActive }) => (
                  <>
{/* The spine.

                        Position and animation are on two different elements
                        on purpose. They used to be on one, which meant
                        `-translate-y-1/2` (centering) and `scale-y-*`
                        (the reveal) were composing into a single transform —
                        so the centering offset was itself being scaled, and
                        the marker sat visibly high against its icon at rest
                        and drifted as it animated. The outer element only
                        positions; the inner one only scales. Neither can
                        move the other. */}
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
                      aria-hidden
                    >
                      <span
                        className={cn(
                          'h-5 w-[3px] rounded-r-full bg-accent',
                          'origin-center transition-transform duration-300 ease-[var(--ease-out-expo)]',
                          isActive ? 'scale-y-100' : 'scale-y-0',
                        )}
                      />
                    </span>
                    <item.icon
                      className={cn(
                        'size-[18px] shrink-0 transition-transform duration-300',
                        isActive && 'scale-110',
                      )}
                      strokeWidth={isActive ? 2.1 : 1.7}
                      aria-hidden
                    />
                    <RailLabel collapsed={collapsed}>{item.label}</RailLabel>
                  </>
                )}
              </NavLink>
            </Tooltip>
          </li>
        ))}
      </ul>

      <div className="hidden px-3 pb-4 lg:block lg:px-4">
        <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right">
          <button
            type="button"
            onClick={toggleRail}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'group flex h-10 w-full items-center gap-3.5 rounded-md px-3.5 text-label font-medium',
              'text-ink-3 transition-colors duration-200 hover:bg-surface-2/60 hover:text-ink-2',
              collapsed ? 'justify-center' : 'justify-start',
            )}
          >
            <PanelLeft
              className={cn(
                'size-[18px] shrink-0 transition-transform duration-[380ms] ease-[var(--ease-out-expo)]',
                collapsed && 'rotate-180',
              )}
              strokeWidth={1.7}
              aria-hidden
            />
            <RailLabel collapsed={collapsed}>Collapse</RailLabel>
          </button>
        </Tooltip>
      </div>
    </nav>
  )
}

/**
 * A label that leaves without reflowing anything.
 *
 * `width: 0` plus `overflow: hidden` rather than `display: none`: the text keeps
 * its box until the very end of the animation, so the icon beside it slides to
 * center instead of snapping there the instant the class flips. Below `lg` the
 * rail is icon-only regardless, which is why every rule here is `lg:`-scoped.
 */
function RailLabel({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'hidden overflow-hidden whitespace-nowrap lg:block',
        'transition-[opacity,max-width] duration-[380ms] ease-[var(--ease-out-expo)]',
        collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100',
        className,
      )}
      aria-hidden={collapsed}
    >
      {children}
    </span>
  )
}

/** Mobile: the same destinations as a bottom tab bar. */
export function BottomBar() {

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur-lg md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {ALL.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem]',
                  isActive ? 'text-ink' : 'text-ink-3',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute top-0 h-[3px] w-8 rounded-b-full bg-accent transition-transform duration-300',
                      isActive ? 'scale-x-100' : 'scale-x-0',
                    )}
                    aria-hidden
                  />
                  <item.icon className="size-5" strokeWidth={isActive ? 2.1 : 1.7} aria-hidden />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Three spines standing on a shelf, the last one leaning. Restrained on
 * purpose — no mascot, no gradient — but the lean is what makes it a shelf
 * rather than a bar chart.
 */
function ShelfMark() {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md bg-accent',
        'transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-3',
      )}
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="size-5 text-accent-ink" fill="none">
        <rect x="3.2" y="3.4" width="3.4" height="12.2" rx="0.9" fill="currentColor" />
        <rect x="8" y="5.8" width="3.4" height="9.8" rx="0.9" fill="currentColor" opacity="0.72" />
        <rect
          x="12.9"
          y="7"
          width="3.4"
          height="8.6"
          rx="0.9"
          fill="currentColor"
          opacity="0.48"
          transform="rotate(11 14.6 11.3)"
        />
        <rect x="2.4" y="16.1" width="15.2" height="1.5" rx="0.75" fill="currentColor" />
      </svg>
    </span>
  )
}
