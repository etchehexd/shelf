import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { NavRail, BottomBar } from './NavRail'
import { TopBar } from './TopBar'
import { CommandPalette } from './CommandPalette'
import { useSeedOnFirstRun } from '@/features/onboarding/seed'

export function AppLayout() {
  const { pathname } = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useSeedOnFirstRun()

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
    <div className="min-h-dvh bg-canvas">
      <NavRail />

      {/* The rail is fixed, so the content column carries the offset. */}
      <div className="md:pl-[72px] lg:pl-[232px]">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />

        <main className="mx-auto w-full max-w-(--container-page) px-5 pt-6 pb-28 md:px-10 md:pb-16">
          <Outlet />
        </main>
      </div>

      <BottomBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
