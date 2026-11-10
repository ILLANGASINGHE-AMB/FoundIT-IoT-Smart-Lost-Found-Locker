import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotificationsRealtime, useRecentNotifications, useUnreadCount } from '../../hooks/useNotifications'
import { markAllRead, markAsRead } from '../../services/notifications'
import { toastError } from '../../lib/errors'
import type { AppNotification } from '../../types'
import { NotificationItem } from './NotificationItem'

/** Top-bar bell: live unread badge + dropdown preview of the latest 3. */
export function NotificationBell() {
  useNotificationsRealtime()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: unread = 0 } = useUnreadCount()
  const { data: recent } = useRecentNotifications(3)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openNotification = async (n: AppNotification) => {
    setOpen(false)
    if (!n.is_read) {
      await markAsRead(n.id).catch(toastError)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (n.link) navigate(n.link)
  }

  const readAll = async () => {
    try {
      await markAllRead()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="notification-bell" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && <span className="badge-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notification-dropdown" role="dialog" aria-label="Recent notifications">
          <div className="notification-dropdown-header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={readAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="notification-dropdown-list">
            {recent && recent.length === 0 && <p className="muted small notification-empty">You’re all caught up.</p>}
            {recent?.map((n) => (
              <NotificationItem key={n.id} notification={n} onOpen={openNotification} compact />
            ))}
          </div>
          <Link to="/notifications" className="notification-dropdown-footer" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
