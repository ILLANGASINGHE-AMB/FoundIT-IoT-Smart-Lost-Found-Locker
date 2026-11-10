import { Mail, MapPin } from 'lucide-react'
import type { QrCollectionPoint } from '../../services/qr'

/** Big, friendly "You're at: …" card used on the QR landing page. */
export function CollectionPointCard({ point }: { point: QrCollectionPoint }) {
  return (
    <div className="collection-point-card">
      <span className="collection-point-eyebrow">You’re at</span>
      <h1>{point.name}</h1>
      {(point.address || point.location_name) && (
        <p>
          <MapPin size={15} /> {point.address || point.location_name}
        </p>
      )}
      {point.description && <p className="muted">{point.description}</p>}
      {point.contact && (
        <p className="muted small">
          <Mail size={13} /> {point.contact}
        </p>
      )}
    </div>
  )
}
