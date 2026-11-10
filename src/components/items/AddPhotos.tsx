import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { uploadItemImage, type ItemKind } from '../../services/items'
import { friendlyError } from '../../lib/errors'
import { PhotoPicker, type PickedPhoto } from './PhotoPicker'

/** Add more photos to an existing report. */
export function AddPhotos({ kind, itemId, existingCount }: { kind: ItemKind; itemId: string; existingCount: number }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [busy, setBusy] = useState(false)

  const upload = async () => {
    if (!user) return
    setBusy(true)
    let failed = 0
    const next = [...photos]
    for (let i = 0; i < next.length; i++) {
      if (next[i].status === 'uploaded') continue
      next[i] = { ...next[i], status: 'uploading' }
      setPhotos([...next])
      try {
        await uploadItemImage(kind, itemId, next[i].file, user.id)
        next[i] = { ...next[i], status: 'uploaded' }
      } catch (err) {
        failed++
        next[i] = { ...next[i], status: 'failed', error: friendlyError(err) }
      }
      setPhotos([...next])
    }
    setBusy(false)
    await queryClient.invalidateQueries({ queryKey: ['item-images', kind, itemId] })
    if (failed) {
      toast.error(`${failed} photo(s) failed to upload.`)
      setPhotos(next.filter((p) => p.status !== 'uploaded'))
    } else {
      toast.success('Photos added.')
      next.forEach((p) => URL.revokeObjectURL(p.preview))
      setPhotos([])
    }
  }

  return (
    <div className="stack">
      <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} existingCount={existingCount} />
      {photos.length > 0 && (
        <button type="button" className="btn btn-primary" onClick={upload} disabled={busy}>
          <Upload size={16} /> {busy ? 'Uploading…' : `Upload ${photos.length} photo(s)`}
        </button>
      )}
    </div>
  )
}
