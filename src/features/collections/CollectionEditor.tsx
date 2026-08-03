import { useEffect, useState } from 'react'
import { Globe, Link2, Lock } from 'lucide-react'
import { Button, Dialog, Field, Input, Textarea, MenuItem, Popover, toast } from '@/design'
import { cn } from '@/lib/cn'
import { useLibrary } from '@/data/store/library'
import type { Collection, CollectionLayout, CollectionPrivacy } from '@/data/store/types'

const PRIVACY: { value: CollectionPrivacy; label: string; hint: string; icon: typeof Lock }[] = [
  { value: 'private', label: 'Private', hint: 'Only you', icon: Lock },
  { value: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link', icon: Link2 },
  { value: 'public', label: 'Public', hint: 'Shown on your profile', icon: Globe },
]

const LAYOUTS: { value: CollectionLayout; label: string; hint: string }[] = [
  { value: 'grid', label: 'Grid', hint: 'Even wall of covers' },
  { value: 'ranked', label: 'Ranked', hint: 'Numbered, drag to order' },
  { value: 'showcase', label: 'Showcase', hint: 'Large art with your notes' },
]

export function CollectionEditor({
  collection,
  open,
  onClose,
}: {
  /** Omit to create a new one. */
  collection?: Collection
  open: boolean
  onClose: () => void
}) {
  const createCollection = useLibrary((s) => s.createCollection)
  const updateCollection = useLibrary((s) => s.updateCollection)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<CollectionPrivacy>('private')
  const [layout, setLayout] = useState<CollectionLayout>('grid')
  const [tags, setTags] = useState('')

  // Reset whenever the dialog opens so a cancelled edit doesn't leak into the
  // next one.
  useEffect(() => {
    if (!open) return
    setName(collection?.name ?? '')
    setDescription(collection?.description ?? '')
    setPrivacy(collection?.privacy ?? 'private')
    setLayout(collection?.layout ?? 'grid')
    setTags(collection?.tags.join(', ') ?? '')
  }, [open, collection])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12)

    const patch = {
      name: trimmed,
      description: description.trim() || null,
      privacy,
      layout,
      tags: parsedTags,
    }

    if (collection) {
      updateCollection(collection.id, patch)
      toast({ message: 'Collection updated' })
    } else {
      createCollection(patch)
      toast({ message: `${trimmed} created` })
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={collection ? 'Edit collection' : 'New collection'}
      description="Collections aren't folders — they're how your taste gets a shape."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim()}>
            {collection ? 'Save changes' : 'Create collection'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name" counter={`${name.length} / 80`}>
          {(props) => (
            <Input
              {...props}
              data-autofocus
              value={name}
              maxLength={80}
              placeholder="Shows that changed my life"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          )}
        </Field>

        <Field
          label="Description"
          counter={`${description.length} / 1000`}
          hint="A line about why these belong together."
        >
          {(props) => (
            <Textarea
              {...props}
              value={description}
              maxLength={1000}
              rows={3}
              placeholder="For when the day has been too long."
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>

        <Field label="Tags" hint="Comma separated, up to 12.">
          {(props) => (
            <Input
              {...props}
              value={tags}
              placeholder="cozy, rewatch, autumn"
              onChange={(e) => setTags(e.target.value)}
            />
          )}
        </Field>

        <div>
          <p className="mb-2 text-label font-medium text-ink">Layout</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LAYOUTS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLayout(l.value)}
                aria-pressed={layout === l.value}
                className={cn(
                  'rounded-md border p-3 text-left transition-colors',
                  layout === l.value
                    ? 'border-accent bg-accent-quiet'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <LayoutPreview layout={l.value} active={layout === l.value} />
                <p className="mt-2.5 text-label font-medium text-ink">{l.label}</p>
                <p className="text-meta text-ink-3">{l.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-label font-medium text-ink">Visibility</p>
          <Popover
            align="start"
            role="menu"
            label="Visibility"
            className="w-64"
            trigger={
              <Button block className="justify-start">
                {(() => {
                  const active = PRIVACY.find((p) => p.value === privacy)!
                  return (
                    <>
                      <active.icon className="size-4 text-ink-3" aria-hidden />
                      {active.label}
                      <span className="ml-auto text-meta text-ink-3">{active.hint}</span>
                    </>
                  )
                })()}
              </Button>
            }
          >
            {({ close }) => (
              <>
                {PRIVACY.map((p) => (
                  <MenuItem
                    key={p.value}
                    icon={<p.icon className="size-4" />}
                    selected={privacy === p.value}
                    trailing={<span className="text-meta text-ink-3">{p.hint}</span>}
                    onSelect={() => {
                      setPrivacy(p.value)
                      close()
                    }}
                  >
                    {p.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
        </div>
      </div>
    </Dialog>
  )
}

/** Tiny abstract diagram of each layout — cheaper to read than a paragraph. */
function LayoutPreview({ layout, active }: { layout: CollectionLayout; active: boolean }) {
  const fill = active ? 'bg-accent/45' : 'bg-surface-3'

  if (layout === 'ranked') {
    return (
      <div className="flex h-10 flex-col justify-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn('h-1.5 w-1.5 rounded-full', fill)} />
            <div className={cn('h-1.5 flex-1 rounded-full', fill)} style={{ opacity: 1 - i * 0.25 }} />
          </div>
        ))}
      </div>
    )
  }

  if (layout === 'showcase') {
    return (
      <div className="flex h-10 items-stretch gap-1" aria-hidden>
        <div className={cn('w-5 rounded-[3px]', fill)} />
        <div className="flex flex-1 flex-col justify-center gap-1">
          <div className={cn('h-1.5 w-full rounded-full', fill)} />
          <div className={cn('h-1.5 w-2/3 rounded-full', fill)} />
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-10 grid-cols-4 gap-1" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={cn('rounded-[3px]', fill)} />
      ))}
    </div>
  )
}
