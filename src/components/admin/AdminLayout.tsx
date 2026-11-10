import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { SkeletonList } from '../ui'

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/claims', label: 'Claims', icon: ClipboardCheck },
  { to: '/admin/matches', label: 'Matches', icon: Sparkles },
  { to: '/admin/items', label: 'Items', icon: Package },
  { to: '/admin/collection-points', label: 'Collection Points', icon: MapPin },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

/**
 * Admin section shell: tab row on desktop, hamburger menu on mobile.
 */
export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const current =
    [...ADMIN_LINKS].sort((a, b) => b.to.length - a.to.length).find((l) => pathname.startsWith(l.to)) ?? ADMIN_LINKS[0]

  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Administration">
        <div className="admin-nav-tabs">
          {ADMIN_LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </div>

        <div className="admin-nav-mobile">
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? <X size={16} /> : <Menu size={16} />} Admin · {current.label}
          </button>
          {open && (
            <div className="admin-nav-menu">
              {ADMIN_LINKS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={16} /> {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
      <Suspense fallback={<SkeletonList rows={4} height={96} />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
