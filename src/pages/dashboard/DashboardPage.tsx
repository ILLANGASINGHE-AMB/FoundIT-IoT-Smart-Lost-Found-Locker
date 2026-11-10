import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, MapPin, PackageSearch, Phone } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Skeleton } from '../../components/ui'
import type { CollectionPoint } from '../../types'

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

export function DashboardPage() {
  return (
    <div className="page">
      <DashboardHero />
      <CollectionPointsSection />
    </div>
  )
}
