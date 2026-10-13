import { useState } from 'react'
import { LostItemForm } from './LostItemForm'
import { FoundItemForm } from './FoundItemForm'

type Props = {
  initialType?: 'lost' | 'found'
}

export function ReportItemView({ initialType = 'lost' }: Props) {
  const [reportType, setReportType] = useState<'lost' | 'found'>(
    initialType
  )

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