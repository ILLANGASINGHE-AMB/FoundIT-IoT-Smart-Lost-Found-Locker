import { Link } from 'react-router-dom'
import { Calendar, ImageOff, MapPin } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '../../lib/format'
import type { ItemStatus } from '../../types'

type ItemCardProps = {
  to: string
  title: string
  category: string
  location?: string
  status: ItemStatus
  date: string
  imageUrl?: string
}

/** Reusable card for item list views. */
export function ItemCard({ to, title, category, location, status, date, imageUrl }: ItemCardProps) {
  return (
    <Link to={to} className="item-card item-card-link">
      {imageUrl ? (
        <img className="item-card-image" src={imageUrl} alt={title} loading="lazy" />
      ) : (
        <div className="item-card-placeholder">
          <ImageOff size={22} />
          <span>No photo</span>
        </div>
      )}

      <div className="item-card-body">
        <StatusBadge status={status} />
        <h3 className="item-card-title">{title}</h3>
        <p className="item-card-category">{category}</p>
        {location && (
          <p className="item-card-date">
            <MapPin size={12} /> {location}
          </p>
        )}
        <p className="item-card-date">
          <Calendar size={12} /> <time dateTime={date}>{formatDate(date)}</time>
        </p>
      </div>
    </Link>
  )
}
