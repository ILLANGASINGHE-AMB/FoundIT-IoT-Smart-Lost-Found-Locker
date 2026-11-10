import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Lock,
  PackageCheck,
  PackageSearch,
  Sparkles,
  Users,
} from 'lucide-react'
import { getStats } from '../../services/admin'
import { ErrorState, PageHeader } from '../../components/ui'
import { StatCard } from '../../components/admin/StatCard'
import { ActivityFeed } from '../../components/admin/ActivityFeed'

/** /admin — headline stats, recovery-rate KPI and the live activity feed. */
export function AdminDashboardPage() {
  const { data: s, isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'stats'], queryFn: getStats })

  return (
    <div className="page">
      <PageHeader title="Admin Console" description="Everything happening across FoundIT, live." />
      {isError && <ErrorState message="Could not load stats." onRetry={() => refetch()} />}

      <section className="admin-kpi-row">
        <div className="card hero-kpi">
          <span className="hero-kpi-label">Recovery rate</span>
          <span className="hero-kpi-value">{isLoading ? '…' : `${s?.recovery_rate ?? 0}%`}</span>
          <span className="muted small">
            {s ? `${s.resolved_cases} of ${s.lost_items} lost reports returned to their owners` : 'Resolved ÷ active lost reports'}
          </span>
        </div>
        <div className="admin-attention">
          {s && s.locked_claims > 0 && (
            <Link to="/admin/claims?status=UNDER_REVIEW" className="alert alert-error">
              <Lock size={18} />
              <span>
                <strong>{s.locked_claims} locked claim(s)</strong> need manual review after failed verification attempts.
              </span>
            </Link>
          )}
          {s && s.pending_claims > 0 && (
            <Link to="/admin/claims" className="alert alert-warning">
              <ClipboardCheck size={18} />
              <span>
                <strong>{s.pending_claims} claim(s)</strong> awaiting verification or review.
              </span>
            </Link>
          )}
          {s && s.ready_for_collection > 0 && (
            <Link to="/admin/claims?status=APPROVED" className="alert alert-info">
              <PackageCheck size={18} />
              <span>
                <strong>{s.ready_for_collection} item(s)</strong> approved and waiting to be collected.
              </span>
            </Link>
          )}
          {s && s.locked_claims + s.pending_claims + s.ready_for_collection === 0 && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} />
              <span>Nothing needs your attention right now.</span>
            </div>
          )}
        </div>
      </section>

      <section className="admin-stats-grid">
        <StatCard loading={isLoading} label="Users" value={s?.users} icon={<Users size={22} />} tone="stat-icon-blue" to="/admin/users" />
        <StatCard loading={isLoading} label="Lost items" value={s?.lost_items} icon={<FileSearch size={22} />} to="/admin/items?tab=lost" />
        <StatCard loading={isLoading} label="Found items" value={s?.found_items} icon={<PackageSearch size={22} />} tone="stat-icon-green" to="/admin/items?tab=found" />
        <StatCard loading={isLoading} label="Open match candidates" value={s?.open_matches} icon={<Sparkles size={22} />} tone="stat-icon-purple" to="/admin/matches" />
        <StatCard loading={isLoading} label="Pending claims" value={s?.pending_claims} icon={<ClipboardCheck size={22} />} tone="stat-icon-orange" to="/admin/claims" />
        <StatCard loading={isLoading} label="Resolved cases" value={s?.resolved_cases} icon={<CheckCircle2 size={22} />} tone="stat-icon-green" />
        <StatCard loading={isLoading} label="Held in FoundIT Boxes" value={s?.items_in_storage} icon={<Archive size={22} />} tone="stat-icon-blue" />
        <StatCard
          loading={isLoading}
          label="Unclaimed (expired)"
          value={s?.unclaimed_expired}
          icon={<AlertTriangle size={22} />}
          tone="stat-icon-purple"
          to="/admin/items?tab=found&status=UNCLAIMED_EXPIRED"
        />
      </section>

      <ActivityFeed limit={15} />
    </div>
  )
}
