import { NavLink } from 'react-router'
import { Compass, LayoutGrid, Library, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/design'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/collections', label: 'Collections', icon: Sparkles },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/profile', label: 'Profile', icon: User },
]

/**
 * Fixed rail on desktop: full-width with labels ≥1100px, icon-only between
 * 760–1100px, replaced entirely by BottomBar below that.
 */
export function NavRail() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-canvas md:flex',
        'w-[72px] lg:w-[232px]',
      )}
    >
      <div className="flex h-16 items-center px-5 lg:px-6">
        <NavLink to="/" className="flex items-center gap-2.5" aria-label="Shelf — home">
          <ShelfMark />
          <span className="hidden font-display text-display-sm text-ink lg:block">Shelf</span>
        </NavLink>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3 py-2 lg:px-4">
        {NAV.map((item) => (
          <li key={item.to}>
            <Tooltip content={item.label} side="right">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-10 items-center gap-3 rounded-md px-3 text-label font-medium',
                    'transition-colors duration-[110ms]',
                    'justify-center lg:justify-start',
                    isActive
                      ? 'bg-surface-2 text-ink'
                      : 'text-ink-3 hover:bg-surface-2/60 hover:text-ink-2',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="size-[18px] shrink-0"
                      strokeWidth={isActive ? 2.2 : 1.8}
                      aria-hidden
                    />
                    <span className="hidden lg:block">{item.label}</span>
                  </>
                )}
              </NavLink>
            </Tooltip>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Mobile: the same five destinations as a bottom tab bar. */
export function BottomBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-micro',
                  isActive ? 'text-ink' : 'text-ink-3',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                  <span className="normal-case tracking-normal">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Three stacked spines. Restrained on purpose — no mascot, no gradient. */
function ShelfMark() {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent"
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="size-4.5 text-accent-ink" fill="none">
        <rect x="3" y="3" width="3.5" height="14" rx="1" fill="currentColor" opacity="0.95" />
        <rect x="8.25" y="5.5" width="3.5" height="11.5" rx="1" fill="currentColor" opacity="0.7" />
        <rect
          x="13.6"
          y="7.2"
          width="3.5"
          height="9.8"
          rx="1"
          fill="currentColor"
          opacity="0.45"
          transform="rotate(9 15.35 12.1)"
        />
      </svg>
    </span>
  )
}
