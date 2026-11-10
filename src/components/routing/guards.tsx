import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { SplashScreen } from '../ui/SplashScreen'
import { safeRedirect } from '../../lib/redirect'

/** Redirects unauthenticated users to /login?redirect=<current path>. */
export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (isLoading) return <SplashScreen />
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  // A recovery session must set a new password before using the app.
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  return children ?? <Outlet />
}

/** Redirects non-admins to /dashboard. */
export function AdminRoute({ children }: { children?: ReactNode }) {
  const { isAdmin, isLoading } = useAuth()
  if (isLoading) return <SplashScreen />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children ?? <Outlet />
}

/** Auth pages (login/register): bounce signed-in users to their destination. */
export function GuestRoute({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <SplashScreen />
  if (isAuthenticated) {
    const redirect = new URLSearchParams(location.search).get('redirect')
    return <Navigate to={safeRedirect(redirect)} replace />
  }
  return children ?? <Outlet />
}

