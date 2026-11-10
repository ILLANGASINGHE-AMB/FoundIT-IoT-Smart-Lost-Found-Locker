import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { getMyMatches } from '../../services/matching'
import { MatchCard } from '../../components/matching/MatchCard'
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import type { MatchStatus } from '../../types'

const FILTERS: { value: MatchStatus | 'ALL'; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CONVERTED_TO_CLAIM', label: 'Claimed' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'ALL', label: 'All' },
]

/** /matches — every candidate for the user's lost items, best score first. */
export function MatchesPage() {
  const [status, setStatus] = useState<MatchStatus | 'ALL'>('OPEN')
  const query = useQuery({ queryKey: ['matches', status], queryFn: () => getMyMatches(status) })

  return (
    <div className="page">
      <PageHeader
        title="My Matches"
        description="Found items that look like something you lost. A match is only a possibility — you’ll verify ownership when you claim."
      />

      <div className="tabs" role="tablist" aria-label="Filter matches">
        {FILTERS.map((f) => (
          <button key={f.value} role="tab" className="tab" aria-selected={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading && <SkeletonList rows={4} height={104} />}
      {query.isError && <ErrorState message="Could not load your matches." onRetry={() => query.refetch()} />}

      {query.data && query.data.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Sparkles size={26} />}
            title={status === 'OPEN' ? 'No open matches yet' : 'Nothing here'}
            description={
              status === 'OPEN'
                ? 'We compare every found report against your lost items and notify you the moment something looks similar.'
                : 'Try another filter.'
            }
            action={
              status === 'OPEN' && (
                <Link to="/lost/new" className="btn btn-primary">
                  Report a lost item
                </Link>
              )
            }
          />
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <div className="stack">
          {query.data.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  )
}
