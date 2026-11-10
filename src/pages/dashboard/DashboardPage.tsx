import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  FileSearch,
  MapPin,
  PackageCheck,
  PackageSearch,
  Phone,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRecentNotifications } from '../../hooks/useNotifications'
import { supabase } from '../../lib/supabase'
import { markAsRead } from '../../services/notifications'
import { EmptyState, Skeleton } from '../../components/ui'
import { NotificationItem } from '../../components/notifications/NotificationItem'
import type { AppNotification, CollectionPoint } from '../../types'

interface UserStats {
  lost_items: number
  found_items: number
  open_matches: number
  active_claims: number
  ready_to_collect: number
  unread_notifications: number
}

function useUserStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('user_dashboard_stats')
      if (error) throw new Error('Could not load your summary.')
      return data as UserStats
    },
  })
}

function useCollectionPoints() {
  return useQuery({
    queryKey: ['collection-points', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_points')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('name')
      if (error) throw error
      return data as CollectionPoint[]
    },
  })
}

export function DashboardHero() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const firstName = profile?.full_name.split(' ')[0] || 'there'

  return (
    <section className="dashboard-hero" id="dashboard-hero-section">
      <div className="hero-bg-image">
        <img src="/dashboard-bg.jpg" alt="" className="hero-bg" />
        <div className="hero-bg-overlay" />
      </div>
      <div className="hero-content">
        <div className="hero-text-block">
          <h1 className="hero-title">
            Welcome, <span className="hero-highlight">{firstName}</span>
            <br />
            Find &amp; Recover With Ease
          </h1>
          <p className="hero-description">
            {isAdmin
              ? 'You are signed in as an administrator. Review claims, matches and collection points from the Admin Console.'
              : 'Lost something? Report it and we’ll match it against everything handed in. Found something? Report it so the owner can get it back.'}
          </p>
        </div>
        <div className="hero-actions">
          <button className="hero-btn hero-btn-report" onClick={() => navigate('/lost/new')}>
            <AlertTriangle size={20} />
            Report Lost
          </button>
          <button className="hero-btn hero-btn-found" onClick={() => navigate('/found/new')}>
            <PackageSearch size={20} />
            Report Found
          </button>
        </div>
      </div>
    </section>
  )
}

export function CollectionPointsSection() {
  const { data: points, isLoading } = useCollectionPoints()

  return (
    <section className="dashboard-branches" id="branches-section">
      <div className="section-header">
        <h2 className="section-title">FoundIT Boxes</h2>
        <p className="section-caption">Hand in found items or collect yours at any of these collection points</p>
      </div>

      <div className="branches-grid">
        {isLoading &&
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={88} radius={16} />)}
        {points?.map((point) => (
          <div key={point.id} className="branch-card">
            <div className="branch-icon-wrap">
              <MapPin size={20} />
            </div>
            <div className="branch-info">
              <span className="branch-name">{point.name}</span>
              <span className="branch-address">{point.address || 'On campus'}</span>
              {point.description && (
                <span className="branch-hours">
                  <Clock size={12} />
                  {point.description}
                </span>
              )}
            </div>
            <div className="branch-right">
              <span className="branch-status status-open">Open</span>
              {point.contact && (
                <a className="branch-call-btn" href={`mailto:${point.contact}`} title={`Contact ${point.name}`}>
                  <Phone size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
        {points && points.length === 0 && <p className="muted">No collection points have been set up yet.</p>}
      </div>
    </section>
  )
}

function SummaryCards() {
  const { data: stats, isLoading } = useUserStats()
  const cards = [
    { to: '/lost', label: 'Lost Items', value: stats?.lost_items, icon: <FileSearch size={22} />, tone: 'stat-icon-orange' },
    { to: '/matches', label: 'Open Matches', value: stats?.open_matches, icon: <Sparkles size={22} />, tone: 'stat-icon-purple' },
    { to: '/claims', label: 'Active Claims', value: stats?.active_claims, icon: <ClipboardCheck size={22} />, tone: 'stat-icon-blue' },
    { to: '/found', label: 'Items You Found', value: stats?.found_items, icon: <PackageSearch size={22} />, tone: 'stat-icon-green' },
  ]

  return (
    <>
      {stats && stats.ready_to_collect > 0 && (
        <Link to="/claims" className="alert alert-success ready-banner">
          <PackageCheck size={18} />
          <span>
            <strong>{stats.ready_to_collect} item(s) ready for collection!</strong> Bring your claim credential to the
            FoundIT Box.
          </span>
        </Link>
      )}
      <section className="dashboard-stats" aria-label="Your summary">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="stat-card stat-card-link">
            <div className={`stat-icon ${c.tone}`}>{c.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{isLoading ? <Skeleton width={36} height={24} /> : (c.value ?? 0)}</span>
              <span className="stat-label">{c.label}</span>
            </div>
          </Link>
        ))}
      </section>
    </>
  )
}

function RecentNotifications() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading } = useRecentNotifications(5)

  const open = async (n: AppNotification) => {
    if (!n.is_read) {
      await markAsRead(n.id).catch(() => undefined)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (n.link) navigate(n.link)
  }

  return (
    <section className="stack">
      <div className="row-between">
        <div className="section-header">
          <h2 className="section-title">Recent Notifications</h2>
          <p className="section-caption">Stay updated on your matches and claims</p>
        </div>
        <Link to="/notifications" className="btn btn-ghost btn-sm">
          View all
        </Link>
      </div>
      {isLoading && <Skeleton height={180} radius={16} />}
      {data && data.length === 0 && (
        <div className="card">
          <EmptyState title="Nothing yet" description="We’ll let you know here as soon as something happens." />
        </div>
      )}
      {data && data.length > 0 && (
        <div className="card notification-list">
          {data.map((n) => (
            <NotificationItem key={n.id} notification={n} onOpen={open} />
          ))}
        </div>
      )}
    </section>
  )
}

export function DashboardPage() {
  return (
    <div className="page">
      <DashboardHero />
      <SummaryCards />
      <RecentNotifications />
      <CollectionPointsSection />
    </div>
  )
}
