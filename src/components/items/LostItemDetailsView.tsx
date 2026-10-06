import { useEffect, useState } from 'react'
import { getLostItemById } from '../../services/lostItems'
import type { LostItemDetails } from '../../services/lostItems'
import { StatusBadge } from './StatusBadge'

type Props = {
  reportId: string
  onBack: () => void
}

export function LostItemDetailsView({ reportId, onBack }: Props) {
  const [report, setReport] = useState<LostItemDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        </article>
      )}
    </section>
  )
}