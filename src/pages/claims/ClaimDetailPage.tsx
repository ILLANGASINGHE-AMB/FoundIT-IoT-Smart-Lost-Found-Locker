import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, CheckCircle2, KeyRound, MapPin, PackageCheck, XCircle } from 'lucide-react'
import { cancelClaim, getClaimById } from '../../services/claims'
import { formatDate, formatDateTime } from '../../lib/format'
import { ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { ClaimStatusBadge, ClaimTimeline } from '../../components/claims/ClaimStatus'
import { ClaimVerification } from '../../components/claims/ClaimVerification'
import { CredentialRecoveryModal } from '../../components/claims/CredentialRecoveryModal'

const VERIFICATION_LABEL = {
  PRIVATE_ATTRIBUTE: 'Private ownership detail',
  CLAIM_CODE: 'Claim credential',
  IDENTIFIER: 'Identifier',
  ADMIN_REVIEW: 'Administrator review',
} as const

/** /claims/:id — status timeline, verification steps, collection details. */
export function ClaimDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [recovering, setRecovering] = useState(false)
  const query = useQuery({ queryKey: ['claim', id], queryFn: () => getClaimById(id) })

  const cancel = useMutation({
    mutationFn: () => cancelClaim(id),
    onSuccess: () => {
      toast.success('Claim cancelled.')
      queryClient.invalidateQueries({ queryKey: ['claim', id] })
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  if (query.isLoading) {
    return (
      <div className="page page-narrow">
        <SkeletonList rows={3} height={120} />
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Claim" backTo="/claims" backLabel="My claims" />
        <ErrorState message={query.error?.message ?? 'Claim not found.'} />
      </div>
    )
  }

  const claim = query.data
  const verifications = [...claim.claim_verifications].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const collection = claim.collections[0]
  const canCancel = ['PENDING', 'UNDER_REVIEW'].includes(claim.status)

  return (
    <div className="page page-narrow">
      <PageHeader
        backTo="/claims"
        backLabel="My claims"
        title={claim.lost_item?.title ?? 'Claim'}
        description={
          <span className="row">
            <ClaimStatusBadge claim={claim} />
            <span>Submitted {formatDateTime(claim.submitted_at)}</span>
          </span>
        }
        actions={
          canCancel && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={cancel.isPending}
              onClick={() => window.confirm('Withdraw this claim?') && cancel.mutate()}
            >
              <Ban size={16} /> Withdraw claim
            </button>
          )
        }
      />

      {claim.status === 'PENDING' && (
        <section className="card stack">
          <h2 className="card-title">Verify your ownership</h2>
          <ClaimVerification claim={claim} />
        </section>
      )}

      {claim.status === 'APPROVED' && (
        <section className="card stack ready-card">
          <h2 className="card-title">
            <PackageCheck size={18} /> Ready for collection
          </h2>
          {claim.collection_point ? (
            <p>
              Collect your item at <strong>{claim.collection_point.name}</strong>
              {claim.collection_point.address && <> — {claim.collection_point.address}</>}.
              {claim.collection_point.description && <span className="muted"> {claim.collection_point.description}</span>}
            </p>
          ) : (
            <p>An administrator will tell you where to collect your item.</p>
          )}
          <p className="small">
            <KeyRound size={13} /> Bring your claim credential — staff will ask for it before handing the item over.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRecovering(true)}>
            Lost your credential? Recover it
          </button>
        </section>
      )}

      {claim.status === 'COMPLETED' && collection && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>
            Collected on {formatDateTime(collection.collected_at)}. Your case is closed — thanks for using FoundIT!
          </span>
        </div>
      )}

      {claim.status === 'REJECTED' && (
        <div className="alert alert-error">
          <XCircle size={18} />
          <span>
            This claim was rejected{claim.rejection_reason ? `: ${claim.rejection_reason}` : '.'} Your lost report stays
            open for new matches.
          </span>
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Progress</h2>
          <ClaimTimeline claim={claim} />
        </section>

        <section className="card stack">
          <h2 className="card-title">Item</h2>
          <dl className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <dt>Your report</dt>
              <dd>
                {claim.lost_item ? <Link to={`/lost/${claim.lost_item.id}`}>{claim.lost_item.title}</Link> : '—'}
              </dd>
            </div>
            <div>
              <dt>Found item</dt>
              <dd>
                {claim.found_item ? (
                  <Link to={`/found/${claim.found_item.id}`}>{claim.found_item.title}</Link>
                ) : (
                  '—'
                )}
                {claim.found_item && (
                  <span className="muted small">
                    {' '}
                    · found {formatDate(claim.found_item.date_found)}
                  </span>
                )}
              </dd>
            </div>
            {claim.collection_point && (
              <div>
                <dt>Collection point</dt>
                <dd>
                  <MapPin size={13} /> {claim.collection_point.name}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {verifications.length > 0 && (
        <section className="card">
          <h2 className="card-title">Verification results</h2>
          <ul className="verification-list">
            {verifications.map((v) => (
              <li key={v.id}>
                {v.result === 'PASSED' ? (
                  <CheckCircle2 size={16} color="var(--color-success)" />
                ) : (
                  <XCircle size={16} color="var(--color-danger)" />
                )}
                <span>
                  <strong>{VERIFICATION_LABEL[v.verification_type]}</strong> — {v.result === 'PASSED' ? 'passed' : 'failed'}
                  <span className="muted small"> · {formatDateTime(v.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recovering && claim.lost_item && (
        <CredentialRecoveryModal
          lostItemId={claim.lost_item.id}
          itemTitle={claim.lost_item.title}
          onClose={() => setRecovering(false)}
        />
      )}
    </div>
  )
}
