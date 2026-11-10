import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail } from 'lucide-react'
import { resetPassword } from '../../services/auth'
import { friendlyError } from '../../lib/errors'
import { AuthLayout } from './AuthLayout'
import { emailSchema } from './schemas'

const schema = z.object({ email: emailSchema })

export function ForgotPasswordPage() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError('')
    try {
      await resetPassword(email)
      // Same message whether or not the account exists (no account enumeration).
      setSuccess('If an account exists for that email, a password reset link has been sent.')
    } catch (err) {
      setError(friendlyError(err))
    }
  })

  return (
    <AuthLayout
      title="Account Recovery"
      subtitle="Enter your registered email and we’ll send you a secure link to set a new password."
      backTo="/login"
      error={error}
      success={success}
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="input-group">
          <Mail className="input-field-icon" size={18} />
          <input
            type="email"
            autoComplete="email"
            placeholder="Email Address"
            className="auth-input split-input icon-padded"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </div>
        {errors.email && <p className="auth-input-error">{errors.email.message}</p>}
        <button type="submit" className="auth-submit-btn split-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  )
}
