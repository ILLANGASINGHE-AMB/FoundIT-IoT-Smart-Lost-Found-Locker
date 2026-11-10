import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CheckCircle2, Clock, FileSearch, PackageSearch, Sparkles, TimerOff } from 'lucide-react'
import { getAnalytics } from '../../services/admin'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { StatCard } from '../../components/admin/StatCard'
import { AnalyticsChart, CHART_COLORS, axisProps } from '../../components/admin/AnalyticsChart'

const CLAIM_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting verification',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Collected',
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })

const tooltipProps = {
  cursor: { fill: 'rgba(15, 23, 42, 0.04)', stroke: '#cbd5e1' },
  contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,.08)', fontSize: 13 },
  labelStyle: { color: '#1e293b', fontWeight: 700 },
} as const

/** /admin/analytics — KPIs and Recharts charts over a selectable window. */
export function AdminAnalyticsPage() {
  const [months, setMonths] = useState(6)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics', months],
    queryFn: () => getAnalytics(months),
  })

  const monthly = (data?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }))
  const claimStatus = [...(data?.claim_status ?? [])]
    .map((c) => ({ ...c, label: CLAIM_STATUS_LABEL[c.status] ?? c.status }))
    .sort((a, b) => b.count - a.count)
  const byLocation = (data?.by_location ?? []).slice(0, 10)
  const k = data?.kpis

  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        description="Trends across lost and found reports, matches and recoveries."
        actions={
          <div className="tabs" role="tablist" aria-label="Time range">
            {[3, 6, 12].map((m) => (
              <button key={m} role="tab" className="tab" aria-selected={months === m} onClick={() => setMonths(m)}>
                {m} months
              </button>
            ))}
          </div>
        }
      />
      {isError && <ErrorState message="Could not load analytics." onRetry={() => refetch()} />}

      <section className="admin-stats-grid">
        <StatCard loading={isLoading} label="Total lost" value={k?.total_lost} icon={<FileSearch size={22} />} />
        <StatCard loading={isLoading} label="Total found" value={k?.total_found} icon={<PackageSearch size={22} />} tone="stat-icon-green" />
        <StatCard loading={isLoading} label="Lost items matched" value={k?.matched} icon={<Sparkles size={22} />} tone="stat-icon-purple" />
        <StatCard loading={isLoading} label="Recovered" value={k?.recovered} icon={<CheckCircle2 size={22} />} tone="stat-icon-green" />
        <StatCard
          loading={isLoading}
          label="Avg. time to recovery"
          value={k?.avg_recovery_hours != null ? `${k.avg_recovery_hours < 48 ? `${k.avg_recovery_hours} h` : `${(k.avg_recovery_hours / 24).toFixed(1)} d`}` : '—'}
          icon={<Clock size={22} />}
          tone="stat-icon-blue"
        />
        <StatCard
          loading={isLoading}
          label="Unclaimed expiry rate"
          value={`${k?.unclaimed_expiry_rate ?? 0}%`}
          icon={<TimerOff size={22} />}
          tone="stat-icon-purple"
        />
      </section>

      {isLoading ? (
        <div className="grid-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={340} radius={16} />
          ))}
        </div>
      ) : (
        <div className="grid-2 analytics-grid">
          <AnalyticsChart
            title="Lost vs found over time"
            description="Reports created per month"
            legend={[
              { label: 'Lost', color: CHART_COLORS.lost, shape: 'line' },
              { label: 'Found', color: CHART_COLORS.found, shape: 'line' },
            ]}
            rows={monthly}
            columns={[
              { key: 'label', label: 'Month' },
              { key: 'lost', label: 'Lost' },
              { key: 'found', label: 'Found' },
            ]}
          >
            <ResponsiveContainer>
              <LineChart data={monthly} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="lost" name="Lost" stroke={CHART_COLORS.lost} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="found" name="Found" stroke={CHART_COLORS.found} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </AnalyticsChart>

          <AnalyticsChart
            title="Monthly recovery rate"
            description="% of each month’s lost reports that were resolved"
            rows={monthly}
            columns={[
              { key: 'label', label: 'Month' },
              { key: 'recovery_rate', label: 'Recovery rate (%)' },
              { key: 'recovered', label: 'Collected' },
            ]}
          >
            <ResponsiveContainer>
              <LineChart data={monthly} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis domain={[0, 100]} unit="%" {...axisProps} />
                <Tooltip {...tooltipProps} formatter={(v) => [`${v}%`, 'Recovery rate']} />
                <Line type="monotone" dataKey="recovery_rate" name="Recovery rate" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </AnalyticsChart>

          <AnalyticsChart
            title="Items by category"
            description="Lost and found reports in the selected window"
            legend={[
              { label: 'Lost', color: CHART_COLORS.lost },
              { label: 'Found', color: CHART_COLORS.found },
            ]}
            rows={data?.by_category ?? []}
            columns={[
              { key: 'name', label: 'Category' },
              { key: 'lost', label: 'Lost' },
              { key: 'found', label: 'Found' },
            ]}
          >
            <ResponsiveContainer>
              <BarChart data={data?.by_category ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2}>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="lost" name="Lost" fill={CHART_COLORS.lost} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="found" name="Found" fill={CHART_COLORS.found} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChart>

          <AnalyticsChart
            title="Items by location"
            description="Top locations by total reports"
            rows={byLocation}
            columns={[
              { key: 'name', label: 'Location' },
              { key: 'total', label: 'Reports' },
            ]}
            height={Math.max(220, byLocation.length * 34)}
          >
            <ResponsiveContainer>
              <BarChart data={byLocation} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="total" name="Reports" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChart>

          <AnalyticsChart
            title="Claim status distribution"
            description="All claims, by current status"
            rows={claimStatus}
            columns={[
              { key: 'label', label: 'Status' },
              { key: 'count', label: 'Claims' },
            ]}
            height={Math.max(200, claimStatus.length * 40)}
          >
            <ResponsiveContainer>
              <BarChart data={claimStatus} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="label" width={150} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" name="Claims" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChart>
        </div>
      )}
    </div>
  )
}
