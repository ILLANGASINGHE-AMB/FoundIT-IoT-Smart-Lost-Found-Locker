import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PackagePlus, QrCode, Search } from 'lucide-react'
import { logQrScan } from '../../services/qr'
import { useAuth } from '../../hooks/useAuth'
import { friendlyError } from '../../lib/errors'
import { Skeleton } from '../../components/ui'
import { CollectionPointCard } from '../../components/qr/CollectionPointCard'
import { InstallPrompt } from '../../components/qr/InstallPrompt'

/**
 * /q/:slug — QR landing page for a FoundIT Box (spec §27.2). Public:
 * scanning works before login. The scan only decides where the user lands.
 */
export function QrLandingPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [busy, setBusy] = useState<'STORE' | 'CLAIM' | null>(null)

  const query = useQuery({
    queryKey: ['qr', slug],
    queryFn: () => logQrScan(slug, 'SCAN'),
    retry: false,
    staleTime: Infinity,
    meta: { silent: true },
  })

  const point = query.data

  const go = async (action: 'STORE' | 'CLAIM') => {
    if (!point) return
    setBusy(action)
    // Best-effort audit of the chosen branch; never blocks navigation.
    await logQrScan(slug, action).catch(() => undefined)
    if (action === 'STORE') {
      const params = new URLSearchParams({ collection_point_id: point.collection_point_id })
      if (point.location_id) params.set('location_id', point.location_id)
      navigate(`/found/new?${params}`)
    } else if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/q/${slug}`)}`)
    } else {
      navigate(`/claims?at=${point.collection_point_id}`)
    }
  }

  return (
    <div className="qr-landing">
      <header className="qr-landing-brand">
        <img src="/foundit-logo.png" alt="FoundIT" />
      </header>

      <main className="qr-landing-main">
        {query.isLoading && (
          <div className="stack">
            <Skeleton height={140} radius={20} />
            <Skeleton height={96} radius={20} />
            <Skeleton height={96} radius={20} />
          </div>
        )}

        {query.isError && (
          <div className="qr-inactive">
            <div className="empty-state-icon">
              <QrCode size={28} />
            </div>
            <h1>This QR code is no longer active</h1>
            <p className="muted">
              {/inactive|not recognised/i.test(friendlyError(query.error))
                ? 'This FoundIT Box may have moved or its code was replaced. Ask the staff nearby, or use the app directly.'
                : friendlyError(query.error)}
            </p>
            <Link to={isAuthenticated ? '/dashboard' : '/login'} className="btn btn-primary">
              Open FoundIT
            </Link>
          </div>
        )}

        {point && (
          <>
            <CollectionPointCard point={point} />
            <h2 className="qr-question">What would you like to do?</h2>
            <div className="qr-actions">
              <button type="button" className="qr-action qr-action-store" onClick={() => go('STORE')} disabled={busy !== null}>
                <PackagePlus size={32} />
                <span>
                  <strong>I found something</strong>
                  <small>Store an item in this box</small>
                </span>
              </button>
              <button type="button" className="qr-action qr-action-claim" onClick={() => go('CLAIM')} disabled={busy !== null}>
                <Search size={32} />
                <span>
                  <strong>I lost something</strong>
                  <small>Claim your item</small>
                </span>
              </button>
            </div>
            <p className="muted small qr-footnote">
              Scanning this code never approves a claim — you’ll still verify ownership with your private details and
              claim credential.
            </p>
            <InstallPrompt />
          </>
        )}
      </main>
    </div>
  )
}
