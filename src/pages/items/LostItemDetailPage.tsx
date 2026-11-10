import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, Lock, Pencil } from 'lucide-react'
import { cancelLostItem, getLostItemById, getLostItemPrivateInfo } from '../../services/lostItems'
import { getItemImages } from '../../services/items'
import { useAuth } from '../../hooks/useAuth'
import { formatDate, formatDateTime } from '../../lib/format'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { StatusBadge } from '../../components/items/StatusBadge'
import { StatusTimeline } from '../../components/items/StatusTimeline'
import { ItemImageGallery } from '../../components/items/ItemImageGallery'
import { AddPhotos } from '../../components/items/AddPhotos'
import { LostItemMatches } from '../../components/matching/LostItemMatches'
import { IDENTIFIER_LABELS } from '../../components/items/itemSchemas'
import type { IdentifierType } from '../../types'

/** /lost/:id — full report for its owner (private info included) or an admin. */
export function LostItemDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const itemQuery = useQuery({ queryKey: ['lost-item', id], queryFn: () => getLostItemById(id) })
  const privateQuery = useQuery({
    queryKey: ['lost-item-private', id],
    queryFn: () => getLostItemPrivateInfo(id),
    meta: { silent: true },
  })
  const imagesQuery = useQuery({
    queryKey: ['item-images', 'lost', id],
    queryFn: () => getItemImages('lost', id),
    staleTime: 30 * 60 * 1000,
  })

  const cancel = useMutation({
    mutationFn: () => cancelLostItem(id),
    onSuccess: () => {
      toast.success('Report cancelled.')
      queryClient.invalidateQueries({ queryKey: ['lost-item', id] })
      queryClient.invalidateQueries({ queryKey: ['lost-items'] })
    },
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
        <PageHeader title="Lost item" backTo="/lost" backLabel="My lost items" />
        <ErrorState message={itemQuery.error?.message ?? 'Report not found.'} />
      </div>
    )
  }

  const item = itemQuery.data
  const isOwner = item.user_id === user?.id
  const editable = isOwner && (item.status === 'LOST' || item.status === 'MATCHED')

  return (
    <div className="page">
      <PageHeader
        backTo="/lost"
        backLabel="My lost items"
        title={item.title}
        description={
          <span className="row">
            <StatusBadge status={item.status} />
            <span>Reported {formatDateTime(item.created_at)}</span>
          </span>
        }
        actions={
          editable && (
            <>
              <Link to={`/lost/${item.id}/edit`} className="btn btn-secondary">
                <Pencil size={16} /> Edit
              </Link>
              <button
                type="button"
                className="btn btn-danger"
                disabled={cancel.isPending}
                onClick={() =>
                  window.confirm('Cancel this lost report? Matching will stop and this cannot be undone.') &&
                  cancel.mutate()
                }
              >
                <Ban size={16} /> Cancel report
              </button>
            </>
          )
        }
      />

      <div className="item-detail-layout">
        <div className="stack">
          <ItemImageGallery kind="lost" itemId={item.id} canDelete={editable} />
          {editable && (
            <div className="card">
              <h2 className="card-title">Add photos</h2>
              <AddPhotos kind="lost" itemId={item.id} existingCount={imagesQuery.data?.length ?? 0} />
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
                <dt>Date lost</dt>
                <dd>{formatDate(item.date_lost)}</dd>
              </div>
              <div>
                <dt>Location</dt>
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

          {privateQuery.data !== undefined && (
            <div className="card private-field">
              <h2 className="card-title">
                <Lock size={16} /> Private ownership information
              </h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {privateQuery.data || <span className="muted">None provided.</span>}
              </p>
              <p className="field-hint" style={{ marginTop: 8 }}>
                Only you and FoundIT administrators can see this. It’s used to verify your ownership when you claim.
              </p>
            </div>
          )}

          {item.status !== 'CANCELLED' && <LostItemMatches lostItemId={item.id} canRematch={editable} />}

          <div className="card">
            <h2 className="card-title">Status</h2>
            <StatusTimeline kind="lost" status={item.status} />
          </div>
        </div>
      </div>
    </div>
  )
}
