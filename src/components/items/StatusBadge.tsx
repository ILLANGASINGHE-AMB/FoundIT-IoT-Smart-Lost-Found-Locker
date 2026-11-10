import type { ItemStatus } from '../../types'

const statusStyles: Record<ItemStatus, { label: string; tone: string }> = {
  LOST: { label: 'Lost', tone: 'pill-red' },
  MATCHED: { label: 'Possible match', tone: 'pill-purple' },
  FOUND: { label: 'Found', tone: 'pill-blue' },
  IN_STORAGE: { label: 'In FoundIT Box', tone: 'pill-blue' },
  CLAIM_PENDING: { label: 'Claim pending', tone: 'pill-yellow' },
  CLAIMED: { label: 'Ready to collect', tone: 'pill-orange' },
  RESOLVED: { label: 'Resolved', tone: 'pill-green' },
  RETURNED: { label: 'Returned', tone: 'pill-green' },
  CANCELLED: { label: 'Cancelled', tone: 'pill-gray' },
  CLOSED: { label: 'Closed', tone: 'pill-gray' },
  UNCLAIMED_EXPIRED: { label: 'Unclaimed (expired)', tone: 'pill-gray' },
}

/** Color-coded pill for item statuses. */
export function StatusBadge({ status }: { status: ItemStatus }) {
  const style = statusStyles[status] ?? { label: status, tone: 'pill-gray' }
  return <span className={`pill ${style.tone}`}>{style.label}</span>
}
