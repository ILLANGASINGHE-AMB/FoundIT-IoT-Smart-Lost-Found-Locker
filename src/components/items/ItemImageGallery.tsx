import { useEffect, useState } from 'react'
import { getItemImages } from '../../services/itemImages'
import type { ItemImage, ReportKind } from '../../services/itemImages'

type Props = {
  kind: ReportKind
  reportId: string
  refreshKey: number
}

export function ItemImageGallery({
  kind,
  reportId,
  refreshKey,
}: Props) {
  const [photos, setPhotos] = useState<ItemImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <section style={{ marginTop: '24px' }}>
      <h3>Photos</h3>

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
            <a
              key={photo.id}
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
          ))}
        </div>
      )}
    </section>
  )
}