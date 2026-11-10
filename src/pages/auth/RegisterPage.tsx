import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Mail, Phone, User } from 'lucide-react'
import { signInWithGoogle, signUp } from '../../services/auth'
import { friendlyError } from '../../lib/errors'
import { safeRedirect } from '../../lib/redirect'
import { AuthLayout, GoogleButton, googleAuthEnabled } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { registerSchema } from './schemas'

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError('')
    try {
      const { session } = await signUp(values)
      if (session) {
        // Email confirmation disabled in this Supabase project: go straight in.
        navigate(redirect, { replace: true })
      } else {
        navigate(`/verify-email?email=${encodeURIComponent(values.email)}`, { replace: true })
      }
    } catch (err) {
      setError(friendlyError(err))
    }
  })

  return (
    <AuthLayout
      title="Create FoundIT Account"
      subtitle="Report lost items, help return found ones, and get notified about matches."
      error={error}
    >
      {googleAuthEnabled && (
        <>
          <GoogleButton
            onClick={() => signInWithGoogle(redirect).catch((err) => setError(friendlyError(err)))}
            disabled={isSubmitting}
          />
          <div className="auth-divider split-divider">
            <span>or register with email</span>
          </div>
        </>
      )}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="input-group">
          <User className="input-field-icon" size={18} />
          <input
            type="text"
            autoComplete="name"
            placeholder="Full Name *"
            className="auth-input split-input icon-padded"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
        </div>
        {errors.fullName && <p className="auth-input-error">{errors.fullName.message}</p>}

        <div className="input-group">
          <Mail className="input-field-icon" size={18} />
          <input
            type="email"
            autoComplete="email"
            placeholder="Email Address *"
            className="auth-input split-input icon-padded"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </div>
        {errors.email && <p className="auth-input-error">{errors.email.message}</p>}

        <div className="input-group">
          <Phone className="input-field-icon" size={18} />
          <input
            type="tel"
            autoComplete="tel"
            placeholder="Phone Number (optional)"
            className="auth-input split-input icon-padded"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </div>
        {errors.phone && <p className="auth-input-error">{errors.phone.message}</p>}

        <PasswordInput
          placeholder="Password *"
          autoComplete="new-password"
          showStrength
          aria-invalid={Boolean(errors.password)}
          value={watch('password')}
          {...register('password')}
        />
        {errors.password && <p className="auth-input-error">{errors.password.message}</p>}

        <PasswordInput
          placeholder="Confirm Password *"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          value={watch('confirmPassword')}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && <p className="auth-input-error">{errors.confirmPassword.message}</p>}

        <button type="submit" className="auth-submit-btn split-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? <span className="spinner-text">Creating account…</span> : 'Create Account'}
        </button>
      </form>

      <p className="auth-page-links">
        Already registered?{' '}
        <Link to={params.get('redirect') ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}>Sign in</Link>
      </p>
    </AuthLayout>
  )
}
