import { useEffect, useState } from 'react'
import {getLostItemById, cancelLostItem,} from '../../services/lostItems'
import type { LostItemDetails } from '../../services/lostItems'
import { StatusBadge } from './StatusBadge'
import { ItemImageUploader } from './ItemImageUploader'
import { ItemImageGallery } from './ItemImageGallery'


type Props = {
  reportId: string
  onBack: () => void
}

export function LostItemDetailsView({ reportId, onBack }: Props) {
  const [report, setReport] = useState<LostItemDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [photoRefresh, setPhotoRefresh] = useState(0)

  useEffect(() => {
    let active = true

    async function loadDetails() {
      setLoading(true)
      setError('')
      setReport(null)

      try {
        const data = await getLostItemById(reportId)

        if (active) setReport(data)
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load report details'
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

   async function handleCancel() {
  if (!report || cancelling) return

  const confirmed = window.confirm(
    'Cancel this lost report? Its status will change to CANCELLED.'
  )

  if (!confirmed) return

  setCancelling(true)
  setCancelError('')

  try {
    const result = await cancelLostItem(report.id)

    setReport((current) =>
      current
        ? {
            ...current,
            status: result.status,
            updated_at: result.updated_at,
          }
        : current
    )
  } catch (error) {
    setCancelError(
      error instanceof Error
        ? error.message
        : 'Could not cancel the report'
    )
  } finally {
    setCancelling(false)
  }
}

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        disabled={cancelling}
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


          {report.status === 'LOST' && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  display: 'block',
                  marginTop: '16px',
                  padding: '10px 16px',
                }}
              >
                {cancelling ? 'Cancelling...' : 'Cancel report'}
              </button>
            )}

            {cancelError && <p role="alert">{cancelError}</p>}



          <p><strong>Category:</strong> {report.category}</p>
          <p><strong>Last seen location:</strong> {report.location}</p>
          <p><strong>Date lost:</strong> {report.date_lost}</p>

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

 <ItemImageGallery
  kind="lost-items"
  reportId={report.id}
  refreshKey={photoRefresh}
   canRemove={report.status === 'LOST'}
/>

{report.status === 'LOST' && (
  <ItemImageUploader
    kind="lost-items"
    reportId={report.id}
    onUploaded={() => setPhotoRefresh((value) => value + 1)}
  />
)}
        </article>
      )}
    </section>
  )
}