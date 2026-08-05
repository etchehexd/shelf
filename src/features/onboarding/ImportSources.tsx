import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Input, SegmentedControl } from '@/design'
import { useLibrary } from '@/data/store/library'
import { cn } from '@/lib/cn'
import { importFromAniList, importFromMal, type ImportProgress } from './import'

/**
 * The two doors, and nothing around them.
 *
 * This is the only component in the product that names another tracking site,
 * for the one reason that has always justified it: you cannot ask someone for
 * their list from a service without saying which service. It was written for
 * first-run onboarding and lived inside that screen; it is a component now
 * because the Library needs the same three controls in a dialog, and the
 * alternative was a second copy of the import flow that would drift from this
 * one the first time either changed.
 *
 * Everything *around* the doors — the headline, the confirmation, what happens
 * next — belongs to whoever mounted this, because a first-run wizard and a
 * "bring in the rest of my list" dialog owe the reader completely different
 * sentences.
 */
export function ImportSources({
  onDone,
  autoFocus,
}: {
  /** Called with the number of entries actually written to the library. */
  onDone: (added: number) => void
  autoFocus?: boolean
}) {
  const importEntries = useLibrary((s) => s.importEntries)

  const [source, setSource] = useState<'anilist' | 'mal'>('anilist')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (work: () => Promise<Awaited<ReturnType<typeof importFromAniList>>>) => {
    setBusy(true)
    setError(null)
    setProgress({ ratio: null, message: 'Starting…' })
    try {
      onDone(importEntries(await work()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That import failed. Try again in a minute.')
      setProgress(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <SegmentedControl
        aria-label="Import source"
        value={source}
        onChange={(next) => {
          setSource(next)
          setError(null)
        }}
        segments={[
          { value: 'anilist' as const, label: 'AniList' },
          { value: 'mal' as const, label: 'MyAnimeList' },
        ]}
      />

      <div className="mt-6">
        {source === 'anilist' ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => importFromAniList(username, setProgress))
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-label font-medium text-ink">Your username</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="off"
                disabled={busy}
                data-autofocus={autoFocus || undefined}
              />
            </label>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={busy}
              disabled={!username.trim()}
            >
              Import
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void run(async () => importFromMal(await file.text(), setProgress))
              }}
            />
            <Button
              icon={<Upload className="size-4" />}
              size="md"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              Choose your export file
            </Button>
            <p className="text-meta text-ink-3">
              On MyAnimeList: Profile → Export. Unzip it and pick the .xml.
            </p>
          </div>
        )}
      </div>

      {progress && busy && (
        <div className="mt-6 max-w-md">
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                'h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-expo)]',
                progress.ratio == null && 'w-1/4 animate-pulse',
              )}
              style={progress.ratio != null ? { width: `${progress.ratio * 100}%` } : undefined}
            />
          </div>
          <p className="font-mono-num mt-2.5 text-meta text-ink-3">{progress.message}</p>
        </div>
      )}

      {error && <p className="mt-5 max-w-md text-body text-dropped">{error}</p>}
    </div>
  )
}
