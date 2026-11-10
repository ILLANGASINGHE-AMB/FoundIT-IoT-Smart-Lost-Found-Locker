import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, Lock, PackageCheck, ShieldAlert, XCircle } from 'lucide-react'
import { getClaimForReview } from '../../services/admin'
import { approveClaim, completeCollection, rejectClaim } from '../../services/claims'
import { useAuth } from '../../hooks/useAuth'
import { useCollectionPoints } from '../../hooks/useLookups'
import { formatDate, formatDateTime } from '../../lib/format'
import { ErrorState, Modal, PageHeader, SkeletonList } from '../../components/ui'
import { ItemImageGallery } from '../../components/items/ItemImageGallery'
import { ClaimStatusBadge, ClaimTimeline } from '../../components/claims/ClaimStatus'
import { ScoreBreakdown } from '../../components/matching/ScoreBreakdown'

/**
 * /admin/claims/:id — side-by-side items, the owner's private detail vs the
 * claimant's answer, attempts log, and Approve / Reject / Complete actions.
 */
export function AdminClaimReviewPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { isCollectionOfficer } = useAuth()
  const { data: points } = useCollectionPoints()
  const query = useQuery({ queryKey: ['admin', 'claim', id], queryFn: () => getClaimForReview(id) })
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'collect' | null>(null)
  const [pointId, setPointId] = useState('')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [code, setCode] = useState('')
  const [override, setOverride] = useState('')
  const [useOverride, setUseOverride] = useState(false)

  const done = (message: string) => {
    toast.success(message)
    setDialog(null)
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const approve = useMutation({
    mutationFn: () => approveClaim(id, pointId || query.data?.collection_point_id, notes),
    onSuccess: () => done('Claim approved — the owner has been notified.'),
  })
  const reject = useMutation({
    mutationFn: () => rejectClaim(id, reason.trim()),
    onSuccess: () => done('Claim rejected.'),
  })
  const collect = useMutation({
    mutationFn: () =>
      completeCollection(id, useOverride ? { overrideReason: override.trim(), notes } : { claimCode: code.trim(), notes }),
    onSuccess: () => done('Item released. Case closed.'),
  })

  if (query.isLoading) {
    return (
      <div className="page">
        <SkeletonList rows={4} height={140} />
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="page">
        <PageHeader title="Claim review" backTo="/admin/claims" backLabel="All claims" />
        <ErrorState message={query.error?.message ?? 'Claim not found.'} />
      </div>
    )
  }

  const c = query.data
  const lost = c.lost_full
  const found = c.found_full
  const attempts = [...c.claim_attempts].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const verifications = [...c.claim_verifications].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const passed = (type: string) => verifications.some((v) => v.verification_type === type && v.result === 'PASSED')
  const canDecide = ['PENDING', 'UNDER_REVIEW'].includes(c.status)

  return (
    <div className="page">
      <PageHeader
        backTo="/admin/claims"
        backLabel="All claims"
        title={`Claim: ${lost?.title ?? 'item'}`}
        description={
          <span className="row">
            <ClaimStatusBadge claim={c} />
            <span>
              by {c.claimant?.full_name} ({c.claimant?.email}) · {formatDateTime(c.submitted_at)}
            </span>
          </span>
        }
        actions={
          <>
            {canDecide && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setDialog('approve')}>
                  <CheckCircle2 size={16} /> Approve
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setDialog('reject')}>
                  <XCircle size={16} /> Reject
                </button>
              </>
            )}
            {c.status === 'APPROVED' && (
              <>
                {isCollectionOfficer && (
                  <button type="button" className="btn btn-primary" onClick={() => setDialog('collect')}>
                    <PackageCheck size={16} /> Complete collection
                  </button>
                )}
                <button type="button" className="btn btn-danger" onClick={() => setDialog('reject')}>
                  <XCircle size={16} /> Revoke approval
                </button>
              </>
            )}
          </>
        }
      />

      {c.is_locked && (
        <div className="alert alert-error">
          <Lock size={18} />
          <span>
            Locked after repeated failed verification attempts. Contact the claimant before deciding.
          </span>
        </div>
      )}
      {canDecide && !(passed('PRIVATE_ATTRIBUTE') && passed('CLAIM_CODE')) && (
        <div className="alert alert-warning">
          <ShieldAlert size={18} />
          <span>The claimant has not completed both verification steps yet. Approve only if you verified ownership another way.</span>
        </div>
      )}

      <div className="grid-2">
        <section className="card stack">
          <h2 className="card-title">Lost report (claimant)</h2>
          {lost && <ItemImageGallery kind="lost" itemId={lost.id} />}
          <strong>{lost?.title}</strong>
          <p className="muted small">
            {lost?.category?.name} · lost {formatDate(lost?.date_lost)} · {lost?.location?.name}
          </p>
          <p>{lost?.description}</p>
        </section>
        <section className="card stack">
          <h2 className="card-title">Found item</h2>
          {found && <ItemImageGallery kind="found" itemId={found.id} />}
          <strong>{found?.title}</strong>
          <p className="muted small">
            {found?.category?.name} · found {formatDate(found?.date_found)} · {found?.location?.name}
          </p>
          <p>{found?.description}</p>
          {found && (
            <Link to={`/found/${found.id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
              Open found report
            </Link>
          )}
        </section>
      </div>

      <section className="card stack">
        <h2 className="card-title">Ownership evidence</h2>
        <div className="grid-2">
          <div className="private-field">
            <span className="field-label">Private detail recorded at report time</span>
            <p>{lost?.private || <span className="muted">None recorded</span>}</p>
          </div>
          <div className="card-subtle">
            <span className="field-label">Claimant’s answer during verification</span>
            <p>{c.private_attribute_answer || <span className="muted">Not answered yet</span>}</p>
          </div>
        </div>
        <p className="muted small">Compare both with the physical item before approving (spec: matching ≠ ownership).</p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Progress</h2>
          <ClaimTimeline claim={c} />
          {c.collection_point && (
            <p className="small" style={{ marginTop: 12 }}>
              Collection point: <strong>{c.collection_point.name}</strong>
            </p>
          )}
        </section>
        <section className="card stack">
          <h2 className="card-title">Verification log</h2>
          {verifications.length === 0 && attempts.length === 0 && <p className="muted small">No attempts yet.</p>}
          <ul className="verification-list">
            {verifications.map((v) => (
              <li key={v.id}>
                {v.result === 'PASSED' ? <CheckCircle2 size={16} color="var(--color-success)" /> : <XCircle size={16} color="var(--color-danger)" />}
                <span>
                  <strong>{v.verification_type.replace(/_/g, ' ').toLowerCase()}</strong> — {v.result.toLowerCase()}
                  {v.notes && <span className="muted small"> · {v.notes}</span>}
                </span>
              </li>
            ))}
          </ul>
          {attempts.length > 0 && (
            <details>
              <summary className="small">{attempts.length} verification attempt(s)</summary>
              <ul className="attempt-log">
                {attempts.map((a) => (
                  <li key={a.id} className="small">
                    <span className={`pill ${a.result === 'PASSED' ? 'pill-green' : 'pill-red'}`}>{a.result}</span>{' '}
                    {a.attempt_type.replace(/_/g, ' ').toLowerCase()} · {formatDateTime(a.created_at)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      {c.match && lost && found && (
        <section className="stack">
          <h2 className="card-title">Match score — {Math.round(c.match.score)}%</h2>
          <ScoreBreakdown breakdown={c.match.score_breakdown} lost={lost} found={found} />
        </section>
      )}

      {dialog === 'approve' && (
        <Modal
          title="Approve claim"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
                Approve & notify owner
              </button>
            </>
          }
        >
          <div className="form">
            <div className="field">
              <label htmlFor="approve-point">Collect at</label>
              <select
                id="approve-point"
                className="select"
                value={pointId || c.collection_point_id || ''}
                onChange={(e) => setPointId(e.target.value)}
              >
                <option value="">Choose a collection point</option>
                {points?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="approve-notes">Review notes (optional)</label>
              <textarea id="approve-notes" className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="muted small">Other pending claims for this found item will be rejected automatically.</p>
          </div>
        </Modal>
      )}

      {dialog === 'reject' && (
        <Modal
          title={c.status === 'APPROVED' ? 'Revoke approval' : 'Reject claim'}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" disabled={reject.isPending || reason.trim().length < 5} onClick={() => reject.mutate()}>
                Reject claim
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="reject-reason">Reason (shared with the claimant)</label>
            <textarea id="reject-reason" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Modal>
      )}

      {dialog === 'collect' && (
        <Modal
          title="Complete collection"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={collect.isPending || (useOverride ? override.trim().length < 5 : code.trim().length < 15)}
                onClick={() => collect.mutate()}
              >
                Release item
              </button>
            </>
          }
        >
          <div className="form">
            {!useOverride ? (
              <div className="field">
                <label htmlFor="collect-code">
                  <KeyRound size={14} /> Claimant’s claim credential
                </label>
                <input
                  id="collect-code"
                  className="input mono credential-input"
                  placeholder="FND-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="collect-override">How did you verify the claimant’s identity?</label>
                <textarea
                  id="collect-override"
                  className="textarea"
                  rows={3}
                  placeholder="e.g. checked student ID 2021/T/123 against the account name"
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                />
              </div>
            )}
            <label className="checkbox-row small">
              <input type="checkbox" checked={useOverride} onChange={(e) => setUseOverride(e.target.checked)} />
              The claimant can’t present their credential — verify identity manually (audited)
            </label>
            <div className="field">
              <label htmlFor="collect-notes">Notes (optional)</label>
              <input id="collect-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
