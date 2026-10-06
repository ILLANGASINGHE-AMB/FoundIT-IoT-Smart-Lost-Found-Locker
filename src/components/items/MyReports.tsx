import { useEffect, useState } from 'react'
import { ItemCard } from './ItemCard'
import { getLostItems } from '../../services/lostItems'
import type { LostItemSummary } from '../../services/lostItems'
import { LostItemDetailsView } from './LostItemDetailsView'

export function MyReports() {
  const [reports, setReports] = useState<LostItemSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadReports() {
      setLoading(true)
      setError('')

      try {
        const data = await getLostItems()

        if (active) {
          setReports(data)
        }
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load reports'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      active = false
    }
  }, [reload])

  if (selectedReportId) {
  return (
    <LostItemDetailsView
      key={selectedReportId}
      reportId={selectedReportId}
      onBack={() => setSelectedReportId(null)}
    />
  )
}



  return (
    <section>
      <h2>My Reports</h2>
      <p>Lost reports saved by the local test user.</p>

      <button
        type="button"
        onClick={() => setReload((value) => value + 1)}
        disabled={loading}
        style={{ padding: '10px 16px', margin: '16px 0' }}
      >
        {loading ? 'Loading...' : 'Refresh reports'}
      </button>

      {loading && <p role="status">Loading your reports...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && reports.length === 0 && (
        <p>No lost reports yet. Use Report to create one.</p>
      )}

      {!loading && !error && reports.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {reports.map((report) => (
  <div key={report.id}>
    <ItemCard
      title={report.title}
      category={report.category}
      status={report.status}
      date={report.date_lost}
    />

    <button
      type="button"
      onClick={() => setSelectedReportId(report.id)}
      aria-label={`View details for ${report.title}`}
      style={{ padding: '10px 16px', marginTop: '10px' }}
    >
      View details
    </button>
  </div>
))}
        </div>
      )}
    </section>
  )
}