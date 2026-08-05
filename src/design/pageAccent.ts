import { useEffect } from 'react'
import { artAccent, artAccentQuiet, type Theme } from '@/lib/accent'

/**
 * Let a page take its color from whatever is on it.
 *
 * `--art-accent` already existed and exactly one screen set it: the media page.
 * Everywhere else the app painted itself in the same brand ember over the same
 * brown, which is most of why five different pages read as one page. The
 * artwork is the only thing in this product that is genuinely different from
 * screen to screen, and it was being ignored as a color source.
 *
 * This publishes the accent on `<html>` rather than on a wrapper element, for
 * one specific reason: the motifs that most want it — the shelf line's end cap,
 * the rail arrows, the focus ring — are drawn by CSS in the base layer against
 * elements that are not descendants of any one page's root. A variable on the
 * document is the only place all of them can see.
 *
 * Cleared on unmount so a page with no artwork falls back to brand ember rather
 * than inheriting the last page's color, which would be worse than never
 * tinting at all: the same screen would be a different color depending on how
 * you arrived at it.
 */
export function usePageAccent(color: string | null | undefined, theme: Theme) {
  useEffect(() => {
    const root = document.documentElement
    const accent = artAccent(color, theme)
    const quiet = artAccentQuiet(color, theme)

    if (!accent) {
      root.style.removeProperty('--art-accent')
      root.style.removeProperty('--art-accent-quiet')
      return
    }

    root.style.setProperty('--art-accent', accent)
    if (quiet) root.style.setProperty('--art-accent-quiet', quiet)

    return () => {
      root.style.removeProperty('--art-accent')
      root.style.removeProperty('--art-accent-quiet')
    }
  }, [color, theme])
}
