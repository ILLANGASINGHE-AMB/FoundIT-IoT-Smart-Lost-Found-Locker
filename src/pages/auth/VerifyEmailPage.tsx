import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { resendVerification } from '../../services/auth'
import { friendlyError } from '../../lib/errors'
import { AuthLayout } from './AuthLayout'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const resend = async () => {
    setError('')
    setSuccess('')
    setSending(true)
    try {
      await resendVerification(email)
      setSuccess('A new verification link is on its way.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={
        <>
          We sent a verification link to <strong>{email || 'your email address'}</strong>. Open it to
          activate your account, then sign in.
        </>
      }
      error={error}
      success={success}
    >
      <div className="auth-form">
        <div className="alert alert-info">
          <MailCheck size={18} />
          <span>Can’t find it? Check your spam folder, or request a new link below.</span>
        </div>
        <button
          type="button"
          className="auth-submit-btn split-submit-btn"
          onClick={resend}
          disabled={sending || !email}
        >
          {sending ? 'Sending…' : 'Resend verification email'}
        </button>
      </div>
      <p className="auth-page-links">
        Already verified? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
