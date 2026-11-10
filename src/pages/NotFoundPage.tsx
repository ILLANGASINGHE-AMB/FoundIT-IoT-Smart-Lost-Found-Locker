import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { EmptyState } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="page page-narrow" style={{ justifyContent: 'center', minHeight: '70vh' }}>
      <EmptyState
        icon={<SearchX size={26} />}
        title="We couldn’t find that page"
        description="The link may be broken, or the page may have moved."
        action={
          <Link to="/dashboard" className="btn btn-primary">
            Go to dashboard
          </Link>
        }
      />
    </div>
  )
}
