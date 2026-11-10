import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react'

/** Split-screen auth layout (artwork left, form right; single column on mobile). */
export function AuthLayout({
  title,
  subtitle,
  children,
  backTo,
  error,
  success,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  backTo?: string
  error?: string
  success?: string
}) {
  return (
    <div className="auth-screen-container auth-split-layout">
      <div className="auth-left-pane">
        <div className="gestures-full-backdrop auth-backdrop">
          <img src="/hand-gestures.png" alt="" className="hand-gestures-art-fullscreen auth-art" />
          <div className="gesture-ripple-ring ring-a" />
          <div className="gesture-ripple-ring ring-b" />
        </div>
        <div className="auth-hero-badge">
          <Sparkles size={18} className="sparkle-icon" />
          <span>Smart Lost &amp; Found</span>
        </div>
      </div>

      <div className="auth-right-pane">
        <header className="brand-wordmark-container auth-brand-split">
          <img src="/foundit-logo.png" alt="FoundIT" className="foundit-brand-logo" />
        </header>

        <div className="auth-form-container form-split">
          {backTo && (
            <div className="auth-back-link">
              <Link to={backTo} className="back-btn split-link">
                <ArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
          )}

          <h1 className="auth-title split-title">{title}</h1>
          {subtitle && <p className="auth-subtitle split-subtitle">{subtitle}</p>}

          {error && (
            <div className="auth-alert alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="auth-alert alert-success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  )
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="google-login-btn split-google-btn" onClick={onClick} disabled={disabled}>
      <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </button>
  )
}

/** Google sign-in is optional: enable once the provider is configured in Supabase. */
export const googleAuthEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true'
