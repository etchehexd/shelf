import { useRef, useState } from 'react'
import { ImageUp, Link2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Input } from './Field'
import { toast } from './Toast'

/**
 * Pick an image by choosing a file, not by pasting a URL.
 *
 * Asking somebody for an "Avatar URL" is asking them to go and host an image
 * somewhere first. Almost nobody has a URL for a photo of themselves; everybody
 * has the photo.
 *
 * ------------------------------------------------------------------- storage
 *
 * The file is downscaled in a canvas and stored as a data URI on the profile
 * record. That is a real constraint and worth stating plainly: this product has
 * no object storage, and the profile row syncs as JSON, so an image has to fit
 * inside a text column or it cannot sync at all.
 *
 * Hence the aggressive resize. An avatar is capped at 512px and a banner at
 * 1600px, both re-encoded as JPEG at 0.82, which puts a typical photo in the
 * 40–120kB range once base64'd. `MAX_BYTES` is a hard stop after encoding — if
 * a picture will not fit, the user is told, rather than the row being rejected
 * by the database minutes later during a background sync.
 *
 * Pasting a URL still works, for anyone who does have one. It is the second
 * option now rather than the only one.
 */

/** Encoded size ceiling. Comfortably under a Postgres text column's practical
 *  limit while leaving room for the rest of the profile in one payload. */
const MAX_BYTES = 700_000

async function downscale(file: File, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  // JPEG rather than PNG: a photograph as PNG is several times larger for no
  // visible gain, and transparency is meaningless behind a circular crop.
  return canvas.toDataURL('image/jpeg', 0.82)
}

export interface ImagePickerProps {
  label: string
  hint?: string
  value: string | null
  onChange: (next: string | null) => void
  /** Longest edge after downscaling. */
  maxEdge?: number
  /** Preview shape. */
  shape?: 'circle' | 'banner'
}

export function ImagePicker({
  label,
  hint,
  value,
  onChange,
  maxEdge = 512,
  shape = 'circle',
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [urlMode, setUrlMode] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ message: 'That file is not an image.', tone: 'danger' })
      return
    }

    setBusy(true)
    try {
      const dataUri = await downscale(file, maxEdge)
      if (dataUri.length > MAX_BYTES) {
        toast({
          message: 'That image is too large even after resizing. Try a smaller one.',
          tone: 'danger',
        })
        return
      }
      onChange(dataUri)
    } catch (e) {
      toast({
        message: e instanceof Error ? e.message : 'Could not read that image.',
        tone: 'danger',
      })
    } finally {
      setBusy(false)
      // Cleared so choosing the same file twice in a row still fires a change.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label font-medium text-ink">{label}</span>
        <button
          type="button"
          onClick={() => setUrlMode((v) => !v)}
          className="label-cat label-cat-plain hover:text-ink"
        >
          {urlMode ? 'Upload instead' : 'Use a link'}
        </button>
      </div>

      {urlMode ? (
        <Input
          value={value ?? ''}
          placeholder="https://…"
          aria-label={`${label} link`}
          onChange={(e) => onChange(e.target.value || null)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label={`Choose ${label.toLowerCase()}`}
            className={cn(
              'group relative shrink-0 overflow-hidden border border-dashed border-line-strong',
              'bg-surface-2 transition-colors hover:border-accent',
              shape === 'circle' ? 'size-16 rounded-full' : 'h-16 w-40 rounded-md',
            )}
          >
            {value ? (
              <img src={value} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-3 group-hover:text-accent">
                <ImageUp className="size-5" aria-hidden />
              </span>
            )}

            {busy && (
              <span className="absolute inset-0 flex items-center justify-center bg-canvas/70">
                <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
              </span>
            )}
          </button>

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<ImageUp className="size-4" />} onClick={() => inputRef.current?.click()}>
                {value ? 'Replace' : 'Upload'}
              </Button>
              {value && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X className="size-4" />}
                  onClick={() => onChange(null)}
                >
                  Remove
                </Button>
              )}
            </div>
            {hint && <p className="text-meta text-ink-3">{hint}</p>}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {urlMode && (
        <p className="flex items-center gap-1.5 text-meta text-ink-3">
          <Link2 className="size-3" aria-hidden />
          Paste a direct link to an image.
        </p>
      )}
    </div>
  )
}
