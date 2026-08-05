import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { ArrowRight, Check, Download, Layers, Search } from 'lucide-react'
import { Button, Eyebrow, Rule, useScrollLock } from '@/design'
import { useLibrary } from '@/data/store/library'
import { usePrefs } from '@/data/store/prefs'
import { useAuth } from '@/data/supabase/auth'
import { ImportSources } from './ImportSources'

/**
 * First run.
 *
 * A new account starts genuinely empty — no sample library, no borrowed taste.
 * The room is empty because it is *yours*, and the only job of this screen is
 * to hand over the three doors out of it: find something, bring a list with
 * you, or just start looking around.
 *
 * The import *step* — not this screen, and not the welcome copy — is the one
 * and only place in the entire product that names another tracking site, and it
 * does so for exactly one reason: you cannot ask someone for their list from a
 * service without telling them which service. Every other surface, including
 * the door that leads here and the confirmation that follows it, is written as
 * though those services do not exist. Past this step, the app never mentions
 * where anything came from again.
 */
export function Onboarding() {
  const onboarded = usePrefs((s) => s.onboarded)
  const setOnboarded = usePrefs((s) => s.setOnboarded)
  const hasLibrary = useLibrary((s) => Object.keys(s.entries).length > 0)

  // The importer writes entries straight into the store, which would be a hole
  // straight through the write gate — a signed-out visitor could land three
  // hundred titles in a library that has no account to hold them. First run
  // begins once there is somewhere for it to go; until then the sign-in walls
  // do this screen's job.
  const { canWrite } = useAuth()

  const [step, setStep] = useState<'welcome' | 'import'>('welcome')
  const open = canWrite && !onboarded && !hasLibrary

  useScrollLock(open)

  const navigate = useNavigate()

  if (!open) return null

  const finish = (to?: string) => {
    setOnboarded(true)
    if (to) navigate(to)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16 md:px-10">
        {step === 'welcome' ? (
          <Welcome onImport={() => setStep('import')} onFinish={finish} />
        ) : (
          <ImportStep onBack={() => setStep('welcome')} onFinish={finish} />
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------------------------------------- welcome -- */

function Welcome({
  onImport,
  onFinish,
}: {
  onImport: () => void
  onFinish: (to?: string) => void
}) {
  return (
    <div className="motion-safe:animate-[rise-in_620ms_var(--ease-out-expo)]">
      <EmptyShelfMark />

      <Eyebrow className="mt-12 mb-5">A new shelf</Eyebrow>
      <h1 className="text-balance text-display-lg text-ink md:text-display-xl">
        Nothing on it yet.
      </h1>
      <p className="prose-width mt-4 text-body text-ink-2">
        Everything here is built from what you actually watch and read, so it starts empty and
        fills in as you go.
      </p>

      <Rule className="mt-10 mb-2" />

      <div className="divide-y divide-line">
        <Door
          icon={<Search className="size-5" strokeWidth={1.6} />}
          title="Find your first title"
          hint="Search anything and put it on the shelf."
          onClick={() => onFinish('/discover')}
        />
        <Door
          icon={<Download className="size-5" strokeWidth={1.6} />}
          title="Bring a list with you"
          hint="Import what you're already tracking somewhere else."
          onClick={onImport}
        />
        <Door
          icon={<Layers className="size-5" strokeWidth={1.6} />}
          title="Start a collection"
          hint="Comfort shows, best soundtracks, the five you'd defend."
          onClick={() => onFinish('/collections')}
        />
      </div>

      <div className="mt-10">
        <button
          type="button"
          onClick={() => onFinish()}
          className="label-cat label-cat-plain hover:text-ink"
        >
          Just look around
        </button>
      </div>
    </div>
  )
}

/** A door out of the empty room. Row, not card — the list is the composition. */
function Door({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-5 py-5 text-left"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-[color,border-color,transform] duration-300 group-hover:scale-105 group-hover:border-accent-line group-hover:text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-display-sm text-ink transition-colors group-hover:text-accent">
          {title}
        </span>
        <span className="mt-1 block text-meta text-ink-2">{hint}</span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-ink-3 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:text-ink"
        aria-hidden
      />
    </button>
  )
}

/**
 * Three dashed slots on a rule. The same empty-shelf drawing the app uses for
 * every empty state, at hero size — so the first thing you see is already the
 * product's own language rather than a stock illustration.
 */
function EmptyShelfMark() {
  return (
    <div className="relative" aria-hidden>
      <div className="flex items-end gap-3">
        {[96, 128, 108, 140, 84].map((h, i) => (
          <div
            key={i}
            className="rounded-t-[3px] border border-b-0 border-dashed border-line-strong motion-safe:animate-[rise-in_700ms_var(--ease-out-expo)_both]"
            style={{ width: 62, height: h, animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>
      <div className="shelf-line" />
    </div>
  )
}

/* ----------------------------------------------------------------- import -- */

function ImportStep({
  onBack,
  onFinish,
}: {
  onBack: () => void
  onFinish: (to?: string) => void
}) {
  const [added, setAdded] = useState<number | null>(null)

  if (added != null) {
    return (
      <div className="motion-safe:animate-[rise-in_460ms_var(--ease-out-expo)]">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Check className="size-6" strokeWidth={2.2} />
        </span>
        <Eyebrow className="mt-8 mb-5">Done</Eyebrow>
        <h1 className="text-display-lg text-ink">
          {added} {added === 1 ? 'title' : 'titles'} on the shelf.
        </h1>
        {/* Deliberately says nothing about where they came from. This is the
            first screen past the import, and it is already Shelf's own room. */}
        <p className="prose-width mt-4 text-body text-ink-2">
          Artwork and details fill in as you browse. Scores carried over on anything you'd
          finished; everything else is waiting for a verdict.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={() => onFinish('/library')}>
            Open your shelf
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button size="lg" onClick={() => onFinish()}>
            Go to the home page
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="motion-safe:animate-[rise-in_460ms_var(--ease-out-expo)]">
      <Eyebrow className="mb-5">Import</Eyebrow>
      <h1 className="text-display-lg text-ink">Bring your list with you.</h1>
      <p className="prose-width mt-4 text-body text-ink-2">
        Progress, statuses and scores come across. Nothing is sent anywhere — the list is read
        once and stored on this device.
      </p>

      <div className="mt-9">
        <ImportSources onDone={setAdded} />
      </div>

      <div className="mt-10 flex items-center gap-6">
        <button
          type="button"
          onClick={onBack}
          className="label-cat label-cat-plain hover:text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onFinish()}
          className="label-cat label-cat-plain hover:text-ink"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
