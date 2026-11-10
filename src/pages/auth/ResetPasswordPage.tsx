import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { updatePassword } from '../../services/auth'
import { friendlyError } from '../../lib/errors'
import { SplashScreen } from '../../components/ui/SplashScreen'
import { AuthLayout } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { newPasswordSchema } from './schemas'

type Values = z.infer<typeof newPasswordSchema>

/** Landing page for the password-reset email link (PASSWORD_RECOVERY session). */
export function ResetPasswordPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(newPasswordSchema) })

  if (isLoading) return <SplashScreen />

  if (!isAuthenticated) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is invalid or has expired." backTo="/login">
        <Link to="/forgot-password" className="auth-submit-btn split-submit-btn">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setError('')
    try {
      await updatePassword(password)
      toast.success('Password updated.')
      // Full reload clears the recovery flag held in AuthContext.
      navigate('/dashboard', { replace: true })
      window.location.reload()
    } catch (err) {
      setError(friendlyError(err))
    }
  })

  return (
    <AuthLayout title="Set New Password" subtitle="Choose a strong new password for your account." error={error}>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <PasswordInput
          placeholder="New password"
          autoComplete="new-password"
          showStrength
          value={watch('password')}
          {...register('password')}
        />
        {errors.password && <p className="auth-input-error">{errors.password.message}</p>}
        <PasswordInput
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={watch('confirmPassword')}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && <p className="auth-input-error">{errors.confirmPassword.message}</p>}
        <button type="submit" className="auth-submit-btn split-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}
