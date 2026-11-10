import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { MapPin, Pencil, Plus, Power, QrCode, RefreshCw } from 'lucide-react'
import {
  listCollectionPoints,
  manageCollectionPoint,
  type CollectionPointWithLocation,
} from '../../services/admin'
import { EmptyState, ErrorState, FieldError, Modal, PageHeader, SkeletonList } from '../../components/ui'
import { LocationSelect } from '../../components/items/LookupSelects'
import { QRCodeDisplay } from '../../components/qr/QRCodeDisplay'

const pointSchema = z.object({
  name: z.string().trim().min(3, 'Enter a name').max(120),
  location_id: z.string(),
  address: z.string().trim().max(200),
  description: z.string().trim().max(300),
  contact: z.string().trim().max(120),
})
type PointValues = z.infer<typeof pointSchema>

/** /admin/collection-points — FoundIT Boxes: CRUD, QR generate / print / rotate. */
export function AdminCollectionPointsPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'collection-points'], queryFn: listCollectionPoints })
  const [editing, setEditing] = useState<CollectionPointWithLocation | 'new' | null>(null)
  const [qrFor, setQrFor] = useState<CollectionPointWithLocation | null>(null)

  const action = useMutation({
    mutationFn: (vars: { action: Parameters<typeof manageCollectionPoint>[0]; id: string; qrActive?: boolean }) =>
      manageCollectionPoint(vars.action, { id: vars.id, qrActive: vars.qrActive }),
    onSuccess: (point, vars) => {
      const messages = {
        'rotate-qr': 'New QR code issued — reprint it. The old code no longer works.',
        deactivate: 'Collection point deactivated.',
        activate: 'Collection point reactivated.',
        'toggle-qr': point.qr_active ? 'QR code enabled.' : 'QR code disabled.',
      } as Record<string, string>
      toast.success(messages[vars.action] ?? 'Saved.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'collection-points'] })
      queryClient.invalidateQueries({ queryKey: ['collection-points'] })
      if (vars.action === 'rotate-qr') setQrFor((cur) => (cur ? { ...cur, qr_slug: point.qr_slug } : cur))
    },
  })

  return (
    <div className="page">
      <PageHeader
        title="Collection Points"
        description="FoundIT Boxes where finders hand items in and owners collect them."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Add collection point
          </button>
        }
      />

      {query.isLoading && <SkeletonList rows={3} height={120} />}
      {query.isError && <ErrorState message="Could not load collection points." onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && (
        <div className="card">
          <EmptyState icon={<MapPin size={26} />} title="No collection points yet" />
        </div>
      )}

      <div className="card-grid point-grid">
        {query.data?.map((p) => (
          <article key={p.id} className={`card stack point-card ${p.status === 'INACTIVE' ? 'inactive' : ''}`}>
            <div className="row-between">
              <span className={`pill ${p.status === 'ACTIVE' ? 'pill-green' : 'pill-gray'}`}>
                {p.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </span>
              <span className={`pill ${p.qr_active ? 'pill-blue' : 'pill-gray'}`}>
                <QrCode size={11} /> {p.qr_active ? 'QR live' : 'QR off'}
              </span>
            </div>
            <h3>{p.name}</h3>
            <p className="muted small">
              <MapPin size={12} /> {p.address || p.location?.name || 'No address'}
            </p>
            {p.description && <p className="small">{p.description}</p>}
            <code className="small muted">/q/{p.qr_slug}</code>
            <div className="row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQrFor(p)}>
                <QrCode size={14} /> QR code
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={action.isPending}
                onClick={() =>
                  p.status === 'ACTIVE'
                    ? window.confirm(`Deactivate ${p.name}? Its QR code will stop working.`) &&
                      action.mutate({ action: 'deactivate', id: p.id })
                    : action.mutate({ action: 'activate', id: p.id })
                }
              >
                <Power size={14} /> {p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {qrFor && (
        <Modal title={`QR code — ${qrFor.name}`} onClose={() => setQrFor(null)}>
          <QRCodeDisplay slug={qrFor.qr_slug} name={qrFor.name} />
          {!qrFor.qr_active && <div className="alert alert-warning">This QR code is currently disabled.</div>}
          <div className="divider" />
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={action.isPending}
              onClick={() =>
                window.confirm('Rotate this QR code? Every printed copy of the current code will stop working.') &&
                action.mutate({ action: 'rotate-qr', id: qrFor.id })
              }
            >
              <RefreshCw size={14} /> Rotate QR
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={action.isPending}
              onClick={() => {
                action.mutate({ action: 'toggle-qr', id: qrFor.id, qrActive: !qrFor.qr_active })
                setQrFor({ ...qrFor, qr_active: !qrFor.qr_active })
              }}
            >
              <Power size={14} /> {qrFor.qr_active ? 'Disable QR' : 'Enable QR'}
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <PointForm
          point={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            queryClient.invalidateQueries({ queryKey: ['admin', 'collection-points'] })
            queryClient.invalidateQueries({ queryKey: ['collection-points'] })
          }}
        />
      )}
    </div>
  )
}

function PointForm({
  point,
  onClose,
  onSaved,
}: {
  point: CollectionPointWithLocation | null
  onClose: () => void
  onSaved: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PointValues>({
    resolver: zodResolver(pointSchema),
    defaultValues: {
      name: point?.name ?? '',
      location_id: point?.location_id ?? '',
      address: point?.address ?? '',
      description: point?.description ?? '',
      contact: point?.contact ?? '',
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    const values = {
      name: v.name,
      location_id: v.location_id || null,
      address: v.address || null,
      description: v.description || null,
      contact: v.contact || null,
    }
    try {
      await manageCollectionPoint(point ? 'update' : 'create', { id: point?.id, values })
      toast.success(point ? 'Collection point updated.' : 'Collection point created with a new QR code.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.')
    }
  })

  return (
    <Modal title={point ? 'Edit collection point' : 'New collection point'} onClose={onClose}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="cp-name">Name</label>
          <input id="cp-name" className="input" placeholder="University Library FoundIT Box" {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="field">
          <label htmlFor="cp-location">Campus location</label>
          <LocationSelect id="cp-location" {...register('location_id')} />
          <span className="field-hint">Pre-fills the “found at” location when finders scan this box.</span>
        </div>
        <div className="field">
          <label htmlFor="cp-address">Where exactly</label>
          <input id="cp-address" className="input" placeholder="Ground floor, next to the issue desk" {...register('address')} />
        </div>
        <div className="field">
          <label htmlFor="cp-description">Opening hours / notes</label>
          <input id="cp-description" className="input" placeholder="Staffed 8am–6pm on weekdays" {...register('description')} />
        </div>
        <div className="field">
          <label htmlFor="cp-contact">Contact</label>
          <input id="cp-contact" className="input" placeholder="desk@foundit.app" {...register('contact')} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
