import { adminClient, env } from './supabase.ts'

export type NotificationType = 'MATCH' | 'CLAIM' | 'COLLECTION' | 'SYSTEM'

export interface NotifyInput {
  /** Recipient. Use `toAdmins` instead to notify every administrator. */
  user_id?: string
  toAdmins?: boolean
  title: string
  message: string
  type: NotificationType
  link?: string
  /** Also send an email for critical events (spec §33). */
  email?: boolean
}

/**
 * Deliver a notification through the Notifications module's `notify-user`
 * Edge Function (in-app + email). If that function is not deployed yet,
 * fall back to an in-app row so nothing is lost. Never throws.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/notify-user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    await res.body?.cancel()
    if (res.ok) return
    if (res.status !== 404) {
      console.warn('notify-user failed with', res.status)
      return
    }
  } catch (err) {
    console.warn('notify-user unreachable:', err instanceof Error ? err.message : err)
  }

  try {
    const db = adminClient()
    let recipients: string[] = input.user_id ? [input.user_id] : []
    if (input.toAdmins) {
      const { data } = await db.from('profiles').select('id').eq('role', 'admin')
      recipients = (data ?? []).map((r: { id: string }) => r.id)
    }
    if (recipients.length === 0) return
    await db.from('notifications').insert(
      recipients.map((user_id) => ({
        user_id,
        title: input.title,
        message: input.message,
        type: input.type,
        channel: 'IN_APP',
        link: input.link ?? null,
      })),
    )
  } catch (err) {
    console.error('fallback notification failed:', err instanceof Error ? err.message : err)
  }
}
