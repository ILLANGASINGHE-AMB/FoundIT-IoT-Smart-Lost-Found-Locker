import type { UserProfile, UserRole, SecuritySettings } from '../types/auth'
import emailjs from '@emailjs/browser'

const USERS_KEY = 'foundit_db_users'
const CURRENT_SESSION_KEY = 'foundit_auth_session'
const OTP_STORAGE_KEY = 'foundit_otp_tokens'

interface OTPRecord {
  email: string
  code: string
  expiresAt: number
}

// Seed Accounts
const SEED_USERS: Record<string, UserProfile & { passwordHash: string }> = {
  'u-1': {
    id: 'u-1',
    email: 'member@foundit.com',
    passwordHash: 'password123',
    fullName: 'Alex Morgan',
    role: 'member',
    provider: 'local',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    phone: '+1 (555) 234-5678',
    address: '742 Evergreen Terrace, Springfield',
    bio: 'Frequent commuter & IoT tech enthusiast. Always keeping an eye out for lost items.',
    emergencyContact: 'Sarah Morgan (+1 555 987-6543)',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: new Date().toISOString(),
    rememberMe: true,
    securitySettings: {
      twoFactorEnabled: false,
      loginAlerts: true,
      emailNotifications: true,
      publicProfile: true,
    },
    sessions: [
      {
        id: 's-1',
        device: 'Windows PC (Chrome 128)',
        browser: 'Chrome 128.0',
        ip: '192.168.1.45',
        location: 'City Center, Hub',
        lastActive: 'Just now',
        isCurrent: true,
      },
    ],
  },
  'u-2': {
    id: 'u-2',
    email: 'staff@foundit.com',
    passwordHash: 'password123',
    fullName: 'Officer Marcus Vance',
    role: 'staff',
    provider: 'local',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    phone: '+1 (555) 888-4321',
    address: 'Downtown Locker Depot, Bay 4',
    bio: 'Certified Locker Station Manager & Verification Specialist at Central Station Branch.',
    emergencyContact: 'HQ Operations (+1 555 000-1122)',
    assignedBranch: 'Central Station Hub',
    employeeId: 'STF-9942',
    department: 'Locker Operations & Custody',
    createdAt: '2025-11-01T08:30:00Z',
    updatedAt: new Date().toISOString(),
    rememberMe: true,
    securitySettings: {
      twoFactorEnabled: true,
      loginAlerts: true,
      emailNotifications: true,
      publicProfile: false,
    },
    sessions: [
      {
        id: 's-3',
        device: 'Locker Kiosk Terminal #04',
        browser: 'FoundIT Embedded Browser',
        ip: '172.16.0.4',
        location: 'Central Station - Bay 4',
        lastActive: 'Just now',
        isCurrent: true,
      },
    ],
  },
  'u-3': {
    id: 'u-3',
    email: 'admin@foundit.com',
    passwordHash: 'password123',
    fullName: 'System Administrator',
    role: 'admin',
    provider: 'local',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    phone: '+1 (555) 000-9999',
    address: 'FoundIT Headquarters, Tech Tower 12',
    bio: 'Global Locker Fleet Operations, Security Compliance & Admin Manager.',
    emergencyContact: 'Security Desk (+1 555 911-0000)',
    employeeId: 'ADM-0001',
    department: 'System Architecture & IoT Infra',
    createdAt: '2025-08-10T12:00:00Z',
    updatedAt: new Date().toISOString(),
    rememberMe: true,
    securitySettings: {
      twoFactorEnabled: true,
      loginAlerts: true,
      emailNotifications: true,
      publicProfile: false,
    },
    sessions: [
      {
        id: 's-4',
        device: 'MacBook Pro (Firefox 120)',
        browser: 'Firefox 120.0',
        ip: '10.200.4.1',
        location: 'Headquarters',
        lastActive: 'Just now',
        isCurrent: true,
      },
    ],
  },
}

