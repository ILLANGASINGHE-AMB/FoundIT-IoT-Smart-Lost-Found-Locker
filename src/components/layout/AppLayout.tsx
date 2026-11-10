import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, ShieldCheck, User as UserIcon, UserCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui'
import { adminNav, bottomTabs, mainNav, pageTitles, type NavItem } from './navigation'
import { TopbarActions } from './TopbarActions'

/**
 * Shared application shell (M1, Phase 0). Every authenticated page renders
 * inside this layout — do not create new layout wrappers.
 *  - Desktop ≥768px: persistent left sidebar
 *  - Mobile  <768px: bottom tab bar (Home · Lost · Found · Matches · Profile)
 */
export function AppLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <Topbar />
        <div className="dashboard-content">
          <Outlet />
        </div>
      </main>
      <BottomTabBar />
    </div>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/admin'}
      className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
      title={item.label}
    >
      <span className="nav-icon">
        <Icon size={20} />
      </span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const { profile, isAdmin, isCollectionOfficer, logout } = useAuth()

  return (
    <aside className="sidebar" id="main-sidebar" aria-label="Main navigation">
      <div className="sidebar-inner">
        <NavLink to="/profile" className="sidebar-profile" title="My profile">
          <div className="profile-avatar">
            <Avatar src={profile?.profile_image} name={profile?.full_name} size={40} />
          </div>
          <div className="profile-info">
            <span className="profile-name">{profile?.full_name || 'FoundIT user'}</span>
            <span className="profile-role">
              {isAdmin ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
              {isAdmin ? 'ADMIN' : 'USER'}
              {isCollectionOfficer && (
                <>
                  {' · '}
                  <UserCheck size={12} /> OFFICER
                </>
              )}
            </span>
          </div>
        </NavLink>

        <nav className="sidebar-nav">
          {mainNav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          {isAdmin && (
            <>
              <span className="sidebar-section-label">Administration</span>
              {adminNav.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="sidebar-nav-item logout-item" title="Log out" onClick={logout}>
            <span className="nav-icon">
              <LogOut size={20} />
            </span>
            <span className="nav-label">Log Out</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

function Topbar() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const title = pageTitles.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'FoundIT'

  return (
    <header className="dashboard-topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        <div className="topbar-brand">
          <span className="topbar-logo-text">found</span>
          <span className="topbar-logo-accent">it</span>
        </div>
        <TopbarActions />
        <NavLink to="/profile" className="topbar-avatar" aria-label="My profile">
          <Avatar src={profile?.profile_image} name={profile?.full_name} size={32} />
        </NavLink>
      </div>
    </header>
  )
}

export function BottomTabBar() {
  return (
    <nav className="bottom-tab-bar" aria-label="Primary">
      {bottomTabs.map((item) => {
        const Icon = item.icon
        return (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} />
            <span>{item.shortLabel ?? item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
