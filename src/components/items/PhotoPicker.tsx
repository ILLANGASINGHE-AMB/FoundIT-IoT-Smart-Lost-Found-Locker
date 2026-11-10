import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { IMAGE_MAX_COUNT, validateImage } from '../../services/items'

export interface PickedPhoto {
  id: string
  file: File
  preview: string
  status: 'ready' | 'uploading' | 'uploaded' | 'failed'
  error?: string
}

/**
 * Multi-image picker with previews. Supports drag & drop on desktop and
 * the rear camera on mobile (capture="environment").
 */
export function PhotoPicker({
  photos,
  onChange,
  disabled,
  existingCount = 0,
}: {
  photos: PickedPhoto[]
  onChange: (photos: PickedPhoto[]) => void
  disabled?: boolean
  existingCount?: number
}) {
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const galleryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const latest = useRef(photos)
  latest.current = photos

  // Release object URLs on unmount.
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return
    const list = Array.from(files)
    const room = IMAGE_MAX_COUNT - existingCount - photos.length
    const problems: string[] = []
    const accepted: PickedPhoto[] = []

    for (const file of list) {
      const problem = validateImage(file)
      if (problem) problems.push(problem)
      else if (accepted.length >= room) problems.push(`You can add up to ${IMAGE_MAX_COUNT} photos per report.`)
      else accepted.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: 'ready' })
    }

    setError([...new Set(problems)].join(' '))
    if (accepted.length) onChange([...photos, ...accepted])
  }

  const remove = (photo: PickedPhoto) => {
    URL.revokeObjectURL(photo.preview)
    onChange(photos.filter((p) => p.id !== photo.id))
  }

  return (
    <div className="stack">
      <div
        className={`photo-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) addFiles(e.dataTransfer.files)
        }}
      >
        <ImagePlus size={26} />
        <p>
          Drag photos here, or choose from your device.
          <br />
          <span className="muted small">JPEG, PNG or WebP · up to 5 MB each · max {IMAGE_MAX_COUNT}</span>
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => galleryInput.current?.click()}>
            <ImagePlus size={16} /> Choose photos
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm mobile-only"
            disabled={disabled}
            onClick={() => cameraInput.current?.click()}
          >
            <Camera size={16} /> Take photo
          </button>
        </div>
        <input
          ref={galleryInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <span className="field-error">{error}</span>}

      {photos.length > 0 && (
        <div className="photo-previews">
          {photos.map((photo) => (
            <figure key={photo.id} className={`photo-preview status-${photo.status}`}>
              <img src={photo.preview} alt={photo.file.name} />
              {photo.status === 'uploading' && <span className="photo-preview-status">Uploading…</span>}
              {photo.status === 'uploaded' && <span className="photo-preview-status ok">Uploaded</span>}
              {photo.status === 'failed' && <span className="photo-preview-status err">Failed</span>}
              {!disabled && photo.status !== 'uploaded' && photo.status !== 'uploading' && (
                <button type="button" onClick={() => remove(photo)} aria-label={`Remove ${photo.file.name}`}>
                  <X size={14} />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
