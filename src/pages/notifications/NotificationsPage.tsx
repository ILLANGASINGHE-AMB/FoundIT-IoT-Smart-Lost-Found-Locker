import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellOff, CheckCheck } from 'lucide-react'
import { getMyNotifications, markAllRead, markAsRead } from '../../services/notifications'
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { NotificationItem } from '../../components/notifications/NotificationItem'
import type { AppNotification, NotificationType } from '../../types'

const PAGE_SIZE = 20
const FILTERS: { value: NotificationType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'MATCH', label: 'Matches' },
  { value: 'CLAIM', label: 'Claims' },
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'SYSTEM', label: 'System' },
]

/** /notifications — full paginated list, live via Realtime (bell subscription). */
export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [type, setType] = useState<NotificationType | 'ALL'>('ALL')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)

  const query = useQuery({
    queryKey: ['notifications', 'list', { type, unreadOnly, page }],
    queryFn: () => getMyNotifications({ type, unreadOnly, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const open = async (n: AppNotification) => {
    if (!n.is_read) {
      await markAsRead(n.id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (n.link) navigate(n.link)
  }

  const total = query.data?.count ?? 0
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Notifications"
        description="Matches, claim decisions and collection updates."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            <CheckCheck size={16} /> Mark all as read
          </button>
        }
      />

      <div className="row-between">
        <div className="tabs" role="tablist" aria-label="Filter by type">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              className="tab"
              aria-selected={type === f.value}
              onClick={() => {
                setType(f.value)
                setPage(0)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="checkbox-row small">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked)
              setPage(0)
            }}
          />
          Unread only
        </label>
      </div>

      {query.isLoading && <SkeletonList rows={6} height={72} />}
      {query.isError && <ErrorState message="Could not load notifications." onRetry={() => query.refetch()} />}
      {query.data && query.data.rows.length === 0 && (
        <div className="card">
          <EmptyState icon={<BellOff size={26} />} title="No notifications" description="You’re all caught up." />
        </div>
      )}
      {query.data && query.data.rows.length > 0 && (
        <div className="card notification-list">
          {query.data.rows.map((n) => (
            <NotificationItem key={n.id} notification={n} onOpen={open} />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted small">
            Page {page + 1} of {lastPage + 1}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
