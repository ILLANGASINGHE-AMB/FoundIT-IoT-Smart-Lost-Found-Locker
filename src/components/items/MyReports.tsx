import { useState } from 'react'
import { ItemCard } from './ItemCard'

type ReportFilter = 'ALL' | 'LOST' | 'FOUND'

export function MyReports() {
  const [filter, setFilter] = useState<ReportFilter>('ALL')

  return (
    <section aria-labelledby="my-reports-heading">
      <h1 id="my-reports-heading">My Reports</h1>
      <p>Sample reports — database connection coming later.</p>

      <div className="report-filters" aria-label="Report type filters">
        <button
          type="button"
          aria-pressed={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
        >
          All
        </button>

        <button
          type="button"
          aria-pressed={filter === 'LOST'}
          onClick={() => setFilter('LOST')}
        >
          Lost
        </button>

        <button
          type="button"
          aria-pressed={filter === 'FOUND'}
          onClick={() => setFilter('FOUND')}
        >
          Found
        </button>
      </div>

      {(filter === 'ALL' || filter === 'LOST') && (
        <ItemCard
          title="Lost Samsung phone"
          category="Electronics"
          status="LOST"
          date="2026-10-04"
        />
      )}

      {(filter === 'ALL' || filter === 'FOUND') && (
        <ItemCard
          title="Found a bunch of keys"
          category="Keys"
          status="FOUND"
          date="2026-10-04"
        />
      )}
    </section>
  )
}