import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '../ui'

/** KPI card for the admin dashboard. */
export function StatCard({
  label,
  value,
  icon,
  tone = 'stat-icon-orange',
  to,
  hint,
  loading,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: string
  to?: string
  hint?: string
  loading?: boolean
}) {
  const body = (
    <>
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-info">
        <span className="stat-value">{loading ? <Skeleton width={48} height={26} /> : value}</span>
        <span className="stat-label">{label}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </>
  )
  return to ? (
    <Link to={to} className="stat-card stat-card-link">
      {body}
    </Link>
  ) : (
    <div className="stat-card">{body}</div>
  )
}
