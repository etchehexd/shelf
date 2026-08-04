import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Cloud, Download, RotateCcw, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  Dialog,
  Field,
  Input,
  MenuItem,
  Popover,
  SectionHeader,
  Switch,
  toast,
} from '@/design'
import { useAuth } from '@/data/supabase/auth'
import { useLibrary } from '@/data/store/library'
import { usePrefs, type ThemeSetting, type ViewMode } from '@/data/store/prefs'
import { onSyncStatus, type SyncStatus } from '@/data/sync/engine'
import { clearDeadLetters, deadLetters, type Op } from '@/data/sync/outbox'
import { wipeEverything } from '@/data/sync/wipe'
import type { TitleLanguage } from '@/data/anilist/normalize'
import { pluralize } from '@/lib/format'
import { relativeShort } from '@/lib/dates'

export default function SettingsPage() {
  const prefs = usePrefs()
  const profile = useLibrary((s) => s.profile)
  const updateProfile = useLibrary((s) => s.updateProfile)
  const reset = useLibrary((s) => s.reset)
  const { enabled, session, signOut } = useAuth()

  const [sync, setSync] = useState<{ status: SyncStatus; pending: number }>({
    status: 'disabled',
    pending: 0,
  })
  const [dead, setDead] = useState<Op[]>([])
  const [wiping, setWiping] = useState(false)

  useEffect(() => onSyncStatus((status, pending) => setSync({ status, pending })), [])
  useEffect(() => {
    void deadLetters().then(setDead)
  }, [sync.pending])

  const exportLibrary = () => {
    const state = useLibrary.getState()
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      entries: state.entries,
      rankings: state.rankings,
      collections: state.collections,
      collectionItems: state.collectionItems,
      activity: state.activity,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shelf-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ message: 'Library exported' })
  }

  return (
    <div className="max-w-2xl space-y-12 pt-2 pb-8">
      <h1 className="text-display-lg text-ink">Settings</h1>

      {/* ------------------------------------------------------------ sync */}
      <section className="space-y-5">
        <SectionHeader title="Sync" size="sm" />

        <Card padding="compact" className="space-y-4">
          {!enabled ? (
            <>
              <p className="text-body text-ink-2">
                Running in local-only mode. Everything works and nothing leaves this browser — but
                your library won't follow you to another device.
              </p>
              <p className="text-meta text-ink-3">
                Add <code className="rounded-sm bg-surface-2 px-1">VITE_SUPABASE_URL</code> and{' '}
                <code className="rounded-sm bg-surface-2 px-1">VITE_SUPABASE_ANON_KEY</code> to{' '}
                <code className="rounded-sm bg-surface-2 px-1">.env.local</code>, then run the
                migration in <code className="rounded-sm bg-surface-2 px-1">supabase/migrations</code>.
              </p>
            </>
          ) : session ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-label font-medium text-ink">{session.user.email}</p>
                  <p className="text-meta text-ink-3">
                    {sync.status === 'idle' && sync.pending === 0
                      ? 'All changes saved'
                      : sync.status === 'offline'
                        ? 'Offline — changes are queued locally'
                        : sync.status === 'error'
                          ? 'Retrying'
                          : `${pluralize(sync.pending, 'change')} queued`}
                  </p>
                </div>
                <Button size="sm" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>

              {dead.length > 0 && (
                <div className="rounded-md border border-paused/40 bg-paused/8 p-3">
                  <p className="flex items-center gap-2 text-label font-medium text-paused">
                    <AlertTriangle className="size-4" aria-hidden />
                    {pluralize(dead.length, 'change')} couldn't be saved
                  </p>
                  <ul className="mt-2 space-y-1 text-meta text-ink-2">
                    {dead.slice(0, 5).map((op) => (
                      <li key={op.key}>
                        {op.entity} · {op.lastError ?? 'rejected'} · {relativeShort(op.updatedAt)}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      void clearDeadLetters().then(() => setDead([]))
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-body text-ink-2">
                Sign in to sync your library across devices and share collections.
              </p>
              <Link
                to="/auth"
                className="inline-flex h-9.5 shrink-0 items-center gap-2 rounded-md bg-accent px-4 text-label font-medium text-accent-ink hover:bg-accent-hover"
              >
                <Cloud className="size-4" aria-hidden />
                Sign in
              </Link>
            </div>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------- appearance */}
      <section className="space-y-5">
        <SectionHeader title="Appearance" size="sm" />
        <Card padding="compact" className="space-y-5">
          <SettingRow label="Theme" description="Follows your system by default.">
            <Choice<ThemeSetting>
              value={prefs.theme}
              onChange={prefs.setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </SettingRow>

          <SettingRow label="Title language" description="Which title to show first.">
            <Choice<TitleLanguage>
              value={prefs.titleLanguage}
              onChange={prefs.setTitleLanguage}
              options={[
                { value: 'english', label: 'English' },
                { value: 'romaji', label: 'Romaji' },
                { value: 'native', label: 'Native' },
              ]}
            />
          </SettingRow>

          <SettingRow label="Default library view">
            <Choice<ViewMode>
              value={prefs.defaultView}
              onChange={prefs.setDefaultView}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'shelf', label: 'Shelf' },
                { value: 'list', label: 'List' },
              ]}
            />
          </SettingRow>
        </Card>
      </section>

      {/* ----------------------------------------------------------- privacy */}
      <section className="space-y-5">
        <SectionHeader title="Privacy" size="sm" />
        <Card padding="compact">
          <Switch
            checked={profile.isPublic}
            onChange={(isPublic) => updateProfile({ isPublic })}
            label="Public profile"
            description="Anyone with your link can see your library, scores and activity."
          />
        </Card>
      </section>

      {/* ------------------------------------------------------------- data */}
      <section className="space-y-5">
        <SectionHeader title="Data" size="sm" />
        <Card padding="compact" className="space-y-4">
          <SettingRow
            label="Export your library"
            description="Everything, as JSON — entries, rankings, collections and history."
          >
            <Button size="sm" icon={<Download className="size-4" />} onClick={exportLibrary}>
              Export
            </Button>
          </SettingRow>

          <SettingRow
            label="Reset this device"
            description="Clears the local copy only. Signed in, syncing will pull it back."
          >
            <Button
              size="sm"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                reset()
                usePrefs.getState().setOnboarded(true)
                toast({ message: 'Local library cleared' })
              }}
            >
              Reset
            </Button>
          </SettingRow>

          <SettingRow
            label="Erase everything"
            description="Deletes your library, rankings, collections, notes, history and profile — here and on the server. Your account stays, empty. This cannot be undone."
          >
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => setWiping(true)}
            >
              Erase
            </Button>
          </SettingRow>
        </Card>
      </section>

      <WipeDialog open={wiping} onClose={() => setWiping(false)} userId={session?.user.id ?? null} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Confirmation for the one irreversible action in the app.
 *
 * Typing the word is not friction theatre — every other destructive thing here
 * offers Undo, and this one genuinely cannot, so the gesture has to be one you
 * could not perform by accident. The export button sits inside the dialog for
 * the same reason: the moment someone is about to lose everything is exactly
 * when they should be offered a copy of it.
 */
function WipeDialog({
  open,
  onClose,
  userId,
}: {
  open: boolean
  onClose: () => void
  userId: string | null
}) {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirm('')
      setBusy(false)
    }
  }, [open])

  const ready = confirm.trim().toLowerCase() === 'erase'

  const run = async () => {
    setBusy(true)
    try {
      await wipeEverything(userId)
      toast({ message: 'Everything erased. Starting over.' })
      onClose()
    } catch {
      toast({ message: "Couldn't erase everything — try again", tone: 'danger' })
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Erase everything?"
      description="Your library, rankings, collections, notes, history and profile — gone, on this device and on the server. Your account itself stays, completely empty."
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" disabled={!ready} loading={busy} onClick={() => void run()}>
            Erase everything
          </Button>
        </>
      }
    >
      <Field label="Type ERASE to confirm">
        {(props) => (
          <Input
            {...props}
            data-autofocus
            value={confirm}
            autoComplete="off"
            placeholder="ERASE"
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ready && void run()}
          />
        )}
      </Field>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-label font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-meta text-ink-2">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <Popover
      align="end"
      role="menu"
      label="Choose"
      className="w-40"
      trigger={<Button size="sm">{options.find((o) => o.value === value)?.label}</Button>}
    >
      {({ close }) => (
        <>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              selected={o.value === value}
              onSelect={() => {
                onChange(o.value)
                close()
              }}
            >
              {o.label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  )
}
