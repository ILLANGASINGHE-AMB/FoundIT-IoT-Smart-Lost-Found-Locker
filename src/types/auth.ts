export type UserRole = 'member' | 'staff' | 'admin'
export type AuthProviderType = 'local' | 'google'

export interface UserSession {
  id: string
  device: string
  browser: string
  ip: string
  location: string
  lastActive: string
  isCurrent: boolean
}

export interface SecuritySettings {
  twoFactorEnabled: boolean
  loginAlerts: boolean
  emailNotifications: boolean
  publicProfile: boolean
}

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  provider: AuthProviderType
  googleId?: string
  avatarUrl?: string
  phone?: string
  address?: string
  bio?: string
  emergencyContact?: string
  assignedBranch?: string // For Staff role
  employeeId?: string // For Staff / Admin
  department?: string
  createdAt: string
  updatedAt: string
  rememberMe?: boolean
  securitySettings: SecuritySettings
  sessions: UserSession[]
}

export type AuthScreenTab =
  | 'login'
  | 'signup'
  | 'forgot'
  | 'otp-verify'
  | 'new-password'
  | 'google-role-onboarding'

export interface PasswordRecoveryState {
  email: string
  otpCode: string
  expiresAt: number
  step: 'email' | 'otp' | 'new-password' | 'success'
}
