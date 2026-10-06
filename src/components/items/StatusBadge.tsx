export type ItemStatus =
  | 'LOST'
  | 'FOUND'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'UNCLAIMED_EXPIRED'
  | 'CLOSED';

type StatusBadgeProps = {
  status: ItemStatus;
};

const statusLabels: Record<ItemStatus, string> = {
  LOST: 'Lost',
  FOUND: 'Found',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
  UNCLAIMED_EXPIRED: 'Unclaimed expired',
  CLOSED: 'Closed',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`item-status-badge item-status-${status.toLowerCase()}`}>
      {statusLabels[status]}
    </span>
  );
}