// POST /notify-user  (internal: service-role callers only)
// { user_id? | toAdmins?, title, message, type, link?, email? }
// Spec §33: creates the IN_APP notification row (Realtime pushes it to open
// tabs) and, for critical events, also sends an email via Resend.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, isServiceCall } from '../_shared/supabase.ts'
import { renderEmail, sendEmail } from '../_shared/email.ts'

const TYPES = new Set(['MATCH', 'CLAIM', 'COLLECTION', 'SYSTEM'])

serve(async (req, body) => {
  if (!isServiceCall(req)) throw new HttpError(403, 'notify-user is internal.')

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  const type = typeof body.type === 'string' && TYPES.has(body.type) ? body.type : 'SYSTEM'
  const link = typeof body.link === 'string' && body.link.startsWith('/') ? body.link : null
  if (!title || !message) throw new HttpError(400, 'title and message are required')

  const db = adminClient()
  let recipients: { id: string; email: string }[] = []
  if (body.toAdmins === true) {
    const { data } = await db.from('profiles').select('id, email').eq('role', 'admin')
    recipients = data ?? []
  } else if (typeof body.user_id === 'string') {
    const { data } = await db.from('profiles').select('id, email').eq('id', body.user_id).maybeSingle()
    if (data) recipients = [data]
  }
  if (recipients.length === 0) return ok({ delivered: 0, emailed: 0 })

  const { error } = await db.from('notifications').insert(
    recipients.map((r) => ({ user_id: r.id, title, message, type, channel: 'IN_APP', link })),
  )
  if (error) throw error

  let emailed = 0
  if (body.email === true) {
    const html = renderEmail(title, message, link)
    const results = await Promise.all(recipients.map((r) => sendEmail(r.email, title, html)))
    const sentTo = recipients.filter((_, i) => results[i])
    emailed = sentTo.length
    if (sentTo.length > 0) {
      // Record the email delivery (already "read": it never shows in the bell).
      await db.from('notifications').insert(
        sentTo.map((r) => ({ user_id: r.id, title, message, type, channel: 'EMAIL', link, is_read: true })),
      )
    }
  }

  return ok({ delivered: recipients.length, emailed })
})
