import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { signOut } from '../services/auth'
import { getProfile, updateProfile as updateProfileRow, type ProfileUpdate } from '../services/profile'
import type { Profile } from '../types'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const userId = session?.user.id

  // 1. Restore the session and listen for auth changes.
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setIsPasswordRecovery(false)
        queryClient.clear()
      }
      setSession(next)
      if (!next) setIsLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [queryClient])

  // 2. Load the profile row whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return
    let active = true
    setIsLoading(true)
    getProfile(userId)
      .then((row) => active && setProfile(row))
      .catch(() => active && setProfile(null))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    setProfile(await getProfile(userId))
  }, [userId])

  const updateProfile = useCallback(
    async (updates: ProfileUpdate) => {
      if (!userId) return
      setProfile(await updateProfileRow(userId, updates))
    },
    [userId],
  )

  const logout = useCallback(async () => {
    await signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      isAuthenticated: Boolean(session),
      isAdmin: profile?.role === 'admin',
      isCollectionOfficer: profile?.role === 'admin' && Boolean(profile?.is_collection_officer),
      isPasswordRecovery,
      refreshProfile,
      updateProfile,
      logout,
    }),
    [session, profile, isLoading, isPasswordRecovery, refreshProfile, updateProfile, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
