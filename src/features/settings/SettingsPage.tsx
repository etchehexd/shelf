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
  PALETTES,
  type PaletteId,
} from '@/design'
import { useAuth } from '@/data/supabase/auth'
import { useLibrary } from '@/data/store/library'
import { usePrefs, type ThemeSetting, type ViewMode } from '@/data/store/prefs'
import { onSyncStatus, type SyncStatus } from '@/data/sync/engine'
import { clearDeadLetters, deadLetters, type Op } from '@/data/sync/outbox'
import { resetProfile, wipeEverything } from '@/data/sync/wipe'
import { cn } from '@/lib/cn'
import type { TitleLanguage } from '@/data/anilist/normalize'
import { pluralize } from '@/lib/format'
import { relativeShort } from '@/lib/dates'

export default function SettingsPage() {
  const prefs = usePrefs()
  const profile = useLibrary((s) => s.profile)
  const updateProfile = useLibrary((s) => s.updateProfile)
  const reset = useLibrary((s) => s.reset)
  const { enabled, session, signedOut, signOut } = useAuth()

  const [sync, setSync] = useState<{ status: SyncStatus; pending: number }>({
    status: 'disabled',
    pending: 0,
  })
  const [dead, setDead] = useState<Op[]>([])
  const [wiping, setWiping] = useState(false)
  const [resetting, setResetting] = useState(false)
  const userId = session?.user.id ?? null

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
              {/* Not "sign in to sync": syncing is what an account *does*, but
                  it is not why you need one. Nothing is kept without one, and
                  a settings row that undersells that contradicts every wall in
                  the app. */}
              <p className="text-body text-ink-2">
                Your library needs an account to live in. Signing in is what gives it one — and
                then it follows you between devices.
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

        {/* The accent gets its own card rather than a right-hand control in a
            SettingRow. Eleven swatches and a hue slider do not belong in the
            narrow gutter beside a label — and unlike every other setting on
            this page, this one is the thing it is describing, so it deserves
            the width to be looked at. */}
        <Card padding="compact" className="space-y-5">
          <div>
            <p className="text-label font-medium text-ink">Accent</p>
            <p className="mt-0.5 text-meta text-ink-2">
              The color the whole app is painted in. Picking one repaints immediately — there is
              no Apply, because the page in front of you is the preview.
            </p>
          </div>

          <PaletteChoice
            value={prefs.palette}
            hue={prefs.accentHue}
            onChange={prefs.setPalette}
          />

          <HueSlider
            value={prefs.accentHue}
            active={prefs.palette === 'custom'}
            onChange={prefs.setAccentHue}
          />
        </Card>
      </section>

      {/* ----------------------------------------------------------- privacy
          Both of the sections below act on an account's data, so signed out
          they have nothing to act on. Appearance stays — theme and title
          language are this browser's preferences and belong to whoever is
          sitting here, account or not. */}
      {!signedOut && (
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
      )}

      {/* ------------------------------------------------------------- data */}
      <section className={cn('space-y-5', signedOut && 'hidden')}>
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

          {/* Narrower than "delete everything", and deliberately not filed
              under it: this is the fix for an identity the product invented,
              not a destructive act the user is choosing. Nothing they made
              goes anywhere. */}
          <SettingRow
            label="Reset your profile"
            description="Clears your display name, handle, bio, avatar and banner. Your library, rankings and collections are untouched."
          >
            <Button
              size="sm"
              icon={<RotateCcw className="size-4" />}
              loading={resetting}
              onClick={async () => {
                setResetting(true)
                try {
                  await resetProfile(userId)
                  toast({ message: 'Profile reset — it starts blank now' })
                } catch (e) {
                  toast({
                    message: e instanceof Error ? e.message : 'Could not reset the profile',
                    tone: 'danger',
                  })
                } finally {
                  setResetting(false)
                }
              }}
            >
              Reset
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

/**
 * The accent picker: every palette as a circle, plus the custom one.
 *
 * A radiogroup rather than a menu, because every option fits on screen and
 * hiding ten colors behind an eleventh defeats the purpose of choosing by eye.
 * Arrow keys move between them, which is what a radiogroup gets for free and a
 * row of buttons does not.
 *
 * The custom swatch is painted with whatever hue the slider is currently on
 * rather than with a rainbow or a plus sign, so the row never contains a
 * circle that is lying about what selecting it would do.
 */
function PaletteChoice({
  value,
  hue,
  onChange,
}: {
  value: PaletteId
  hue: number
  onChange: (next: PaletteId) => void
}) {
  const swatchFor = (id: PaletteId): string =>
    id === 'custom'
      ? `hsl(${hue} 62% 46%)`
      : (PALETTES.find((p) => p.id === id)?.swatch ?? 'transparent')

  const options: { id: PaletteId; label: string }[] = [
    ...PALETTES.map((p) => ({ id: p.id as PaletteId, label: p.label })),
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap items-center gap-2.5">
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={cn(
              'relative size-7 rounded-full transition-transform duration-200 ease-[var(--ease-spring)]',
              'hover:scale-115 focus-visible:scale-115',
              active && 'scale-110',
            )}
          >
            <span
              className={cn(
                'absolute inset-0 rounded-full shadow-xs',
                // The one swatch that isn't a fixed color gets a dashed collar,
                // so it reads as "and anything else" rather than as a twelfth
                // preset that happens to look like the eleventh.
                option.id === 'custom' && 'ring-1 ring-ink-3/60 ring-offset-2 ring-offset-surface',
              )}
              style={{ background: swatchFor(option.id) }}
              aria-hidden
            />
            {/* The ring sits outside the swatch rather than on it, so the
                selected color is never partly covered by its own indicator. */}
            <span
              className={cn(
                'absolute -inset-1 rounded-full border-2 transition-opacity duration-200',
                active ? 'border-ink opacity-100' : 'border-transparent opacity-0',
              )}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

/**
 * The custom accent, as one number.
 *
 * Hue only — not a full color picker. Lightness and saturation are what decide
 * whether an accent can carry white text, sit on a poster, or survive being
 * used as a 3px spine on charcoal, and every one of the eleven named palettes
 * was hand-tuned into the same narrow bands for exactly that reason. Handing
 * those two axes over means handing over the ability to pick an accent the rest
 * of the product is unreadable against. The hue is the part that is genuinely
 * taste, so the hue is the part that is yours.
 */
function HueSlider({
  value,
  active,
  onChange,
}: {
  value: number
  active: boolean
  onChange: (next: number) => void
}) {
  return (
    <div className={cn('transition-opacity duration-300', !active && 'opacity-55')}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="text-meta text-ink-2">
          {active ? 'Your hue' : 'Or pick your own'}
        </span>
        <span className="font-mono-num text-meta text-ink-3 tabular-nums">{value}°</span>
      </div>

      <input
        type="range"
        min={0}
        max={359}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Accent hue"
        aria-valuetext={`${value} degrees`}
        // The track is the spectrum itself rather than a filled bar: on a hue
        // scale the "amount so far" that .range paints is meaningless, and the
        // colors are the only useful labels the control can have.
        className="range [&::-moz-range-track]:bg-[var(--hue-track)] [&::-webkit-slider-runnable-track]:bg-[var(--hue-track)]"
        style={
          {
            '--hue-track':
              'linear-gradient(to right, hsl(0 70% 50%), hsl(60 70% 50%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 50%), hsl(300 70% 50%), hsl(360 70% 50%))',
          } as React.CSSProperties
        }
      />
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
