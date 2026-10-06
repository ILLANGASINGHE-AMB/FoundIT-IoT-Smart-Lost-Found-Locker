import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { UserRole, AuthScreenTab } from '../../types/auth'
import {
  User,
  ShieldCheck,
  Mail,
  Lock,
  UserCheck,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  ChevronRight,
  Shield,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react'

export function AuthScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const {
    login,
    signup,
    loginOrSignupWithGoogle,
    completeGoogleOnboarding,
    sendPasswordResetOTP,
    verifyOTP,
    resetPasswordWithOTP,
  } = useAuth()

  const [activeTab, setActiveTab] = useState<AuthScreenTab>('login')
  const [role, setRole] = useState<UserRole>('member')
  const [rememberMe, setRememberMe] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successMsg, setSuccessMsg] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [assignedBranch, setAssignedBranch] = useState('Central Station Hub')

  // OTP Recovery states
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [demoOtpHint, setDemoOtpHint] = useState<string>('')

  // Google Onboarding Pending State
  const [googlePayload, setGooglePayload] = useState<{
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
  } | null>(null)
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false)

  // Countdown State
  const [resendCountdown, setResendCountdown] = useState<number>(0)

  // Show Password State
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false)

  useEffect(() => {
    if (resendCountdown > 0) {
      const timerId = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timerId)
    }
  }, [resendCountdown])

  // Demo Login helpers
  const handleQuickDemoLogin = async (demoEmail: string) => {
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      await login(demoEmail, 'password123', rememberMe)
      onLoginSuccess()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to login with demo account')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Google Auth Click
  const handleTriggerGoogleAuth = () => {
    setErrorMsg('')
    setSuccessMsg('')
    setShowGoogleModal(true)
  }

  const handleSelectGoogleAccount = async (account: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
  }) => {
    setShowGoogleModal(false)
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const res = await loginOrSignupWithGoogle(account)
      if (res.needsRoleOnboarding) {
        setGooglePayload(account)
        setEmail(account.email)
        setFullName(account.fullName)
        setActiveTab('google-role-onboarding')
      } else {
        onLoginSuccess()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Auth failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteGoogleRoleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googlePayload) return
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      await completeGoogleOnboarding({
        ...googlePayload,
        role,
        assignedBranch: role === 'staff' ? assignedBranch : undefined,
      })
      onLoginSuccess()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete registration.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // OTP Password Recovery Handlers
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setErrorMsg('Please enter your email address.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await sendPasswordResetOTP(email)
      setDemoOtpHint(res.otpCode)
      setSuccessMsg(`A 6-digit verification code has been sent to ${email}`)
      setActiveTab('otp-verify')
      setResendCountdown(60) // Start 60s countdown
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const currentOtp = otpCode.padEnd(6, ' ').split('')
    currentOtp[index] = value.slice(-1) || ' '
    const newOtp = currentOtp.join('').trimEnd()
    setOtpCode(newOtp)
    
    if (value && index < 5) {
      document.getElementById(`otp-input-${index + 1}`)?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      document.getElementById(`otp-input-${index - 1}`)?.focus()
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length < 6) {
      setErrorMsg('Please enter the full 6-digit OTP code.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      await verifyOTP(email, otpCode)
      setSuccessMsg('OTP code verified! Please set your new password.')
      setActiveTab('new-password')
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired OTP code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPasswordWithOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      await resetPasswordWithOTP(email, otpCode, newPassword)
      setSuccessMsg('Your password has been successfully reset! You can now log in.')
      setPassword('')
      setActiveTab('login')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Standard Login / Signup Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    try {
      if (activeTab === 'login') {
        if (!email || !password) throw new Error('Please fill in both email and password.')
        await login(email, password, rememberMe)
        onLoginSuccess()
      } else if (activeTab === 'signup') {
        if (!fullName || !email || !password) {
          throw new Error('Please fill in all required fields (Full Name, Email, Password).')
        }
        await signup({
          email,
          password,
          fullName,
          role,
          phone,
          address,
          assignedBranch: role === 'staff' ? assignedBranch : undefined,
          rememberMe,
        })
        onLoginSuccess()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please check your inputs.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-screen-container auth-split-layout">
      {/* ── Left Pane: Branding & Dynamic Artwork ── */}
      <div className="auth-left-pane">
        <div className="gestures-full-backdrop auth-backdrop">
          <img
            src="/hand-gestures.png"
            alt="FoundIT Smart Locker IoT Security"
            className="hand-gestures-art-fullscreen auth-art"
          />
          <div className="gesture-ripple-ring ring-a" />
          <div className="gesture-ripple-ring ring-b" />
        </div>
        <div className="auth-hero-badge">
          <Sparkles size={18} className="sparkle-icon" />
          <span>IoT Smart Locker Identity System</span>
        </div>
      </div>

      {/* ── Right Pane: Auth Forms ── */}
      <div className="auth-right-pane">
        <header className="brand-wordmark-container auth-brand-split">
          <img src="/foundit-logo.png" alt="FoundIT Logo" className="foundit-brand-logo" />
        </header>

        <div className="auth-form-container form-split">
          {/* Top Demo Quick Login Bar */}
          {activeTab !== 'google-role-onboarding' && (
            <div className="demo-accounts-bar">
              <span className="demo-label">Quick Test Accounts:</span>
              <div className="demo-buttons-group">
                <button
                  type="button"
                  className="demo-chip chip-member"
                  onClick={() => handleQuickDemoLogin('member@foundit.com')}
                  disabled={isSubmitting}
                >
                  <User size={13} /> Member
                </button>
                <button
                  type="button"
                  className="demo-chip chip-staff"
                  onClick={() => handleQuickDemoLogin('staff@foundit.com')}
                  disabled={isSubmitting}
                >
                  <UserCheck size={13} /> Locker Staff
                </button>
                <button
                  type="button"
                  className="demo-chip chip-admin"
                  onClick={() => handleQuickDemoLogin('admin@foundit.com')}
                  disabled={isSubmitting}
                >
                  <ShieldCheck size={13} /> Admin
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Back Button */}
          {['forgot', 'otp-verify', 'new-password', 'google-role-onboarding'].includes(
            activeTab
          ) && (
            <div className="auth-back-link">
              <button
                type="button"
                className="back-btn split-link"
                onClick={() => {
                  setActiveTab('login')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>
          )}

          <h1 className="auth-title split-title">
            {activeTab === 'login' && 'Welcome Back'}
            {activeTab === 'signup' && 'Create FoundIT Account'}
            {activeTab === 'forgot' && 'Account Recovery'}
            {activeTab === 'otp-verify' && 'Enter Verification Code'}
            {activeTab === 'new-password' && 'Set New Password'}
            {activeTab === 'google-role-onboarding' && 'Select Your Account Role'}
          </h1>
          <p className="auth-subtitle split-subtitle">
            {activeTab === 'login' && 'Sign in to access your IoT locker claims, reports & profile.'}
            {activeTab === 'signup' && 'Select your role and create an authenticated account.'}
            {activeTab === 'forgot' && 'Enter your registered email to receive a 6-digit OTP code.'}
            {activeTab === 'otp-verify' && `We sent a code to ${email}. Check below for hint.`}
            {activeTab === 'new-password' && 'Choose a strong new password for your account.'}
            {activeTab === 'google-role-onboarding' &&
              `Completing registration for ${googlePayload?.email}`}
          </p>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="auth-alert alert-error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="auth-alert alert-success">
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button (Login & Signup views) */}
          {(activeTab === 'login' || activeTab === 'signup') && (
            <>
              <button
                type="button"
                className="google-login-btn split-google-btn"
                onClick={handleTriggerGoogleAuth}
                disabled={isSubmitting}
              >
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="auth-divider split-divider">
                <span>or email authentication</span>
              </div>
            </>
          )}

          {/* ── STEP A: LOGIN / SIGNUP FORM ── */}
          {(activeTab === 'login' || activeTab === 'signup') && (
            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Role Picker (Signup only) */}
              {activeTab === 'signup' && (
                <div className="role-selector-container">
                  <label className="form-label-header">Select User Role</label>
                  <div className="role-options-grid">
                    <button
                      type="button"
                      className={`role-card ${role === 'member' ? 'selected' : ''}`}
                      onClick={() => setRole('member')}
                    >
                      <User size={20} className="role-icon" />
                      <div className="role-text">
                        <span className="role-title">Member</span>
                        <span className="role-desc">Claim & Report</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`role-card ${role === 'staff' ? 'selected' : ''}`}
                      onClick={() => setRole('staff')}
                    >
                      <UserCheck size={20} className="role-icon" />
                      <div className="role-text">
                        <span className="role-title">Locker Staff</span>
                        <span className="role-desc">Station Operator</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`role-card ${role === 'admin' ? 'selected' : ''}`}
                      onClick={() => setRole('admin')}
                    >
                      <ShieldCheck size={20} className="role-icon" />
                      <div className="role-text">
                        <span className="role-title">System Admin</span>
                        <span className="role-desc">Fleet Manager</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Full Name (Signup only) */}
              {activeTab === 'signup' && (
                <div className="input-group">
                  <User className="input-field-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Full Name *"
                    className="auth-input split-input icon-padded"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div className="input-group">
                <Mail className="input-field-icon" size={18} />
                <input
                  type="email"
                  placeholder="Email Address *"
                  className="auth-input split-input icon-padded"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="input-group">
                <Lock className="input-field-icon" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password *"
                  className="auth-input split-input icon-padded"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle-btn" 
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Optional Fields (Signup) */}
              {activeTab === 'signup' && (
                <>
                  <div className="input-group">
                    <Phone className="input-field-icon" size={18} />
                    <input
                      type="tel"
                      placeholder="Phone Number (Optional)"
                      className="auth-input split-input icon-padded"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <MapPin className="input-field-icon" size={18} />
                    <input
                      type="text"
                      placeholder="City / Address (Optional)"
                      className="auth-input split-input icon-padded"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  {role === 'staff' && (
                    <div className="input-group">
                      <Building2 className="input-field-icon" size={18} />
                      <select
                        className="auth-input split-input icon-padded select-custom"
                        value={assignedBranch}
                        onChange={(e) => setAssignedBranch(e.target.value)}
                      >
                        <option value="Central Station Hub">Central Station Hub</option>
                        <option value="Downtown Office Locker">Downtown Office Locker</option>
                        <option value="Airport Terminal 2 Depot">Airport Terminal 2 Depot</option>
                        <option value="University Campus Center">University Campus Center</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Remember Me Checkbox & Forgot Password */}
              <div className="auth-options-row">
                <label className="remember-me-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me on this device</span>
                </label>

                {activeTab === 'login' && (
                  <button
                    type="button"
                    className="auth-link split-link link-forgot"
                    onClick={() => {
                      setActiveTab('forgot')
                      setErrorMsg('')
                      setSuccessMsg('')
                    }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="auth-submit-btn split-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="spinner-text">Authenticating...</span>
                ) : (
                  <>
                    {activeTab === 'login' && 'Sign In'}
                    {activeTab === 'signup' && `Register as ${role.toUpperCase()}`}
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── STEP B: GOOGLE ROLE ONBOARDING ── */}
          {activeTab === 'google-role-onboarding' && (
            <form className="auth-form" onSubmit={handleCompleteGoogleRoleOnboarding}>
              <div className="role-selector-container">
                <label className="form-label-header">Assign Role for Google Account</label>
                <div className="role-options-grid">
                  <button
                    type="button"
                    className={`role-card ${role === 'member' ? 'selected' : ''}`}
                    onClick={() => setRole('member')}
                  >
                    <User size={20} className="role-icon" />
                    <div className="role-text">
                      <span className="role-title">Member</span>
                      <span className="role-desc">Claim & Report</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`role-card ${role === 'staff' ? 'selected' : ''}`}
                    onClick={() => setRole('staff')}
                  >
                    <UserCheck size={20} className="role-icon" />
                    <div className="role-text">
                      <span className="role-title">Locker Staff</span>
                      <span className="role-desc">Station Operator</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`role-card ${role === 'admin' ? 'selected' : ''}`}
                    onClick={() => setRole('admin')}
                  >
                    <ShieldCheck size={20} className="role-icon" />
                    <div className="role-text">
                      <span className="role-title">System Admin</span>
                      <span className="role-desc">Fleet Manager</span>
                    </div>
                  </button>
                </div>
              </div>

              {role === 'staff' && (
                <div className="input-group">
                  <Building2 className="input-field-icon" size={18} />
                  <select
                    className="auth-input split-input icon-padded select-custom"
                    value={assignedBranch}
                    onChange={(e) => setAssignedBranch(e.target.value)}
                  >
                    <option value="Central Station Hub">Central Station Hub</option>
                    <option value="Downtown Office Locker">Downtown Office Locker</option>
                    <option value="Airport Terminal 2 Depot">Airport Terminal 2 Depot</option>
                    <option value="University Campus Center">University Campus Center</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="auth-submit-btn split-submit-btn"
                disabled={isSubmitting}
              >
                Complete Google Setup <ChevronRight size={18} />
              </button>
            </form>
          )}

          {/* ── STEP C: RECOVERY STEP 1 - ENTER EMAIL ── */}
          {activeTab === 'forgot' && (
            <form className="auth-form" onSubmit={handleSendOTP}>
              <div className="input-group">
                <Mail className="input-field-icon" size={18} />
                <input
                  type="email"
                  placeholder="Registered Email Address *"
                  className="auth-input split-input icon-padded"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-submit-btn split-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending OTP Code...' : 'Send 6-Digit OTP Code'}
              </button>
            </form>
          )}

          {/* ── STEP D: RECOVERY STEP 2 - VERIFY OTP CODE ── */}
          {activeTab === 'otp-verify' && (
            <form className="auth-form" onSubmit={handleVerifyOTP}>
              {demoOtpHint && (
                <div className="otp-hint-badge">
                  <Sparkles size={14} /> <span>Generated Test OTP: <strong>{demoOtpHint}</strong></span>
                </div>
              )}

              <div className="otp-boxes-container">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    id={`otp-input-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="otp-box-input"
                    value={otpCode[index] && otpCode[index] !== ' ' ? otpCode[index] : ''}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                className="auth-submit-btn split-submit-btn"
                disabled={isSubmitting}
              >
                Verify Code <ChevronRight size={18} />
              </button>

              <button
                type="button"
                className="auth-link split-link text-center-btn"
                onClick={handleSendOTP}
                disabled={resendCountdown > 0 || isSubmitting}
                style={{ opacity: resendCountdown > 0 ? 0.5 : 1, cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer' }}
              >
                <RotateCcw size={14} /> {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP Code'}
              </button>
            </form>
          )}

          {/* ── STEP E: RECOVERY STEP 3 - SET NEW PASSWORD ── */}
          {activeTab === 'new-password' && (
            <form className="auth-form" onSubmit={handleResetPasswordWithOTP}>
              <div className="input-group">
                <Lock className="input-field-icon" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password *"
                  className="auth-input split-input icon-padded"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle-btn" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="input-group">
                <Lock className="input-field-icon" size={18} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password *"
                  className="auth-input split-input icon-padded"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle-btn" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                className="auth-submit-btn split-submit-btn"
                disabled={isSubmitting}
              >
                Update Password & Sign In
              </button>
            </form>
          )}

          {/* Toggle between Login and Signup */}
          {(activeTab === 'login' || activeTab === 'signup') && (
            <p className="auth-footer-text split-footer">
              {activeTab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                className="auth-link split-link btn-inline-link"
                onClick={() => {
                  setActiveTab(activeTab === 'login' ? 'signup' : 'login')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
              >
                {activeTab === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── GOOGLE ACCOUNTS POPUP SIMULATOR MODAL ── */}
      {showGoogleModal && (
        <div className="modal-backdrop">
          <div className="google-picker-modal">
            <div className="google-modal-header">
              <svg className="google-icon" viewBox="0 0 24 24" width="22" height="22">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <h3>Sign in with Google</h3>
              <p>Choose an account to continue to FoundIT</p>
            </div>

            <div className="google-accounts-list">
              <button
                className="google-account-item"
                onClick={() =>
                  handleSelectGoogleAccount({
                    googleId: 'g-1001',
                    email: 'member@foundit.com',
                    fullName: 'Alex Morgan',
                    avatarUrl:
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                  })
                }
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
                  alt="Alex Morgan"
                  className="google-avatar"
                />
                <div className="account-text">
                  <span className="account-name">Alex Morgan</span>
                  <span className="account-email">member@foundit.com</span>
                </div>
                <span className="existing-badge">Existing</span>
              </button>

              <button
                className="google-account-item"
                onClick={() =>
                  handleSelectGoogleAccount({
                    googleId: 'g-1002',
                    email: 'taylor.swift@gmail.com',
                    fullName: 'Taylor Swift',
                    avatarUrl:
                      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
                  })
                }
              >
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"
                  alt="Taylor Swift"
                  className="google-avatar"
                />
                <div className="account-text">
                  <span className="account-name">Taylor Swift</span>
                  <span className="account-email">taylor.swift@gmail.com</span>
                </div>
                <span className="new-badge">New User</span>
              </button>

              <button
                className="google-account-item"
                onClick={() =>
                  handleSelectGoogleAccount({
                    googleId: 'g-1003',
                    email: 'staff@foundit.com',
                    fullName: 'Officer Marcus Vance',
                    avatarUrl:
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
                  })
                }
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
                  alt="Officer Marcus Vance"
                  className="google-avatar"
                />
                <div className="account-text">
                  <span className="account-name">Officer Marcus Vance</span>
                  <span className="account-email">staff@foundit.com</span>
                </div>
                <span className="existing-badge">Existing Staff</span>
              </button>
            </div>

            <div className="google-modal-footer">
              <button className="cancel-google-btn" onClick={() => setShowGoogleModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
