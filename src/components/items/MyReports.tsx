import { useEffect, useState } from 'react'
import { ItemCard } from './ItemCard'
import { LostItemDetailsView } from './LostItemDetailsView'
import { getLostItems } from '../../services/lostItems'
import { getFoundItems } from '../../services/foundItems'
import type { ItemStatus } from './StatusBadge'
import { FoundItemDetailsView } from './FoundItemDetailsView'

type ReportFilter = 'ALL' | 'LOST' | 'FOUND'

type ReportSummary = {
  id: string
  kind: 'LOST' | 'FOUND'
  title: string
  category: string
  status: ItemStatus
  date: string
  created_at: string
  imageUrl: string | undefined
}

export function MyReports() {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [filter, setFilter] = useState<ReportFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [selectedReport, setSelectedReport] = useState<{
  id: string
  kind: 'LOST' | 'FOUND'
} | null>(null)

  useEffect(() => {
    let active = true

    async function loadReports() {
      setLoading(true)
      setError('')

      try {
        const [lostItems, foundItems] = await Promise.all([
          getLostItems(),
          getFoundItems(),
        ])

        const combined: ReportSummary[] = [
          ...lostItems.map((item): ReportSummary => ({
            id: item.id,
            kind: 'LOST',
            title: item.title,
            category: item.category,
            status: item.status,
            date: item.date_lost,
            created_at: item.created_at,
            imageUrl: item.image_id
  ? `http://127.0.0.1:3001/api/images/${item.image_id}`
  : undefined,
          })),
          ...foundItems.map((item): ReportSummary => ({
            id: item.id,
            kind: 'FOUND',
            title: item.title,
            category: item.category,
            status: item.status,
            date: item.date_found,
            created_at: item.created_at,
            imageUrl: item.image_id
  ? `http://127.0.0.1:3001/api/images/${item.image_id}`
  : undefined,
          })),
        ]

        combined.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )

        if (active) setReports(combined)
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load reports'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadReports()

    return () => {
      active = false
    }
  }, [reload])

 if (selectedReport) {
  const handleBack = () => {
    setSelectedReport(null)
    setReload((value) => value + 1)
  }

  return selectedReport.kind === 'LOST' ? (
    <LostItemDetailsView
      key={selectedReport.id}
      reportId={selectedReport.id}
      onBack={handleBack}
    />
  ) : (
    <FoundItemDetailsView
      key={selectedReport.id}
      reportId={selectedReport.id}
      onBack={handleBack}
    />
  )
}

  const visibleReports = reports.filter(
    (report) => filter === 'ALL' || report.kind === filter
  )

  return (
    <section>
      <h2>My Reports</h2>
      <p>Lost and found reports saved by the local test user.</p>

      < div className="report-filters">
        {(['ALL', 'LOST', 'FOUND'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {option === 'ALL' ? 'All' : option === 'LOST' ? 'Lost' : 'Found'}
          </button>
        ))}
      </div>

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

      {!loading && !error && visibleReports.length === 0 && (
        <p>No reports in this category yet.</p>
      )}

      {!loading && !error && visibleReports.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {visibleReports.map((report) => (
            <div key={`${report.kind}-${report.id}`}>
              <ItemCard
                title={report.title}
                category={report.category}
                status={report.status}
                date={report.date}
                 imageUrl={report.imageUrl}
              />

              <button
              type="button"
              onClick={() =>
                setSelectedReport({
                  id: report.id,
                  kind: report.kind,
                })
              }
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