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
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { ItemsListPage } from './pages/items/ItemsListPage'
import { ReportItemPage } from './pages/items/ReportItemPage'
import { LostItemDetailPage } from './pages/items/LostItemDetailPage'
import { FoundItemDetailPage } from './pages/items/FoundItemDetailPage'
import { ItemEditPage } from './pages/items/ItemEditPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/q/:slug" element={<PlaceholderPage title="FoundIT Box" module="Claims, Collection & QR (M4)" />} />
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
          <Route path="/matches" element={<PlaceholderPage title="My Matches" module="Matching Engine (M3)" />} />
          <Route path="/matches/:id" element={<PlaceholderPage title="Match Detail" module="Matching Engine (M3)" />} />

          {/* M4 — Claims, Collection & QR */}
          <Route path="/claims" element={<PlaceholderPage title="My Claims" module="Claims & QR (M4)" />} />
          <Route path="/claims/new/:matchId" element={<PlaceholderPage title="Submit Claim" module="Claims & QR (M4)" />} />
          <Route path="/claims/:id" element={<PlaceholderPage title="Claim Detail" module="Claims & QR (M4)" />} />

          {/* M5 — Notifications */}
          <Route path="/notifications" element={<PlaceholderPage title="Notifications" module="Admin & Notifications (M5)" />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<PlaceholderPage title="Admin Console" module="Admin & Notifications (M5)" />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="items" element={<PlaceholderPage title="Item Management" module="Admin & Notifications (M5)" />} />
            <Route path="matches" element={<PlaceholderPage title="Match Review" module="Admin & Notifications (M5)" />} />
            <Route path="claims" element={<PlaceholderPage title="Claims Review" module="Admin & Notifications (M5)" />} />
            <Route path="claims/:id" element={<PlaceholderPage title="Claim Review" module="Admin & Notifications (M5)" />} />
            <Route
              path="collection-points"
              element={<PlaceholderPage title="Collection Points" module="Admin & Notifications (M5)" />}
            />
            <Route path="analytics" element={<PlaceholderPage title="Analytics" module="Admin & Notifications (M5)" />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
