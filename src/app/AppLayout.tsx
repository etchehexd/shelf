import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { NavRail, BottomBar } from './NavRail'
import { TopBar } from './TopBar'
import { CommandPalette } from './CommandPalette'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { usePrefs } from '@/data/store/prefs'
import { useMediaQuery } from '@/design'

export function AppLayout() {
  const { pathname } = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const collapsed = usePrefs((s) => s.railCollapsed)

  /**
   * The rail's width, resolved here and nowhere else.
   *
   *   < 768px   no rail at all — the bottom bar takes over
   *   < 1024px  icon-only, whatever the preference says: at that width the
   *             choice belongs to the viewport, not the user
   *   ≥ 1024px  the user's preference
   */
  const hasRail = useMediaQuery('(min-width: 768px)')
  const wide = useMediaQuery('(min-width: 1024px)')
  const railWidth = !hasRail ? '0px' : wide && !collapsed ? '236px' : '76px'

  // Route changes should land at the top; the browser's restoration is for
  // back-navigation, which react-router handles separately.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    /**
     * One number describes the whole layout: `--rail-w`. The rail sizes itself
     * from it and the content column offsets itself by it, so the two animate
     * as one object rather than as two things that happen to agree — which is
     * what a collapse built from two independent class swaps always looks like.
     */
    <div className="min-h-dvh bg-canvas" style={{ '--rail-w': railWidth } as React.CSSProperties}>
      <NavRail />

      {/* The rail is fixed, so the content column carries the offset. */}
      <div className="rail-offset relative z-10">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />

        <main className="mx-auto w-full max-w-(--container-page) px-5 pt-7 pb-28 md:px-10 md:pb-20">
          <Outlet />
        </main>
      </div>

      <BottomBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Onboarding />
    </div>
  )
}
