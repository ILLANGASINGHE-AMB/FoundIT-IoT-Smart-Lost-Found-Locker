import { useState } from 'react'
import { LostItemForm } from './LostItemForm'
import { FoundItemForm } from './FoundItemForm'

export function ReportItemView() {
  const [reportType, setReportType] = useState<'lost' | 'found'>('lost')

  return (
    <section>
      <div className="report-filters">
        <button
          type="button"
          aria-pressed={reportType === 'lost'}
          onClick={() => setReportType('lost')}
        >
          I lost an item
        </button>

        <button
          type="button"
          aria-pressed={reportType === 'found'}
          onClick={() => setReportType('found')}
        >
          I found an item
        </button>
      </div>

      <div hidden={reportType !== 'lost'}>
        <LostItemForm />
      </div>

      <div hidden={reportType !== 'found'}>
        <FoundItemForm />
      </div>
    </section>
  )
}