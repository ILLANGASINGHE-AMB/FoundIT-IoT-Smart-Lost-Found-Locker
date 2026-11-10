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
          <Route path="/lost" element={<PlaceholderPage title="My Lost Items" module="Lost & Found (M2)" />} />
          <Route path="/lost/new" element={<PlaceholderPage title="Report Lost Item" module="Lost & Found (M2)" />} />
          <Route path="/lost/:id" element={<PlaceholderPage title="Lost Item" module="Lost & Found (M2)" />} />
          <Route path="/found" element={<PlaceholderPage title="My Found Items" module="Lost & Found (M2)" />} />
          <Route path="/found/new" element={<PlaceholderPage title="Report Found Item" module="Lost & Found (M2)" />} />
          <Route path="/found/:id" element={<PlaceholderPage title="Found Item" module="Lost & Found (M2)" />} />

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
