import { AlertCircle, CheckCircle, Info, Zap } from 'lucide-react'
import { timeAgo } from '../../lib/format'
import type { AppNotification } from '../../types'

const ICONS = {
  MATCH: <Zap size={18} color="#f26a36" />,
  CLAIM: <AlertCircle size={18} color="#eab308" />,
  COLLECTION: <CheckCircle size={18} color="#16a34a" />,
  SYSTEM: <Info size={18} color="#64748b" />,
} as const

/** One notification row: icon, title, message, relative time. */
export function NotificationItem({
  notification,
  onOpen,
  compact = false,
}: {
  notification: AppNotification
  onOpen?: (n: AppNotification) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      className={`notification-item ${notification.is_read ? '' : 'unread'} ${compact ? 'compact' : ''}`}
      onClick={() => onOpen?.(notification)}
    >
      <span className="notification-icon">{ICONS[notification.type]}</span>
      <span className="notification-body">
        <span className="notification-title-row">
          <span className="notification-title">{notification.title}</span>
          <time className="notification-time" dateTime={notification.created_at}>
            {timeAgo(notification.created_at)}
          </time>
        </span>
        <span className="notification-message">{notification.message}</span>
      </span>
    </button>
  )
}
