import React, { createContext, useContext, useState, useEffect } from 'react'
import type { UserProfile, UserRole, SecuritySettings } from '../types/auth'
import { LocalDbService } from '../services/localDb'

interface AuthContextType {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<void>
  signup: (data: {
    email: string
    password: string
    fullName: string
    role: UserRole
    phone?: string
    address?: string
    assignedBranch?: string
    rememberMe?: boolean
  }) => Promise<void>
  loginOrSignupWithGoogle: (payload: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
  }) => Promise<{ user: UserProfile | null; needsRoleOnboarding: boolean }>
  completeGoogleOnboarding: (data: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
    role: UserRole
    assignedBranch?: string
  }) => Promise<void>
  sendPasswordResetOTP: (email: string) => Promise<{ otpCode: string; expiresAt: number }>
  verifyOTP: (email: string, code: string) => Promise<boolean>
  resetPasswordWithOTP: (email: string, code: string, newPass: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  changePassword: (currentPass: string, newPass: string) => Promise<void>
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => Promise<void>
  revokeSession: (sessionId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    // Restore session on mount
    const saved = LocalDbService.getSavedSession()
    if (saved) {
      setUser(saved)
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, pass: string, rememberMe = true) => {
    const profile = await LocalDbService.login(email, pass, rememberMe)
    setUser(profile)
  }

  const signup = async (data: {
    email: string
    password: string
    fullName: string
    role: UserRole
    phone?: string
    address?: string
    assignedBranch?: string
    rememberMe?: boolean
  }) => {
    const profile = await LocalDbService.signup(data)
    setUser(profile)
  }

  const loginOrSignupWithGoogle = async (payload: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
  }) => {
    const result = await LocalDbService.loginOrSignupWithGoogle(payload)
    if (result.user) {
      setUser(result.user)
    }
    return result
  }

  const completeGoogleOnboarding = async (data: {
    googleId: string
    email: string
    fullName: string
    avatarUrl: string
    role: UserRole
    assignedBranch?: string
  }) => {
    const profile = await LocalDbService.completeGoogleOnboarding(data)
    setUser(profile)
  }

  const sendPasswordResetOTP = async (email: string) => {
    return await LocalDbService.sendPasswordResetOTP(email)
  }

  const verifyOTP = async (email: string, code: string) => {
    return await LocalDbService.verifyOTP(email, code)
  }

  const resetPasswordWithOTP = async (email: string, code: string, newPass: string) => {
    await LocalDbService.resetPasswordWithOTP(email, code, newPass)
  }

  const logout = async () => {
    await LocalDbService.logout()
    setUser(null)
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return
    const updated = await LocalDbService.updateProfile(user.id, updates)
    setUser(updated)
  }

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user) return
    await LocalDbService.changePassword(user.id, currentPass, newPass)
  }

  const updateSecuritySettings = async (settings: Partial<SecuritySettings>) => {
    if (!user) return
    const updated = await LocalDbService.updateSecuritySettings(user.id, settings)
    setUser(updated)
  }

  const revokeSession = async (sessionId: string) => {
    if (!user) return
    const updated = await LocalDbService.revokeSession(user.id, sessionId)
    setUser(updated)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        loginOrSignupWithGoogle,
        completeGoogleOnboarding,
        sendPasswordResetOTP,
        verifyOTP,
        resetPasswordWithOTP,
        logout,
        updateProfile,
        changePassword,
        updateSecuritySettings,
        revokeSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
