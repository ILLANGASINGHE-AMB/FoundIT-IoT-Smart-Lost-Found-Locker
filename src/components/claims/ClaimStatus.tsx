import { Check, Lock, X } from 'lucide-react'
import type { Claim, ClaimStatus } from '../../types'

const STATUS: Record<ClaimStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Awaiting verification', tone: 'pill-yellow' },
  UNDER_REVIEW: { label: 'Under review', tone: 'pill-blue' },
  APPROVED: { label: 'Approved — ready to collect', tone: 'pill-orange' },
  REJECTED: { label: 'Rejected', tone: 'pill-red' },
  CANCELLED: { label: 'Cancelled', tone: 'pill-gray' },
  COMPLETED: { label: 'Collected', tone: 'pill-green' },
}

export function ClaimStatusBadge({ claim }: { claim: Pick<Claim, 'status' | 'is_locked'> }) {
  if (claim.is_locked) {
    return (
      <span className="pill pill-red">
        <Lock size={11} /> Locked for review
      </span>
    )
  }
  const s = STATUS[claim.status]
  return <span className={`pill ${s.tone}`}>{s.label}</span>
}

const STEPS: { key: string; label: string; reached: (c: Claim) => string | null }[] = [
  { key: 'submitted', label: 'Submitted', reached: (c) => c.submitted_at },
  {
    key: 'review',
    label: 'Verified — under review',
    reached: (c) => (['UNDER_REVIEW', 'APPROVED', 'COMPLETED'].includes(c.status) ? c.reviewed_at ?? c.updated_at : null),
  },
  { key: 'approved', label: 'Approved', reached: (c) => c.approved_at },
  { key: 'collected', label: 'Collected', reached: (c) => c.completed_at },
]

/** Submitted → Under Review → Approved → Collected. */
export function ClaimTimeline({ claim }: { claim: Claim }) {
  if (claim.status === 'REJECTED' || claim.status === 'CANCELLED') {
    return (
      <ol className="timeline">
        <li className="done">
          <span className="timeline-dot">
            <Check size={12} />
          </span>
          Submitted
        </li>
        <li className="current">
          <span className="timeline-dot">
            <X size={12} />
          </span>
          {claim.status === 'REJECTED' ? 'Rejected' : 'Cancelled'}
          {claim.rejection_reason && <span className="muted"> — {claim.rejection_reason}</span>}
        </li>
      </ol>
    )
  }

  const reachedCount = STEPS.filter((s) => s.reached(claim)).length
  return (
    <ol className="timeline">
      {STEPS.map((step, i) => {
        const done = i < reachedCount
        const current = i === reachedCount
        return (
          <li key={step.key} className={done ? 'done' : current ? 'current' : ''}>
            <span className="timeline-dot">{done && <Check size={12} />}</span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
