import { Construction } from 'lucide-react'
import { EmptyState, PageHeader } from '../components/ui'

/** Phase 0 route skeleton: each module replaces its placeholders. */
export function PlaceholderPage({ title, module }: { title: string; module: string }) {
  return (
    <div className="page">
      <PageHeader title={title} />
      <div className="card">
        <EmptyState
          icon={<Construction size={26} />}
          title="Coming soon"
          description={`This screen is delivered by the ${module} module.`}
        />
      </div>
    </div>
  )
}
