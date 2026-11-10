import { Check } from 'lucide-react'
import type { FoundItemStatus, LostItemStatus } from '../../types'

const LOST_FLOW: { status: LostItemStatus; label: string }[] = [
  { status: 'LOST', label: 'Reported lost' },
  { status: 'MATCHED', label: 'Possible match found' },
  { status: 'CLAIM_PENDING', label: 'Claim submitted' },
  { status: 'CLAIMED', label: 'Claim approved — ready to collect' },
  { status: 'RESOLVED', label: 'Collected' },
]

const FOUND_FLOW: { status: FoundItemStatus; label: string }[] = [
  { status: 'FOUND', label: 'Reported found' },
  { status: 'IN_STORAGE', label: 'Stored at a FoundIT Box' },
  { status: 'MATCHED', label: 'Possible owner identified' },
  { status: 'CLAIM_PENDING', label: 'Owner claim under review' },
  { status: 'CLAIMED', label: 'Claim approved' },
  { status: 'RETURNED', label: 'Returned to owner' },
]

const TERMINAL: Record<string, string> = {
  CANCELLED: 'Report cancelled',
  CLOSED: 'Report closed',
  UNCLAIMED_EXPIRED: 'Retention period ended — unclaimed',
}

/** Vertical status timeline for an item report. */
export function StatusTimeline({ kind, status }: { kind: 'lost' | 'found'; status: string }) {
  const flow: { status: string; label: string }[] = kind === 'lost' ? LOST_FLOW : FOUND_FLOW

  if (TERMINAL[status]) {
    return (
      <ol className="timeline">
        <li className="done">
          <span className="timeline-dot">
            <Check size={12} />
          </span>
          Reported
        </li>
        <li className="current">
          <span className="timeline-dot" />
          {TERMINAL[status]}
        </li>
      </ol>
    )
  }

  const currentIndex = Math.max(0, flow.findIndex((s) => s.status === status))
  return (
    <ol className="timeline">
      {flow.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : ''
        const isFinal = i === flow.length - 1 && i === currentIndex
        return (
          <li key={step.status} className={isFinal ? 'done' : state}>
            <span className="timeline-dot">{(state === 'done' || isFinal) && <Check size={12} />}</span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
