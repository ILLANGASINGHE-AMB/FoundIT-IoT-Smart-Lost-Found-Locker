import { NavLink } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { NotificationBell } from '../notifications/NotificationBell'

/**
 * Right-hand top bar slot. The notification bell stays in the top bar on
 * every screen size (M5); admins also get a shortcut to the console, since
 * the sidebar is hidden on mobile.
 */
export function TopbarActions() {
  const { isAdmin } = useAuth()
  return (
    <>
      {isAdmin && (
        <NavLink to="/admin" className="icon-btn topbar-admin-link" aria-label="Admin console" title="Admin console">
          <ShieldCheck size={20} />
        </NavLink>
      )}
      <NotificationBell />
    </>
  )
}
