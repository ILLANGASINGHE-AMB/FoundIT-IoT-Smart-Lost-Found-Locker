import {
  Bell,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  type LucideIcon,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shorter label for the mobile bottom tab bar. */
  shortLabel?: string
}

/** Primary navigation (desktop sidebar). */
export const mainNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { to: '/lost', label: 'My Lost Items', shortLabel: 'Lost', icon: FileSearch },
  { to: '/found', label: 'My Found Items', shortLabel: 'Found', icon: PackageSearch },
  { to: '/matches', label: 'Matches', icon: Sparkles },
  { to: '/claims', label: 'Claims', icon: ClipboardCheck },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'My Profile', shortLabel: 'Profile', icon: User },
]

/** Mobile bottom tab bar: Home · Lost · Found · Matches · Profile. */
export const bottomTabs: NavItem[] = ['/dashboard', '/lost', '/found', '/matches', '/profile'].map(
  (to) => mainNav.find((item) => item.to === to)!,
)

export const adminNav: NavItem[] = [{ to: '/admin', label: 'Admin Console', icon: ShieldCheck }]

/** Page titles for the top bar, matched by path prefix (longest first). */
export const pageTitles: [prefix: string, title: string][] = [
  ['/admin/users', 'User Management'],
  ['/admin/items', 'Item Management'],
  ['/admin/matches', 'Match Review'],
  ['/admin/claims', 'Claims Review'],
  ['/admin/collection-points', 'Collection Points'],
  ['/admin/analytics', 'Analytics'],
  ['/admin', 'Admin Console'],
  ['/lost/new', 'Report Lost Item'],
  ['/found/new', 'Report Found Item'],
  ['/lost', 'Lost Items'],
  ['/found', 'Found Items'],
  ['/matches', 'Matches'],
  ['/claims', 'Claims'],
  ['/notifications', 'Notifications'],
  ['/profile', 'My Profile'],
  ['/dashboard', 'Dashboard'],
]
