import { useEffect, useState } from 'react'
import { getFoundItemById } from '../../services/foundItems'
import type { FoundItemDetails } from '../../services/foundItems'
import { StatusBadge } from './StatusBadge'
import { ItemImageUploader } from './ItemImageUploader'
import { ItemImageGallery } from './ItemImageGallery'

type Props = {
  reportId: string
  onBack: () => void
}

export function FoundItemDetailsView({ reportId, onBack }: Props) {
  const [report, setReport] = useState<FoundItemDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoRefresh, setPhotoRefresh] = useState(0)

  useEffect(() => {
    let active = true

    async function loadDetails() {
      setLoading(true)
      setError('')
      setReport(null)

      try {
        const data = await getFoundItemById(reportId)

        if (active) setReport(data)
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load found report details'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDetails()

    return () => {
      active = false
    }
  }, [reportId])

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        style={{ padding: '10px 16px', marginBottom: '20px' }}
      >
        Back to My Reports
      </button>

      {loading && <p role="status">Loading report...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && report && (
        <article style={{ maxWidth: '640px', overflowWrap: 'anywhere' }}>
          <h2>{report.title}</h2>
          <StatusBadge status={report.status} />

          <p><strong>Category:</strong> {report.category}</p>
          <p><strong>Found location:</strong> {report.location}</p>
          <p><strong>Date found:</strong> {report.date_found}</p>

          <h3>Description</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{report.description}</p>

          <p><strong>Brand:</strong> {report.brand || 'Not provided'}</p>
          <p><strong>Model:</strong> {report.model || 'Not provided'}</p>
          <p><strong>Color:</strong> {report.color || 'Not provided'}</p>

          <p>
            <strong>Reported:</strong>{' '}
            {new Date(report.created_at).toLocaleString()}
          </p>
          <p>
            <strong>Last updated:</strong>{' '}
            {new Date(report.updated_at).toLocaleString()}
          </p>
          {report.status === 'FOUND' && (
            <>
              <ItemImageGallery
                kind="found-items"
                reportId={report.id}
                refreshKey={photoRefresh}
              />

              <ItemImageUploader
                kind="found-items"
                reportId={report.id}
                onUploaded={() => setPhotoRefresh((value) => value + 1)}
              />
            </>
          )}
        </article>
      )}
    </section>
  )
}