import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import type { ProfileUpdate } from '../services/profile'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isCollectionOfficer: boolean
  /** True after the user followed a password-reset link (PASSWORD_RECOVERY). */
  isPasswordRecovery: boolean
  refreshProfile: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
