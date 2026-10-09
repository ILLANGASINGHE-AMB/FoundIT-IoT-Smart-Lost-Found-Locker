import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthScreen } from './components/auth/AuthScreen'
import { ProfileView } from './components/profile/ProfileView'
import { AdminUsersView } from './components/admin/AdminUsersView'
import {
  LayoutDashboard,
  AlertTriangle,
  Search as SearchIcon,
  FileText,
  Settings,
  LogOut,
  MapPin,
  Clock,
  Phone,
  Bell,
  CheckCircle,
  AlertCircle,
  Zap,
  Info,
  X,
  User as UserIcon,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { MyReports } from './components/items/MyReports'
import { ReportItemView } from './components/items/ReportItemView'

// ─── Types ────────────────────────────────────────────────────────────────
type AppScreen = 'splash' | 'main'
type SidebarTab = 'dashboard' | 'report' | 'find' | 'reports' | 'profile' | 'settings' | 'users'

type NotificationType = 'match' | 'claim' | 'collection' | 'admin'
interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  created_at: string
  link?: string
}

const mockNotifications: AppNotification[] = [
  { id: 'n1', type: 'match', title: 'New Match Found!', body: 'A set of keys matching your report was found at Central Station.', is_read: false, created_at: '10m ago', link: '/matches/123' },
  { id: 'n2', type: 'claim', title: 'Claim Approved', body: 'Your claim for MacBook Pro has been approved. You can now collect it.', is_read: false, created_at: '2h ago', link: '/claims/456' },
  { id: 'n3', type: 'collection', title: 'Item Collected', body: 'You successfully collected the item. Thank you for using foundit!', is_read: true, created_at: '1d ago' },
  { id: 'n4', type: 'admin', title: 'System Update', body: 'We have updated our terms of service.', is_read: true, created_at: '2d ago' },
  { id: 'n5', type: 'match', title: 'Possible Match', body: 'We found a Golden Retriever that looks like your lost pet.', is_read: true, created_at: '3d ago', link: '/matches/124' },
]

export default function App() {
  return (
    <AuthProvider>
      
      <MainAppFlow />
    </AuthProvider>
  )
}

function MainAppFlow() {
  const { isAuthenticated, isLoading } = useAuth()
  const [screen, setScreen] = useState<AppScreen>('splash')
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Splash loading
  useEffect(() => {
    if (screen !== 'splash') return
    const timer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer)
          setTimeout(() => setScreen('main'), 300)
          return 100
        }
        return Math.min(100, prev + 2)
      })
    }, 25)
    return () => clearInterval(timer)
  }, [screen])

  if (screen === 'splash' || isLoading) {
    return <SplashScreen progress={loadingProgress} />
  }

  if (!isAuthenticated) {
    return <AuthScreen onLoginSuccess={() => setScreen('main')} />
  }

  return <Dashboard />
}

// ─── Splash Screen ────────────────────────────────────────────────────────
function SplashScreen({ progress }: { progress: number }) {
  return (
    <div className="splash-screen-container">
      <div className="gestures-full-backdrop" aria-hidden="true">
        <img
          src="/hand-gestures.png"
          alt="Giving and receiving lost package"
          className="hand-gestures-art-fullscreen"
        />
        <div className="gesture-ripple-ring ring-a" />
        <div className="gesture-ripple-ring ring-b" />
      </div>

      <header className="brand-wordmark-container">
        <img src="/foundit-logo.png" alt="foundit" className="foundit-brand-logo" />
        <p className="brand-subtext">Connecting what's lost with who cares</p>
      </header>

      <div className="stage-spacer" />

      <footer className="loading-meter-section">
        <div className="status-label-row">
          <span className="status-text">
            {progress >= 100 ? 'Ready to explore' : 'Initializing FoundIT Auth & System...'}
          </span>
          <span className="progress-percentage">{progress}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-fill orange-fill" style={{ width: `${progress}%` }}>
            <div className="progress-shimmer" />
          </div>
        </div>
        <div className="pulse-dots" aria-hidden="true">
          <span className="pulse-dot d1" />
          <span className="pulse-dot d2" />
          <span className="pulse-dot d3" />
        </div>
      </footer>
    </div>
  )
}

