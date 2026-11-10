import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Info } from 'lucide-react'
import { getMatchById } from '../../services/matching'
import { getActiveClaimForMatch, submitClaim } from '../../services/claims'
import { friendlyError } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { ScoreRing } from '../../components/matching/ScoreRing'

/**
 * /claims/new/:matchId — confirm the item summary and open a claim, then
 * continue to verification on the claim page.
 */
export function SubmitClaimPage() {
  const { matchId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const match = useQuery({ queryKey: ['match', matchId], queryFn: () => getMatchById(matchId) })
  const existing = useQuery({
    queryKey: ['claim-for-match', matchId],
    queryFn: () => getActiveClaimForMatch(matchId),
  })

  if (existing.data) return <Navigate to={`/claims/${existing.data.id}`} replace />

  if (match.isLoading || existing.isLoading) {
    return (
      <div className="page page-narrow">
        <SkeletonList rows={3} height={90} />
      </div>
    )
  }

  if (match.isError || !match.data?.found_item || !match.data.lost_item) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Submit claim" backTo="/matches" backLabel="My matches" />
        <ErrorState message={match.error?.message ?? 'This match is not available.'} />
      </div>
    )
  }

  const m = match.data
  const start = async () => {
    setBusy(true)
    setError('')
    try {
      const claim = await submitClaim(matchId)
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      navigate(`/claims/${claim.id}`, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader backTo={`/matches/${matchId}`} backLabel="Back to match" title="Claim this item" />

      <section className="card stack">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <ScoreRing score={m.score} size={60} />
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              {m.found_item!.title}
            </h2>
            <p className="muted small">
              Found {formatDate(m.found_item!.date_found)} · {m.found_item!.location?.name}
              {m.found_item!.collection_point && ` · held at ${m.found_item!.collection_point.name}`}
            </p>
          </div>
        </div>
        <p className="small">
          Claiming as the owner of your lost report <strong>“{m.lost_item!.title}”</strong>.
        </p>
      </section>

      <section className="card stack">
        <h2 className="card-title">How claiming works</h2>
        <ol className="claim-steps">
          <li>
            <strong>Confirm a private detail</strong> — the private ownership information you recorded when you reported
            the item.
          </li>
          <li>
            <strong>Enter your claim credential</strong> — the <span className="mono">FND-…</span> code you were given.
          </li>
          <li>
            <strong>Admin review</strong> — staff compare your answers with the item itself.
          </li>
          <li>
            <strong>Collect</strong> — bring your claim credential to the FoundIT Box.
          </li>
        </ol>
        <div className="alert alert-info">
          <Info size={18} />
          <span>You have 5 verification attempts. After that the claim is locked for manual review.</span>
        </div>
        {m.status !== 'OPEN' && (
          <div className="alert alert-warning">
            <span>This match is no longer open for a new claim.</span>
          </div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
          </div>
        )}
        <button type="button" className="btn btn-primary" disabled={busy || m.status !== 'OPEN'} onClick={start}>
          <ClipboardCheck size={16} /> {busy ? 'Opening claim…' : 'Start verification'}
        </button>
      </section>
    </div>
  )
}
