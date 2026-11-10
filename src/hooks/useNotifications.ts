import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { getMyNotifications, getUnreadCount, subscribeToNotifications } from '../services/notifications'
import { useAuth } from './useAuth'

/**
 * Keeps notification queries live: one Realtime subscription per signed-in
 * user refreshes the unread badge / lists and pops a toast on arrival.
 * Mount once (in the top bar).
 */
export function useNotificationsRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return
    const channel = subscribeToNotifications(user.id, (n) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      // Related data likely changed too (new match, claim decision, …).
      if (n.type === 'MATCH') queryClient.invalidateQueries({ queryKey: ['matches'] })
      if (n.type === 'CLAIM' || n.type === 'COLLECTION') queryClient.invalidateQueries({ queryKey: ['claims'] })
      toast(n.title, { description: n.message })
    })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])
}

export function useUnreadCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    enabled: Boolean(user),
    refetchInterval: 120_000, // safety net if the socket drops
    meta: { silent: true },
  })
}

export function useRecentNotifications(limit = 5) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notifications', 'recent', limit],
    queryFn: () => getMyNotifications({ pageSize: limit }).then((r) => r.rows),
    enabled: Boolean(user),
    meta: { silent: true },
  })
}