export class LocalDbService {
  private static getUsersFromStorage(): Record<string, UserProfile & { passwordHash: string }> {
    try {
      const data = localStorage.getItem(USERS_KEY)
      if (!data) {
        localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS))
        return SEED_USERS
      }
      return JSON.parse(data)
    } catch {
      return SEED_USERS
    }
  }

  private static saveUsersToStorage(users: Record<string, UserProfile & { passwordHash: string }>) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users))
    } catch (e) {
      console.error('Failed to save to local DB', e)
    }
  }

  private static setSessionStorage(profile: UserProfile, rememberMe: boolean) {
    const clean = JSON.stringify(profile)
    if (rememberMe) {
      localStorage.setItem(CURRENT_SESSION_KEY, clean)
      sessionStorage.removeItem(CURRENT_SESSION_KEY)
    } else {
      sessionStorage.setItem(CURRENT_SESSION_KEY, clean)
      localStorage.removeItem(CURRENT_SESSION_KEY)
    }
  }

  // --- Auth Methods ---
  static async login(email: string, password: string, rememberMe = true): Promise<UserProfile> {
    await new Promise((res) => setTimeout(res, 350))
    const users = this.getUsersFromStorage()
    const user = Object.values(users).find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim()
    )

    if (!user) {
      throw new Error('No account found with this email address.')
    }

    if (user.passwordHash !== password) {
      throw new Error('Incorrect password. Please try again.')
    }

    user.rememberMe = rememberMe
    user.updatedAt = new Date().toISOString()
    users[user.id] = user
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = user
    this.setSessionStorage(cleanProfile, rememberMe)
    return cleanProfile
  }

  static async signup(data: {
    email: string
    password: string
    fullName: string
    role: UserRole
    phone?: string
    address?: string
    assignedBranch?: string
    rememberMe?: boolean
  }): Promise<UserProfile> {
    await new Promise((res) => setTimeout(res, 450))
    const users = this.getUsersFromStorage()

    const existing = Object.values(users).find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase().trim()
    )
    if (existing) {
      throw new Error('An account with this email address already exists.')
    }

    const newId = `u-${Date.now()}`
    const rememberMe = data.rememberMe ?? true

    const newUserRecord: UserProfile & { passwordHash: string } = {
      id: newId,
      email: data.email.trim(),
      passwordHash: data.password,
      fullName: data.fullName.trim(),
      role: data.role,
      provider: 'local',
      phone: data.phone || '',
      address: data.address || '',
      assignedBranch: data.assignedBranch || '',
      bio: `Registered as ${data.role.toUpperCase()} on FoundIT.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rememberMe,
      securitySettings: {
        twoFactorEnabled: false,
        loginAlerts: true,
        emailNotifications: true,
        publicProfile: true,
      },
      sessions: [
        {
          id: `s-${Date.now()}`,
          device: 'Browser Session',
          browser: 'Web',
          ip: '127.0.0.1',
          location: 'Local Region',
          lastActive: 'Just now',
          isCurrent: true,
        },
      ],
    }

    users[newId] = newUserRecord
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = newUserRecord
    this.setSessionStorage(cleanProfile, rememberMe)

    return cleanProfile
  }

  // --- Google OAuth Simulation ---
  static async loginOrSignupWithGoogle(googlePayload: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
  }): Promise<{ user: UserProfile | null; needsRoleOnboarding: boolean }> {
    await new Promise((res) => setTimeout(res, 400))
    const users = this.getUsersFromStorage()

    // Match by googleId or email
    const existing = Object.values(users).find(
      (u) =>
        (u.googleId && u.googleId === googlePayload.googleId) ||
        u.email.toLowerCase() === googlePayload.email.toLowerCase()
    )

    if (existing) {
      // Update Google metadata if needed
      existing.provider = 'google'
      existing.googleId = googlePayload.googleId
      existing.avatarUrl = existing.avatarUrl || googlePayload.avatarUrl
      existing.updatedAt = new Date().toISOString()
      users[existing.id] = existing
      this.saveUsersToStorage(users)

      const { passwordHash: _, ...cleanProfile } = existing
      this.setSessionStorage(cleanProfile, true)
      return { user: cleanProfile, needsRoleOnboarding: false }
    }

    // New Google User needs role selection onboarding
    return { user: null, needsRoleOnboarding: true }
  }

  static async completeGoogleOnboarding(data: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
    role: UserRole
    assignedBranch?: string
  }): Promise<UserProfile> {
    await new Promise((res) => setTimeout(res, 400))
    const users = this.getUsersFromStorage()

    const newId = `u-g-${Date.now()}`
    const newUserRecord: UserProfile & { passwordHash: string } = {
      id: newId,
      email: data.email,
      passwordHash: `google-oauth-${Date.now()}`,
      fullName: data.fullName,
      role: data.role,
      provider: 'google',
      googleId: data.googleId,
      avatarUrl: data.avatarUrl,
      assignedBranch: data.assignedBranch || '',
      bio: `Signed up via Google as ${data.role.toUpperCase()}.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rememberMe: true,
      securitySettings: {
        twoFactorEnabled: false,
        loginAlerts: true,
        emailNotifications: true,
        publicProfile: true,
      },
      sessions: [
        {
          id: `s-${Date.now()}`,
          device: 'Google OAuth Session',
          browser: 'Web',
          ip: '127.0.0.1',
          location: 'Google Sign-In',
          lastActive: 'Just now',
          isCurrent: true,
        },
      ],
    }

    users[newId] = newUserRecord
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = newUserRecord
    this.setSessionStorage(cleanProfile, true)
    return cleanProfile
  }

  static async logout(): Promise<void> {
    localStorage.removeItem(CURRENT_SESSION_KEY)
    sessionStorage.removeItem(CURRENT_SESSION_KEY)
  }

  static getSavedSession(): UserProfile | null {
    try {
      const localData = localStorage.getItem(CURRENT_SESSION_KEY)
      if (localData) return JSON.parse(localData)

      const sessionData = sessionStorage.getItem(CURRENT_SESSION_KEY)
      if (sessionData) return JSON.parse(sessionData)

      return null
    } catch {
      return null
    }
  }

  // --- Password Recovery OTP Methods ---
  static async sendPasswordResetOTP(email: string): Promise<{ otpCode: string; expiresAt: number }> {
    await new Promise((res) => setTimeout(res, 400))
    const users = this.getUsersFromStorage()
    const user = Object.values(users).find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim()
    )

    if (!user) {
      throw new Error('No account is registered with this email address.')
    }

    // Generate 6-digit OTP code (e.g. 482910)
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 mins

    const otps: Record<string, OTPRecord> = JSON.parse(
      localStorage.getItem(OTP_STORAGE_KEY) || '{}'
    )
    otps[email.toLowerCase()] = { email: email.toLowerCase(), code, expiresAt }
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otps))

    // Attempt to send via EmailJS
    try {
      await emailjs.send(
        'YOUR_SERVICE_ID', // e.g. 'service_xxxxx'
        'YOUR_TEMPLATE_ID', // e.g. 'template_xxxxx'
        {
          to_email: email,
          to_name: user.fullName,
          otp_code: code,
          reply_to: 'no-reply@foundit.com',
        },
        'YOUR_PUBLIC_KEY' // e.g. 'public_key_xxxx'
      )
    } catch (e) {
      console.warn('EmailJS not fully configured yet. Code generated locally.', e)
    }

    return { otpCode: code, expiresAt }
  }

  static async verifyOTP(email: string, code: string): Promise<boolean> {
    await new Promise((res) => setTimeout(res, 300))
    const otps: Record<string, OTPRecord> = JSON.parse(
      localStorage.getItem(OTP_STORAGE_KEY) || '{}'
    )
    const record = otps[email.toLowerCase()]

    if (!record) {
      throw new Error('No OTP request found for this email. Please request a new code.')
    }

    if (Date.now() > record.expiresAt) {
      throw new Error('The OTP code has expired. Please request a new code.')
    }

    if (record.code !== code.trim()) {
      throw new Error('Invalid OTP verification code. Please check and try again.')
    }

    return true
  }

  static async resetPasswordWithOTP(
    email: string,
    code: string,
    newPassword: string
  ): Promise<void> {
    await new Promise((res) => setTimeout(res, 400))
    await this.verifyOTP(email, code)

    const users = this.getUsersFromStorage()
    const user = Object.values(users).find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim()
    )

    if (!user) throw new Error('Account not found.')

    user.passwordHash = newPassword
    user.updatedAt = new Date().toISOString()
    users[user.id] = user
    this.saveUsersToStorage(users)

    // Clear used OTP
    const otps: Record<string, OTPRecord> = JSON.parse(
      localStorage.getItem(OTP_STORAGE_KEY) || '{}'
    )
    delete otps[email.toLowerCase()]
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otps))
  }

  // --- Profile Methods ---
  static async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    await new Promise((res) => setTimeout(res, 350))
    const users = this.getUsersFromStorage()
    const user = users[userId]
    if (!user) throw new Error('User not found.')

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    users[userId] = updatedUser
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = updatedUser
    this.setSessionStorage(cleanProfile, cleanProfile.rememberMe ?? true)
    return cleanProfile
  }

  static async changePassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): Promise<void> {
    await new Promise((res) => setTimeout(res, 400))
    const users = this.getUsersFromStorage()
    const user = users[userId]
    if (!user) throw new Error('User not found.')

    if (user.passwordHash !== currentPass) {
      throw new Error('Current password does not match.')
    }

    user.passwordHash = newPass
    user.updatedAt = new Date().toISOString()
    users[userId] = user
    this.saveUsersToStorage(users)
  }

  static async updateSecuritySettings(
    userId: string,
    settings: Partial<SecuritySettings>
  ): Promise<UserProfile> {
    const users = this.getUsersFromStorage()
    const user = users[userId]
    if (!user) throw new Error('User not found.')

    user.securitySettings = {
      ...user.securitySettings,
      ...settings,
    }
    user.updatedAt = new Date().toISOString()
    users[userId] = user
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = user
    this.setSessionStorage(cleanProfile, cleanProfile.rememberMe ?? true)
    return cleanProfile
  }

  static async revokeSession(userId: string, sessionId: string): Promise<UserProfile> {
    const users = this.getUsersFromStorage()
    const user = users[userId]
    if (!user) throw new Error('User not found.')

    user.sessions = user.sessions.filter((s) => s.id !== sessionId)
    users[userId] = user
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = user
    this.setSessionStorage(cleanProfile, cleanProfile.rememberMe ?? true)
    return cleanProfile
  }

  // --- Admin User Management Methods ---
  static async getAllUsers(): Promise<UserProfile[]> {
    await new Promise((res) => setTimeout(res, 200))
    const users = this.getUsersFromStorage()
    return Object.values(users).map((u) => {
      const { passwordHash: _, ...cleanProfile } = u
      return cleanProfile
    })
  }

  static async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    await new Promise((res) => setTimeout(res, 300))
    const users = this.getUsersFromStorage()
    if (!users[userId]) {
      throw new Error('User not found.')
    }
    const updatedUser = { ...users[userId], ...updates, updatedAt: new Date().toISOString() }
    users[userId] = updatedUser
    this.saveUsersToStorage(users)

    const { passwordHash: _, ...cleanProfile } = updatedUser
    return cleanProfile
  }

  static async deleteUser(userId: string): Promise<boolean> {
    await new Promise((res) => setTimeout(res, 300))
    const users = this.getUsersFromStorage()
    if (!users[userId]) {
      throw new Error('User not found.')
    }
    delete users[userId]
    this.saveUsersToStorage(users)
    return true
  }
}
