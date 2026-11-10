import { lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AdminRoute, GuestRoute, ProtectedRoute } from './components/routing/guards'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { ItemsListPage } from './pages/items/ItemsListPage'
import { ReportItemPage } from './pages/items/ReportItemPage'
import { LostItemDetailPage } from './pages/items/LostItemDetailPage'
import { FoundItemDetailPage } from './pages/items/FoundItemDetailPage'
import { ItemEditPage } from './pages/items/ItemEditPage'
import { MatchesPage } from './pages/matches/MatchesPage'
import { MatchDetailPage } from './pages/matches/MatchDetailPage'
import { ClaimsPage } from './pages/claims/ClaimsPage'
import { SubmitClaimPage } from './pages/claims/SubmitClaimPage'
import { ClaimDetailPage } from './pages/claims/ClaimDetailPage'
import { QrLandingPage } from './pages/qr/QrLandingPage'
import { NotificationsPage } from './pages/notifications/NotificationsPage'
import { AdminLayout } from './components/admin/AdminLayout'

const named = <K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })))

const AdminDashboardPage = named(() => import('./pages/admin/AdminDashboardPage'), 'AdminDashboardPage')
const AdminUsersPage = named(() => import('./pages/admin/AdminUsersPage'), 'AdminUsersPage')
const AdminItemsPage = named(() => import('./pages/admin/AdminItemsPage'), 'AdminItemsPage')
const AdminMatchesPage = named(() => import('./pages/admin/AdminMatchesPage'), 'AdminMatchesPage')
const AdminClaimsPage = named(() => import('./pages/admin/AdminClaimsPage'), 'AdminClaimsPage')
const AdminClaimReviewPage = named(() => import('./pages/admin/AdminClaimReviewPage'), 'AdminClaimReviewPage')
const AdminCollectionPointsPage = named(() => import('./pages/admin/AdminCollectionPointsPage'), 'AdminCollectionPointsPage')
const AdminAnalyticsPage = named(() => import('./pages/admin/AdminAnalyticsPage'), 'AdminAnalyticsPage')
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/q/:slug" element={<QrLandingPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Guests only */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Authenticated app */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* M2 — Lost & Found Item Management */}
          <Route path="/lost" element={<ItemsListPage key="lost" kind="lost" />} />
          <Route path="/lost/new" element={<ReportItemPage key="lost" kind="lost" />} />
          <Route path="/lost/:id" element={<LostItemDetailPage />} />
          <Route path="/lost/:id/edit" element={<ItemEditPage key="lost" kind="lost" />} />
          <Route path="/found" element={<ItemsListPage key="found" kind="found" />} />
          <Route path="/found/new" element={<ReportItemPage key="found" kind="found" />} />
          <Route path="/found/:id" element={<FoundItemDetailPage />} />
          <Route path="/found/:id/edit" element={<ItemEditPage key="found" kind="found" />} />

          {/* M3 — Matching Engine */}
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />

          {/* M4 — Claims, Collection & QR */}
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/claims/new/:matchId" element={<SubmitClaimPage />} />
          <Route path="/claims/:id" element={<ClaimDetailPage />} />

          {/* M5 — Notifications */}
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Admin (M5) — lazy-loaded so admin code + charts stay out of the main bundle */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="items" element={<AdminItemsPage />} />
            <Route path="matches" element={<AdminMatchesPage />} />
            <Route path="claims" element={<AdminClaimsPage />} />
            <Route path="claims/:id" element={<AdminClaimReviewPage />} />
            <Route path="collection-points" element={<AdminCollectionPointsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
