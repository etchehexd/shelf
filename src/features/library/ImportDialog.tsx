import { useEffect, useState } from 'react'
import { Check, Download } from 'lucide-react'
import { Button, Dialog, toast } from '@/design'
import { ImportSources } from '@/features/onboarding/ImportSources'

/**
 * Bringing a list in, from a shelf that already exists.
 *
 * Onboarding's version of this is a room you walk through once. This one is a
 * drawer you open on a Tuesday because you finally got round to moving the rest
 * of your list over, and it is written for someone who already has titles here:
 * the thing they need told, before they type a username, is what happens to the
 * shelf they have already built.
 *
 * The answer — anything already on the shelf keeps the progress and score it
 * has here — is a promise the store makes, not one this dialog invents. See
 * `importEntries`.
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [added, setAdded] = useState<number | null>(null)

  // A second visit is a second import, not a lingering receipt from the first.
  useEffect(() => {
    if (open) setAdded(null)
  }, [open])

  const finish = () => {
    if (added != null) toast({ message: `${added} added to your shelf` })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={finish}
      title={added == null ? 'Bring a list in' : 'Done'}
      description={
        added == null
          ? 'Progress, statuses and scores come across. Anything already on your shelf keeps what it has here — an import can only add.'
          : undefined
      }
      size="sm"
      footer={
        added != null ? (
          <Button variant="primary" size="sm" onClick={finish}>
            Back to the shelf
          </Button>
        ) : undefined
      }
    >
      {added == null ? (
        <ImportSources onDone={setAdded} autoFocus />
      ) : (
        <div className="flex items-center gap-4 py-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Check className="size-5" strokeWidth={2.2} />
          </span>
          <p className="text-body text-ink-2">
            <span className="font-mono-num font-semibold text-ink">{added}</span>{' '}
            {added === 1 ? 'title' : 'titles'} added. Artwork and details fill in as you browse.
          </p>
        </div>
      )}
    </Dialog>
  )
}

/** The trigger. Lives in the Library masthead, beside the view controls. */
export function ImportButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="md" icon={<Download className="size-4" />} onClick={() => setOpen(true)}>
        Import
      </Button>
      <ImportDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
