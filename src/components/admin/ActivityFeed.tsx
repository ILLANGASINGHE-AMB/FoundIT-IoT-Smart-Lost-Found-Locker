import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAuditLogs } from '../../services/admin'
import { timeAgo } from '../../lib/format'
import { SkeletonList } from '../ui'

const ACTION_LABELS: Record<string, string> = {
  CREATED_LOST_ITEM: 'reported a lost item',
  CREATED_FOUND_ITEM: 'reported a found item',
  MATCH_CANDIDATES_CREATED: 'matching created new candidates',
  DISMISSED_MATCH: 'dismissed a match',
  SUBMITTED_CLAIM: 'submitted a claim',
  VERIFIED_CLAIM: 'verified a claim',
  CANCELLED_CLAIM: 'cancelled a claim',
  APPROVED_CLAIM: 'approved a claim',
  REJECTED_CLAIM: 'rejected a claim',
  COMPLETED_COLLECTION: 'released an item to its owner',
  LOCKED_CLAIM_ATTEMPTS: 'locked a claim after failed attempts',
  RECOVERED_CLAIM_CREDENTIAL: 'recovered a claim credential',
  FAILED_CREDENTIAL_RECOVERY: 'failed a credential recovery',
  EXPIRED_UNCLAIMED_ITEM: 'expired an unclaimed item',
  UPDATED_USER_ROLE: 'changed a user’s role',
  ADMIN_SET_ITEM_STATUS: 'changed an item’s status',
  QR_SCAN_SCAN: 'scanned a FoundIT Box QR code',
  QR_SCAN_STORE: 'chose “store an item” at a FoundIT Box',
  QR_SCAN_CLAIM: 'chose “claim an item” at a FoundIT Box',
}

const ALERT_ACTIONS = new Set(['LOCKED_CLAIM_ATTEMPTS', 'FAILED_CREDENTIAL_RECOVERY'])

/** Live audit-log feed (Supabase Realtime on audit_logs, admin RLS). */
export function ActivityFeed({ limit = 15 }: { limit?: number }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'activity', limit], queryFn: () => getAuditLogs(limit) })

  useEffect(() => {
    const channel = supabase
      .channel('admin-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'activity'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <section className="card stack">
      <div className="row-between">
        <h2 className="card-title" style={{ margin: 0 }}>
          <Activity size={16} /> Live activity
        </h2>
        <span className="live-dot" aria-label="Live">
          Live
        </span>
      </div>
      {query.isLoading && <SkeletonList rows={5} height={36} />}
      {query.data?.length === 0 && <p className="muted small">No activity yet.</p>}
      <ul className="activity-list">
        {query.data?.map((log) => (
          <li key={log.id} className={ALERT_ACTIONS.has(log.action) ? 'alert-row' : ''}>
            <span className="activity-text">
              <strong>{log.user?.full_name ?? (log.action.startsWith('QR_SCAN') ? 'A visitor' : 'System')}</strong>{' '}
              {ACTION_LABELS[log.action] ?? log.action.toLowerCase().replace(/_/g, ' ')}
            </span>
            <time className="muted small" dateTime={log.created_at}>
              {timeAgo(log.created_at)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
