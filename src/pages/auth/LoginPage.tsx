import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Mail, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { signIn, signInWithGoogle } from '../../services/auth'
import { friendlyError } from '../../lib/errors'
import { safeRedirect } from '../../lib/redirect'
import { AuthLayout, GoogleButton, googleAuthEnabled } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { loginSchema } from './schemas'
import { isDemoMode } from '../../lib/supabase'
import { DEMO_ACCOUNTS } from '../../lib/demo/seed'

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError('')
    try {
      await signIn(values.email, values.password)
      toast.success('Welcome back!')
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    }
  })

  const registerLink = params.get('redirect') ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle={
        params.get('redirect')?.startsWith('/q/')
          ? 'Sign in to continue claiming your item at this FoundIT Box.'
          : 'Sign in to report lost items, track matches and claim what’s yours.'
      }
      error={error}
    >
      {isDemoMode && (
        <div className="demo-accounts-bar">
          <span className="demo-label">Quick Test Accounts (demo mode):</span>
          <div className="demo-buttons-group">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className={`demo-chip ${a.role === 'admin' ? 'chip-admin' : 'chip-member'}`}
                title={a.note}
                onClick={() => {
                  setValue('email', a.email, { shouldValidate: true })
                  setValue('password', a.password, { shouldValidate: true })
                }}
              >
                {a.role === 'admin' ? <ShieldCheck size={13} /> : <User size={13} />} {a.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {googleAuthEnabled && (
        <>
          <GoogleButton
            onClick={() => signInWithGoogle(redirect).catch((err) => setError(friendlyError(err)))}
            disabled={isSubmitting}
          />
          <div className="auth-divider split-divider">
            <span>or sign in with email</span>
          </div>
        </>
      )}

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

        <PasswordInput
          placeholder="Password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          value={watch('password')}
          {...register('password')}
        />
        {errors.password && <p className="auth-input-error">{errors.password.message}</p>}

        <div className="auth-options-row">
          <span />
          <Link to="/forgot-password" className="auth-link split-link link-forgot">
            Forgot Password?
          </Link>
        </div>

        <button type="submit" className="auth-submit-btn split-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? <span className="spinner-text">Signing in…</span> : 'Sign In'}
        </button>
      </form>

      <p className="auth-page-links">
        New to FoundIT? <Link to={registerLink}>Create an account</Link>
      </p>
    </AuthLayout>
  )
}
