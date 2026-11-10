import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock, MapPin, Pencil } from 'lucide-react'
import { getFoundItemById } from '../../services/foundItems'
import { getItemImages } from '../../services/items'
import { useAuth } from '../../hooks/useAuth'
import { formatDate, formatDateTime } from '../../lib/format'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { StatusBadge } from '../../components/items/StatusBadge'
import { StatusTimeline } from '../../components/items/StatusTimeline'
import { ItemImageGallery } from '../../components/items/ItemImageGallery'
import { AddPhotos } from '../../components/items/AddPhotos'
import { IDENTIFIER_LABELS } from '../../components/items/itemSchemas'
import type { IdentifierType } from '../../types'

/** /found/:id — found report (finder, admin, or owner of a matched lost item). */
export function FoundItemDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()

  const itemQuery = useQuery({ queryKey: ['found-item', id], queryFn: () => getFoundItemById(id) })
  const imagesQuery = useQuery({
    queryKey: ['item-images', 'found', id],
    queryFn: () => getItemImages('found', id),
    staleTime: 30 * 60 * 1000,
  })

  if (itemQuery.isLoading) {
    return (
      <div className="page">
        <Skeleton height={40} width="50%" />
        <div className="item-detail-layout">
          <Skeleton height={320} radius={16} />
          <Skeleton height={320} radius={16} />
        </div>
      </div>
    )
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <div className="page">
        <PageHeader title="Found item" backTo="/found" backLabel="My found items" />
        <ErrorState message={itemQuery.error?.message ?? 'Report not found.'} />
      </div>
    )
  }

  const item = itemQuery.data
  const isFinder = item.finder_id === user?.id
  const editable = isFinder && ['FOUND', 'IN_STORAGE', 'MATCHED'].includes(item.status)

  return (
    <div className="page">
      <PageHeader
        backTo={isFinder ? '/found' : '/matches'}
        backLabel={isFinder ? 'My found items' : 'Back'}
        title={item.title}
        description={
          <span className="row">
            <StatusBadge status={item.status} />
            <span>Reported {formatDateTime(item.created_at)}</span>
          </span>
        }
        actions={
          editable && (
            <Link to={`/found/${item.id}/edit`} className="btn btn-secondary">
              <Pencil size={16} /> Edit
            </Link>
          )
        }
      />

      <div className="item-detail-layout">
        <div className="stack">
          <ItemImageGallery kind="found" itemId={item.id} canDelete={editable} />
          {editable && (
            <div className="card">
              <h2 className="card-title">Add photos</h2>
              <AddPhotos kind="found" itemId={item.id} existingCount={imagesQuery.data?.length ?? 0} />
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="card-title">Details</h2>
            <dl className="detail-grid">
              <div>
                <dt>Category</dt>
                <dd>{item.category?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Date found</dt>
                <dd>{formatDate(item.date_found)}</dd>
              </div>
              <div>
                <dt>Found at</dt>
                <dd>{item.location?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Colour</dt>
                <dd>{item.color || '—'}</dd>
              </div>
              <div>
                <dt>Brand</dt>
                <dd>{item.brand || '—'}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{item.model || '—'}</dd>
              </div>
              {item.identifier_type && (
                <div>
                  <dt>Identifier</dt>
                  <dd>
                    {IDENTIFIER_LABELS[item.identifier_type as IdentifierType] ?? item.identifier_type}{' '}
                    <span className="pill pill-gray">
                      <Lock size={11} /> on file
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            <div className="divider" style={{ margin: '16px 0' }} />
            <span className="field-label">Description</span>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{item.description}</p>
          </div>

          <div className="card">
            <h2 className="card-title">
              <MapPin size={16} /> Collection point
            </h2>
            {item.collection_point ? (
              <p>
                <strong>{item.collection_point.name}</strong>
                {item.collection_point.address && <span className="muted"> — {item.collection_point.address}</span>}
              </p>
            ) : (
              <p className="muted">
                {isFinder
                  ? 'Not handed in yet. Please drop the item at any FoundIT Box so the owner can collect it.'
                  : 'The finder has not handed this item in yet.'}
              </p>
            )}
            {item.retention_expires_at && isFinder && (
              <p className="field-hint" style={{ marginTop: 8 }}>
                Held until {formatDate(item.retention_expires_at)} if unclaimed.
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">Status</h2>
            <StatusTimeline kind="found" status={item.status} />
          </div>
        </div>
      </div>
    </div>
  )
}