// ─── Dashboard Component ──────────────────────────────────────────────────
function Dashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')

  const navItems: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'profile', label: 'My Profile', icon: <UserIcon size={20} /> },
    { id: 'report', label: 'Report It', icon: <AlertTriangle size={20} /> },
    { id: 'find', label: 'Find It', icon: <SearchIcon size={20} /> },
    { id: 'reports', label: 'My Reports', icon: <FileText size={20} /> },
  ]

  if (user?.role === 'admin') {
    navItems.splice(1, 0, { id: 'users', label: 'User Management', icon: <UserIcon size={20} /> })
  }

  const branches = [
    { name: 'Downtown Office', address: '123 Main St, City Center', status: 'Open' },
    { name: 'Airport Terminal 2', address: 'Gate B, International Terminal', status: 'Open' },
    { name: 'Central Station', address: 'Platform 5, Railway Hub', status: 'Closed' },
    { name: 'University Campus', address: 'Student Center, Block A', status: 'Open' },
  ]

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar" id="main-sidebar">
        <div className="sidebar-inner">
          {/* Profile Section Button */}
          <button
            type="button"
            className="sidebar-profile"
            onClick={() => setActiveTab('profile')}
            style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}
          >
            <div className="profile-avatar">
              <img
                src={
                  user?.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'
                }
                alt={user?.fullName || 'Profile'}
                className="avatar-img"
              />
            </div>
            <div className="profile-info">
              <span className="profile-name">{user?.fullName || 'User'}</span>
              <span className="profile-role" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {user?.role === 'admin' && <ShieldCheck size={12} />}
                {user?.role === 'staff' && <UserCheck size={12} />}
                {user?.role === 'member' && <UserIcon size={12} />}
                {user?.role.toUpperCase()}
              </span>
            </div>
          </button>

          {/* Navigation */}
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="sidebar-bottom">
            <button
              className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              title="Settings"
              id="nav-settings-btn"
              onClick={() => setActiveTab('profile')}
            >
              <span className="nav-icon"><Settings size={20} /></span>
              <span className="nav-label">Settings</span>
            </button>
            <button
              className="sidebar-nav-item logout-item"
              title="Log Out"
              id="nav-logout-btn"
              onClick={logout}
            >
              <span className="nav-icon"><LogOut size={20} /></span>
              <span className="nav-label">Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-topbar">
          <div className="topbar-search">
            <SearchIcon size={18} className="search-input-icon" />
            <input
              type="text"
              placeholder="Search for lost items, reports..."
              className="search-input"
              id="dashboard-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="topbar-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.5rem', paddingRight: '1rem' }}>
            <div className="topbar-brand" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <span className="topbar-logo-text">found</span>
              <span className="topbar-logo-accent">it</span>
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* Dashboard Content Panes */}
        <div className="dashboard-content">
          

          {activeTab === 'profile' || activeTab === 'settings' ? (
            <ProfileView />
          ) : activeTab === 'users' ? (
  <AdminUsersView />
               ) : activeTab === 'reports' ? (
                          <MyReports />
                        ) : activeTab === 'report' ? (
                          <ReportItemView />
                        ) : (
            <>
              {/* Hero Section */}
              <section className="dashboard-hero" id="dashboard-hero-section">
                <div className="hero-bg-image">
                  <img src="/dashboard-bg.jpg" alt="" className="hero-bg" />
                  <div className="hero-bg-overlay" />
                </div>
                <div className="hero-content">
                  <div className="hero-text-block">
                    <h1 className="hero-title">
                      Welcome, <span className="hero-highlight">{user?.fullName.split(' ')[0]}</span>
                      <br />
                      Find &amp; Recover With Ease
                    </h1>
                    <p className="hero-description">
                      Logged in as <strong>{user?.role.toUpperCase()}</strong>. Manage claims, check IoT smart locker statuses, and access your profile credentials.
                    </p>
                  </div>
                  <div className="hero-actions">
                    <button
                      className="hero-btn hero-btn-report"
                      id="btn-report-it"
                      onClick={() => setActiveTab('report')}
                    >
                      <AlertTriangle size={20} />
                      Report It
                    </button>
                    <button
                      className="hero-btn hero-btn-found"
                      id="btn-found-it"
                      onClick={() => setActiveTab('find')}
                    >
                      <SearchIcon size={20} />
                      Found It
                    </button>
                  </div>
                </div>
              </section>

              {/* Stats Cards */}
              <section className="dashboard-stats">
                <div className="stat-card" id="stat-total-reports">
                  <div className="stat-icon stat-icon-orange">
                    <FileText size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">1,247</span>
                    <span className="stat-label">Total Reports</span>
                  </div>
                </div>
                <div className="stat-card" id="stat-recovered">
                  <div className="stat-icon stat-icon-green">
                    <SearchIcon size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">892</span>
                    <span className="stat-label">Items Recovered</span>
                  </div>
                </div>
                <div className="stat-card" id="stat-active">
                  <div className="stat-icon stat-icon-blue">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">355</span>
                    <span className="stat-label">Active Cases</span>
                  </div>
                </div>
                <div className="stat-card" id="stat-branches">
                  <div className="stat-icon stat-icon-purple">
                    <MapPin size={22} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">24</span>
                    <span className="stat-label">Our Branches</span>
                  </div>
                </div>
              </section>

              {/* Recent Notifications */}
              <section className="dashboard-notifications" id="notifications-section" style={{ padding: '0 2rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                  <div className="section-header" style={{ margin: 0, padding: 0, textAlign: 'left' }}>
                    <h2 className="section-title" style={{ textAlign: 'left' }}>Recent Notifications</h2>
                    <p className="section-caption" style={{ textAlign: 'left' }}>Stay updated on your matches and claims</p>
                  </div>
                  <a href="#" style={{ fontSize: '0.875rem', color: 'var(--accent-color, #f97316)', textDecoration: 'none', fontWeight: 500, marginBottom: '0.25rem' }}>View all</a>
                </div>

                <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {mockNotifications.map((notif) => (
                    <div key={notif.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: 'var(--surface, #fff)',
                      borderRadius: '12px',
                      border: '1px solid rgba(0,0,0,0.05)',
                      borderLeft: notif.is_read ? '1px solid rgba(0,0,0,0.05)' : '4px solid var(--accent-color, #f97316)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      cursor: 'pointer',
                      opacity: notif.is_read ? 0.7 : 1
                    }}>
                      <div style={{ flexShrink: 0 }}>
                        {notif.type === 'match' && <Zap size={20} color="#f97316" />}
                        {notif.type === 'claim' && <AlertCircle size={20} color="#eab308" />}
                        {notif.type === 'collection' && <CheckCircle size={20} color="#22c55e" />}
                        {notif.type === 'admin' && <Info size={20} color="#64748b" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: notif.is_read ? 500 : 600, color: '#222' }}>{notif.title}</span>
                          <span style={{ fontSize: '0.75rem', color: '#888', flexShrink: 0, marginLeft: '1rem' }}>{notif.created_at}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notif.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Branches Section */}
              <section className="dashboard-branches" id="branches-section">
                <div className="section-header" style={{ textAlign: 'left' }}>
                  <h2 className="section-title">Our Branches</h2>
                  <p className="section-caption">Find your nearest foundit branch — we're everywhere you need us</p>
                </div>

                <div className="branches-grid">
                  {branches.map((branch, i) => (
                    <div key={i} className="branch-card" id={`branch-card-${i}`}>
                      <div className="branch-icon-wrap">
                        <MapPin size={20} />
                      </div>
                      <div className="branch-info">
                        <span className="branch-name">{branch.name}</span>
                        <span className="branch-address">{branch.address}</span>
                        <span className="branch-hours">
                          <Clock size={12} />
                          {branch.status === 'Open' ? 'Mon–Sat, 9AM–6PM' : 'Closed today'}
                        </span>
                      </div>
                      <div className="branch-right">
                        <span className={`branch-status ${branch.status === 'Open' ? 'status-open' : 'status-closed'}`}>
                          {branch.status}
                        </span>
                        <button className="branch-call-btn" title="Call branch">
                          <Phone size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Notification Bell ────────────────────────────────────────────────────
function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = mockNotifications.filter((n) => !n.is_read).length

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem',
          borderRadius: '50%',
          color: '#444',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#ef4444',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: '320px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: '1px solid #eee',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {mockNotifications.slice(0, 3).map((notif) => (
              <div
                key={notif.id}
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid #eee',
                  background: notif.is_read ? '#fff' : '#fff7ed',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#222' }}>{notif.title}</span>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>{notif.created_at}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', lineHeight: 1.4 }}>
                  {notif.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
