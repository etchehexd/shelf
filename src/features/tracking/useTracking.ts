import { useCallback, useMemo } from 'react'
import { useLibrary } from '@/data/store/library'
import { useEntry } from '@/data/store/selectors'
import { statusLabel, type EntryStatus } from '@/data/store/types'
import { totalUnits, unitName, type MediaKind, type MediaSummary } from '@/data/anilist/types'
import { displayTitle } from '@/data/anilist/normalize'
import { usePrefs } from '@/data/store/prefs'
import { toast } from '@/design'
import { scoreText } from '@/lib/format'

/**
 * Binds the store's media-agnostic actions to one title.
 *
 * The store deliberately doesn't know episode counts — that's World A — so the
 * total is threaded through here. This is the seam that lets "reaching the last
 * episode completes the show" work without the store ever calling AniList.
 */
export function useTracking(media: Pick<MediaSummary, 'id' | 'kind' | 'title' | 'episodes' | 'chapters' | 'volumes'> | null | undefined) {
  const entry = useEntry(media?.id)
  const language = usePrefs((s) => s.titleLanguage)

  const addEntry = useLibrary((s) => s.addEntry)
  const removeEntry = useLibrary((s) => s.removeEntry)
  const restoreEntry = useLibrary((s) => s.restoreEntry)
  const setProgressAction = useLibrary((s) => s.setProgress)
  const setVolumesAction = useLibrary((s) => s.setVolumes)
  const setStatusAction = useLibrary((s) => s.setStatus)
  const setScoreAction = useLibrary((s) => s.setScore)
  const setNoteAction = useLibrary((s) => s.setNote)
  const toggleFavourite = useLibrary((s) => s.toggleFavourite)
  const addRepeat = useLibrary((s) => s.addRepeat)

  const total = media ? totalUnits(media) : null
  const title = media ? displayTitle(media, language) : ''
  const kind: MediaKind = media?.kind ?? 'anime'

  const ensureEntry = useCallback(
    (status: EntryStatus = 'planning') => {
      if (!media) return
      if (!useLibrary.getState().entries[media.id]) addEntry(media, status)
    },
    [media, addEntry],
  )

  const setProgress = useCallback(
    (next: number) => {
      if (!media) return
      ensureEntry('current')
      setProgressAction(media.id, next, total)
    },
    [media, total, ensureEntry, setProgressAction],
  )

  const bump = useCallback(() => {
    if (!media) return
    ensureEntry('current')
    const current = useLibrary.getState().entries[media.id]?.progress ?? 0
    setProgressAction(media.id, current + 1, total)
  }, [media, total, ensureEntry, setProgressAction])

  const setVolumes = useCallback(
    (next: number) => {
      if (!media) return
      ensureEntry('current')
      setVolumesAction(media.id, next, media.volumes ?? null)
    },
    [media, ensureEntry, setVolumesAction],
  )

  const setStatus = useCallback(
    (status: EntryStatus) => {
      if (!media) return
      ensureEntry(status)
      setStatusAction(media.id, status, total)
      toast({ message: `${title} — ${statusLabel(status, kind)}` })
    },
    [media, total, title, kind, ensureEntry, setStatusAction],
  )

  const setScore = useCallback(
    (score: number | null) => {
      if (!media) return
      ensureEntry('completed')
      setScoreAction(media.id, score)
      toast({ message: score == null ? `Rating cleared` : `${title} rated ${scoreText(score)}` })
    },
    [media, title, ensureEntry, setScoreAction],
  )

  const setNote = useCallback(
    (note: string | null) => {
      if (!media) return
      ensureEntry()
      setNoteAction(media.id, note?.trim() ? note.trim() : null)
    },
    [media, ensureEntry, setNoteAction],
  )

  const add = useCallback(
    (status: EntryStatus = 'planning') => {
      if (!media) return
      addEntry(media, status)
      toast({ message: `${title} added to ${statusLabel(status, kind).toLowerCase()}` })
    },
    [media, title, kind, addEntry],
  )

  /** Removal is the one destructive action here, so it always offers Undo. */
  const remove = useCallback(() => {
    if (!media) return
    const snapshot = useLibrary.getState().entries[media.id]
    removeEntry(media.id)
    toast({
      message: `${title} removed`,
      action: snapshot ? { label: 'Undo', onClick: () => restoreEntry(snapshot) } : undefined,
    })
  }, [media, title, removeEntry, restoreEntry])

  return useMemo(
    () => ({
      entry,
      inLibrary: Boolean(entry),
      total,
      unit: unitName(kind),
      title,
      add,
      remove,
      setProgress,
      bump,
      setVolumes,
      setStatus,
      setScore,
      setNote,
      toggleFavourite: () => media && toggleFavourite(media.id),
      addRepeat: () => media && addRepeat(media.id),
    }),
    [
      entry,
      total,
      kind,
      title,
      media,
      add,
      remove,
      setProgress,
      bump,
      setVolumes,
      setStatus,
      setScore,
      setNote,
      toggleFavourite,
      addRepeat,
    ],
  )
}
