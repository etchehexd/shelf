import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Cloud, CloudOff, LogOut, Monitor, Moon, RefreshCw, Search, Settings, Sun, TriangleAlert, User } from 'lucide-react'
import { Avatar, IconButton, MenuItem, MenuLabel, MenuSeparator, Popover, Tooltip } from '@/design'
import { useLibrary, nameOf } from '@/data/store/library'
import { usePrefs, type ThemeSetting } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { onSyncStatus, type SyncStatus } from '@/data/sync/engine'
import { cn } from '@/lib/cn'

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const profile = useLibrary((s) => s.profile)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-(--container-page) items-center gap-3 px-5 md:px-10">
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            'group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line',
            'bg-surface-2 px-4 text-left text-label text-ink-3 transition-colors',
            'hover:border-line-strong hover:bg-surface-3/60 hover:text-ink-2 md:max-w-md',
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Search</span>
          <kbd className="ml-auto hidden shrink-0 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3 md:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <SyncIndicator />
          <ThemeToggle />

          <Popover
            side="bottom"
            align="end"
            label="Account"
            role="menu"
            className="w-56"
            trigger={
              <button type="button" className="ml-1 rounded-full" aria-label="Account menu">
                <Avatar src={profile.avatarUrl} name={nameOf(profile)} size="sm" />
              </button>
            }
          >
            {({ close }) => <AccountMenu onNavigate={close} />}
          </Popover>
        </div>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */

function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate()
  const profile = useLibrary((s) => s.profile)
  const { session, enabled, signOut } = useAuth()

  const go = (to: string) => {
    onNavigate()
    navigate(to)
  }

  return (
    <>
      <div className="px-2.5 pt-2 pb-2.5">
        <p className="truncate text-label font-medium text-ink">
          {profile.displayName.trim() || (session ? 'Unnamed' : 'Guest')}
        </p>
        <p className="truncate text-meta text-ink-3">
          {session?.user.email ?? (enabled ? 'Browsing signed out' : 'Local library')}
        </p>
      </div>
      <MenuSeparator />

      {(!enabled || session) && (
        <MenuItem icon={<User className="size-4" />} onSelect={() => go('/profile')}>
          Profile
        </MenuItem>
      )}

      <MenuItem icon={<Settings className="size-4" />} onSelect={() => go('/settings')}>
        Settings
      </MenuItem>

      {enabled &&
        (session ? (
          <MenuItem
            icon={<LogOut className="size-4" />}
            onSelect={() => {
              onNavigate()
              void signOut()
            }}
          >
            Sign out
          </MenuItem>
        ) : (
          <MenuItem icon={<Cloud className="size-4" />} onSelect={() => go('/auth')}>
            Sign in to sync
          </MenuItem>
        ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */

const THEMES: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function ThemeToggle() {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const Icon = THEMES.find((t) => t.value === theme)?.icon ?? Monitor

  return (
    <Popover
      side="bottom"
      align="end"
      role="menu"
      label="Theme"
      className="w-40"
      trigger={<IconButton label="Theme" icon={<Icon className="size-4.5" />} size="sm" />}
    >
      {({ close }) => (
        <>
          <MenuLabel>Theme</MenuLabel>
          {THEMES.map((t) => (
            <MenuItem
              key={t.value}
              icon={<t.icon className="size-4" />}
              selected={theme === t.value}
              trailing={theme === t.value ? <Check className="size-4 text-accent" /> : undefined}
              onSelect={() => {
                setTheme(t.value)
                close()
              }}
            >
              {t.label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Sync state is deliberately quiet: an icon that says "everything is saved"
 * without demanding attention. It only becomes prominent when something is
 * actually wrong.
 */
function SyncIndicator() {
  const { enabled, session } = useAuth()
  const [state, setState] = useState<{ status: SyncStatus; pending: number }>({
    status: 'disabled',
    pending: 0,
  })

  useEffect(() => onSyncStatus((status, pending) => setState({ status, pending })), [])

  if (!enabled) {
    return (
      <Tooltip content="Local only — add Supabase credentials to sync across devices">
        <span className="hidden size-9.5 items-center justify-center text-ink-3 sm:flex">
          <CloudOff className="size-4.5" aria-label="Sync disabled" />
        </span>
      </Tooltip>
    )
  }

  if (!session) return null

  const { status, pending } = state

  const view = {
    syncing: { icon: RefreshCw, tone: 'text-ink-3', spin: true, label: 'Syncing…' },
    offline: { icon: CloudOff, tone: 'text-ink-3', spin: false, label: 'Offline — changes are saved locally' },
    error: { icon: TriangleAlert, tone: 'text-paused', spin: false, label: 'Sync is retrying' },
    idle: { icon: Cloud, tone: 'text-ink-3', spin: false, label: 'All changes saved' },
    disabled: { icon: CloudOff, tone: 'text-ink-3', spin: false, label: 'Sync disabled' },
  }[status]

  const Icon = view.icon

  return (
    <Tooltip content={pending > 0 ? `${view.label} (${pending} queued)` : view.label}>
      <span className={cn('hidden size-9.5 items-center justify-center sm:flex', view.tone)}>
        <Icon className={cn('size-4.5', view.spin && 'animate-spin')} aria-label={view.label} />
      </span>
    </Tooltip>
  )
}
