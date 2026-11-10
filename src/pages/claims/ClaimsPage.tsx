import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ClipboardCheck, KeyRound, MapPin } from 'lucide-react'
import { getMyClaims, type ClaimWithItems } from '../../services/claims'
import { getMyMatches } from '../../services/matching'
import { useCollectionPoints } from '../../hooks/useLookups'
import { formatDate } from '../../lib/format'
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { ClaimStatusBadge } from '../../components/claims/ClaimStatus'
import { CredentialRecoveryModal } from '../../components/claims/CredentialRecoveryModal'
import { MatchCard } from '../../components/matching/MatchCard'
import type { ClaimStatus } from '../../types'

const FILTERS: { value: ClaimStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Awaiting verification' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Ready to collect' },
  { value: 'COMPLETED', label: 'Collected' },
  { value: 'REJECTED', label: 'Rejected' },
]

/**
 * /claims — the user's claims. Arriving from a QR scan (?at=<collection
 * point>) highlights claims and open matches held at that FoundIT Box.
 */
export function ClaimsPage() {
  const [params] = useSearchParams()
  const atPointId = params.get('at')
  const [status, setStatus] = useState<ClaimStatus | 'ALL'>('ALL')
  const [recovering, setRecovering] = useState<ClaimWithItems | null>(null)

  const claims = useQuery({ queryKey: ['claims', status], queryFn: () => getMyClaims(status) })
  const { data: points } = useCollectionPoints()
  const atPoint = points?.find((p) => p.id === atPointId)
  const matchesHere = useQuery({
    queryKey: ['matches', 'OPEN'],
    queryFn: () => getMyMatches('OPEN'),
    enabled: Boolean(atPointId),
  })
  const openHere = matchesHere.data?.filter((m) => m.found_item?.collection_point_id === atPointId) ?? []

  return (
    <div className="page">
      <PageHeader
        title="My Claims"
        description="Track your ownership claims from verification to collection."
        actions={
          <Link to="/matches" className="btn btn-secondary">
            View matches
          </Link>
        }
      />

      {atPointId && (
        <section className="card stack">
          <h2 className="card-title" style={{ margin: 0 }}>
            <MapPin size={16} /> At {atPoint?.name ?? 'this FoundIT Box'}
          </h2>
          {matchesHere.isLoading && <SkeletonList rows={1} height={96} />}
          {matchesHere.data && openHere.length === 0 && (
            <p className="muted small">
              None of your open matches are held at this box. Approved claims ready for collection here are listed below.
            </p>
          )}
          {openHere.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </section>
      )}

      <div className="tabs" role="tablist" aria-label="Filter claims">
        {FILTERS.map((f) => (
          <button key={f.value} role="tab" className="tab" aria-selected={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {claims.isLoading && <SkeletonList rows={3} height={96} />}
      {claims.isError && <ErrorState message="Could not load your claims." onRetry={() => claims.refetch()} />}
      {claims.data && claims.data.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<ClipboardCheck size={26} />}
            title="No claims yet"
            description="When one of your matches looks right, open it and choose “Start claim”."
            action={
              <Link to="/matches" className="btn btn-primary">
                Review matches
              </Link>
            }
          />
        </div>
      )}

      <div className="stack">
        {claims.data?.map((claim) => {
          const here = atPointId && claim.collection_point_id === atPointId
          const canRecover = ['PENDING', 'APPROVED'].includes(claim.status) && !claim.is_locked
          return (
            <article key={claim.id} className={`card claim-row ${here ? 'claim-row-here' : ''}`}>
              <div className="claim-row-main">
                <div className="row">
                  <ClaimStatusBadge claim={claim} />
                  {here && <span className="pill pill-orange">At this box</span>}
                </div>
                <h3>{claim.lost_item?.title ?? 'Lost item'}</h3>
                <p className="muted small">
                  Submitted {formatDate(claim.submitted_at)}
                  {claim.collection_point && (
                    <>
                      {' · '}
                      <MapPin size={12} /> {claim.collection_point.name}
                    </>
                  )}
                </p>
              </div>
              <div className="claim-row-actions">
                {canRecover && claim.lost_item && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecovering(claim)}>
                    <KeyRound size={14} /> Recover credential
                  </button>
                )}
                <Link to={`/claims/${claim.id}`} className="btn btn-secondary btn-sm">
                  {claim.status === 'PENDING' && !claim.is_locked ? 'Continue' : 'View'} <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          )
        })}
      </div>

      {recovering?.lost_item && (
        <CredentialRecoveryModal
          lostItemId={recovering.lost_item.id}
          itemTitle={recovering.lost_item.title}
          onClose={() => setRecovering(null)}
        />
      )}
    </div>
  )
}
