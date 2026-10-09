import { useEffect, useState } from 'react'
import {
  getItemImages,
  deleteItemPhoto,
} from '../../services/itemImages'
import type { ItemImage, ReportKind } from '../../services/itemImages'

type Props = {
  kind: ReportKind
  reportId: string
  refreshKey: number
  canRemove: boolean
}

export function ItemImageGallery({
  kind,
  reportId,
  refreshKey,
  canRemove,
}: Props) {
  const [photos, setPhotos] = useState<ItemImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState('')

  useEffect(() => {
    let active = true

    async function loadPhotos() {
      setLoading(true)
      setError('')

      try {
        const data = await getItemImages(kind, reportId)
        if (active) setPhotos(data)
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error ? error.message : 'Could not load photos'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPhotos()

    return () => {
      active = false
    }
  }, [kind, reportId, refreshKey])


  async function handleRemove(imageId: string) {
  if (removingId) return

  const confirmed = window.confirm(
    'Remove this photo permanently? You can upload it again if needed.'
  )

  if (!confirmed) return

  setRemovingId(imageId)
  setRemoveError('')

  try {
    await deleteItemPhoto(imageId)

    setPhotos((current) =>
      current.filter((photo) => photo.id !== imageId)
    )
  } catch (error) {
    setRemoveError(
      error instanceof Error ? error.message : 'Could not remove the photo'
    )
  } finally {
    setRemovingId(null)
  }
}

  return (
    <section style={{ marginTop: '24px' }}>
      <h3>Photos</h3>
      {removeError && <p role="alert">{removeError}</p>}

      {loading && <p role="status">Loading photos...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && photos.length === 0 && (
        <p>No photos uploaded yet.</p>
      )}

      {!loading && !error && photos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
         {photos.map((photo, index) => (
  <div key={photo.id}>
    <a
      href={photo.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        src={photo.url}
        alt={`Item photo ${index + 1}`}
        loading="lazy"
        style={{
          width: '100%',
          height: '180px',
          objectFit: 'contain',
          borderRadius: '12px',
          background: '#f1f5f9',
        }}
      />
    </a>

    {canRemove && (
      <button
        type="button"
        onClick={() => handleRemove(photo.id)}
        disabled={removingId !== null}
        aria-label={`Remove item photo ${index + 1}`}
        style={{ padding: '8px 12px', marginTop: '8px' }}
      >
        {removingId === photo.id ? 'Removing...' : 'Remove photo'}
      </button>
    )}
  </div>
))}
          
          
        </div>
      )}
    </section>
  )
}