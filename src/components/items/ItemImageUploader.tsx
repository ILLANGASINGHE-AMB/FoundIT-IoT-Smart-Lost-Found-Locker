import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { uploadItemPhoto } from '../../services/itemImages'
import type { ReportKind } from '../../services/itemImages'

type Props = {
  kind: ReportKind
  reportId: string
  onUploaded?: () => void
}

export function ItemImageUploader({ kind, reportId   , onUploaded,}: Props) {
  const inputId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading) return

    setError('')
    setSuccess('')

    const photo = fileInput.current?.files?.[0]

    if (!photo) {
      setError('Please choose a photo.')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      setError('Choose a JPEG, PNG, or WebP photo.')
      return
    }

    if (photo.size > 5 * 1024 * 1024) {
      setError('Photo must be 5 MB or smaller.')
      return
    }

    setUploading(true)

    try {
      await uploadItemPhoto(kind, reportId, photo)

      setSuccess('Photo uploaded successfully.')
      if (fileInput.current) fileInput.current.value = ''
      onUploaded?.()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not upload photo'
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload} style={{ marginTop: '24px' }}>
      <h3>Add a photo</h3>

      <label htmlFor={inputId}>Choose a JPEG, PNG, or WebP, up to 5 MB</label>

      <input
        ref={fileInput}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        required
        style={{ display: 'block', margin: '12px 0' }}
      />

      <button
        type="submit"
        disabled={uploading}
        style={{ padding: '10px 16px' }}
      >
        {uploading ? 'Uploading...' : 'Upload photo'}
      </button>

      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </form>
  )
}
