import { StatusBadge } from './StatusBadge'
import type { ItemStatus } from './StatusBadge'

type ItemCardProps = {
  title: string
  category: string
  status: ItemStatus
  date: string
  imageUrl?: string
}

export function ItemCard({
  title,
  category,
  status,
  date,
  imageUrl,
}: ItemCardProps) {
  return (
    <article className="item-card">
      {imageUrl ? (
        <img
          className="item-card-image"
          src={imageUrl}
          alt={title}
        />
      ) : (
        <div className="item-card-placeholder">
          No photo available
        </div>
      )}

      <div className="item-card-body">
        <StatusBadge status={status} />
        <h3 className="item-card-title">{title}</h3>
        <p className="item-card-category">{category}</p>
        <p className="item-card-date">
          Date: <time dateTime={date}>{date}</time>
        </p>
      </div>
    </article>
  )
}