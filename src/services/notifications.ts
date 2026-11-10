import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AppNotification, NotificationType } from '../types'

export interface NotificationQuery {
  type?: NotificationType | 'ALL'
  unreadOnly?: boolean
  page?: number
  pageSize?: number
}

export async function getMyNotifications({
  type = 'ALL',
  unreadOnly = false,
  page = 0,
  pageSize = 20,
}: NotificationQuery = {}): Promise<{ rows: AppNotification[]; count: number }> {
  const { data: auth } = await supabase.auth.getUser()
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.user?.id ?? '')
    .eq('channel', 'IN_APP')
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (type !== 'ALL') query = query.eq('type', type)
  if (unreadOnly) query = query.eq('is_read', false)
  const { data, error, count } = await query
  if (error) throw new Error('Could not load notifications.')
  return { rows: data as AppNotification[], count: count ?? 0 }
}

export async function getUnreadCount(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user?.id ?? '')
    .eq('channel', 'IN_APP')
    .eq('is_read', false)
  if (error) throw new Error('Could not load notifications.')
  return count ?? 0
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw new Error('Could not update the notification.')
}

export async function markAllRead(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', auth.user?.id ?? '')
    .eq('is_read', false)
  if (error) throw new Error('Could not update notifications.')
}

/** Live INSERTs for the signed-in user's notifications (Supabase Realtime, RLS-filtered). */
export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: AppNotification) => void,
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as AppNotification
        if (row.channel === 'IN_APP') onInsert(row)
      },
    )
    .subscribe()
}
