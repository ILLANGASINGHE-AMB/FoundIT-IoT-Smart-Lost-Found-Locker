import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, ClipboardCheck, ThumbsDown } from 'lucide-react'
import { listMatches, setMatchStatus } from '../../services/admin'
import { submitClaim } from '../../services/claims'
import { dismissMatch } from '../../services/matching'
import { formatDate } from '../../lib/format'
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { ScoreRing } from '../../components/matching/ScoreRing'
import { ScoreBreakdown } from '../../components/matching/ScoreBreakdown'
import { SemanticBadge } from '../../components/matching/SemanticBadge'
import type { MatchStatus } from '../../types'

/** /admin/matches — review candidates; dismiss, convert to claim, override status. */
export function AdminMatchesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<MatchStatus | 'ALL'>('OPEN')
  const [minScore, setMinScore] = useState(40)
  const [expanded, setExpanded] = useState<string | null>(null)

  const query = useQuery({ queryKey: ['admin', 'matches', status, minScore], queryFn: () => listMatches(status, minScore) })

  const update = useMutation({
    // Dismissing an OPEN candidate goes through dismiss_match() so item
    // statuses roll back; other overrides are direct admin updates.
    mutationFn: ({ id, next, from }: { id: string; next: MatchStatus; from: MatchStatus }) =>
      next === 'DISMISSED' && from === 'OPEN' ? dismissMatch(id) : setMatchStatus(id, next),
    onSuccess: () => {
      toast.success('Match updated.')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  const convert = useMutation({
    mutationFn: (id: string) => submitClaim(id),
    onSuccess: (claim) => {
      toast.success('Claim opened on the owner’s behalf.')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      navigate(`/admin/claims/${claim.id}`)
    },
  })

  return (
    <div className="page">
      <PageHeader title="Match Review" description="Every candidate the engine produced, with the reasoning behind its score." />

      <div className="row-between">
        <div className="tabs" role="tablist">
          {(['OPEN', 'CONVERTED_TO_CLAIM', 'DISMISSED', 'ALL'] as const).map((s) => (
            <button key={s} role="tab" className="tab" aria-selected={status === s} onClick={() => setStatus(s)}>
              {s === 'CONVERTED_TO_CLAIM' ? 'Claimed' : s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <label className="row small">
          Min score
          <select className="select" style={{ width: 100 }} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
            {[0, 40, 60, 80].map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading && <SkeletonList rows={5} height={88} />}
      {query.isError && <ErrorState message="Could not load matches." onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && (
        <div className="card">
          <EmptyState title="No candidates" description="Nothing matches these filters." />
        </div>
      )}

      <div className="stack">
        {query.data?.map((m) => {
          const isOpen = expanded === m.id
          return (
            <article key={m.id} className="card stack">
              <div className="admin-match-row">
                <ScoreRing score={m.score} size={56} />
                <div className="admin-match-items">
                  <div>
                    <span className="muted small">Lost</span>
                    <strong>{m.lost_item?.title}</strong>
                    <span className="muted small">
                      {formatDate(m.lost_item?.date_lost)} · {m.lost_item?.location?.name}
                    </span>
                  </div>
                  <div>
                    <span className="muted small">Found</span>
                    <strong>{m.found_item?.title}</strong>
                    <span className="muted small">
                      {formatDate(m.found_item?.date_found)} · {m.found_item?.location?.name}
                    </span>
                  </div>
                </div>
                <div className="admin-match-actions">
                  <SemanticBadge breakdown={m.score_breakdown} />
                  {m.status === 'OPEN' ? (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" disabled={convert.isPending} onClick={() => convert.mutate(m.id)}>
                        <ClipboardCheck size={14} /> Convert to claim
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: m.id, next: 'DISMISSED', from: m.status })}
                      >
                        <ThumbsDown size={14} /> Dismiss
                      </button>
                    </>
                  ) : (
                    <select
                      className="select"
                      value={m.status}
                      aria-label="Override status"
                      onChange={(e) => update.mutate({ id: m.id, next: e.target.value as MatchStatus, from: m.status })}
                    >
                      <option value="OPEN">Open</option>
                      <option value="DISMISSED">Dismissed</option>
                      <option value="CONVERTED_TO_CLAIM">Converted to claim</option>
                    </select>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Breakdown
                  </button>
                </div>
              </div>
              {isOpen && m.lost_item && m.found_item && (
                <ScoreBreakdown breakdown={m.score_breakdown} lost={m.lost_item} found={m.found_item} />
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
