import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listClaims } from '../../services/admin'
import { formatDateTime } from '../../lib/format'
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { ClaimStatusBadge } from '../../components/claims/ClaimStatus'
import type { ClaimStatus } from '../../types'

const FILTERS: { value: ClaimStatus | 'ACTIVE' | 'ALL'; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ALL', label: 'All' },
]

/** /admin/claims — Pending → Under review → Approved / Rejected. */
export function AdminClaimsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as ClaimStatus | 'ACTIVE' | 'ALL' | null) ?? 'ACTIVE'
  const query = useQuery({ queryKey: ['admin', 'claims', status], queryFn: () => listClaims(status) })

  return (
    <div className="page">
      <PageHeader title="Claims Review" description="Verify ownership, approve or reject, and hand items over." />

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            className="tab"
            aria-selected={status === f.value}
            onClick={() => setParams({ status: f.value }, { replace: true })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading && <SkeletonList rows={6} height={56} />}
      {query.isError && <ErrorState message="Could not load claims." onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && (
        <div className="card">
          <EmptyState title="No claims here" description="Claims appear when owners start them from a match." />
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Claimant</th>
                <th>Status</th>
                <th>Collection point</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((c) => (
                <tr
                  key={c.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/claims/${c.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/claims/${c.id}`)}
                >
                  <td>
                    <strong>{c.lost_item?.title}</strong>
                    <div className="muted small">Found: {c.found_item?.title}</div>
                  </td>
                  <td className="small">
                    {c.claimant?.full_name}
                    <div className="muted">{c.claimant?.email}</div>
                  </td>
                  <td>
                    <ClaimStatusBadge claim={c} />
                  </td>
                  <td className="small">{c.collection_point?.name ?? '—'}</td>
                  <td className="small">{formatDateTime(c.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
