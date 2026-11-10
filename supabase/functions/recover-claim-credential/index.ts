// POST /recover-claim-credential  { lost_item_id, private_attribute_answer }
// Spec §24 recovery: the signed-in owner re-verifies with their private
// ownership detail; a NEW credential is issued, the old hash is replaced
// (invalidated) and the code is returned once. Failed recoveries are
// rate-limited (5 per 24h per item) via audit_logs.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireUser } from '../_shared/supabase.ts'
import { generateClaimCode, hashClaimCode } from '../_shared/crypto.ts'
import {
  ATTEMPT_WINDOW_HOURS,
  MAX_FAILED_ATTEMPTS,
  checkPrivateAnswer,
  textField,
  uuidField,
} from '../_shared/claims.ts'
import { notify } from '../_shared/notify.ts'

serve(async (req, body) => {
  const caller = await requireUser(req)
  const lostItemId = uuidField(body, 'lost_item_id')
  const answer = textField(body, 'private_attribute_answer', 1000)
  const db = adminClient()

  const { data: item } = await db.from('lost_items').select('id, user_id, status, title').eq('id', lostItemId).maybeSingle()
  if (!item || item.user_id !== caller.user.id) throw new HttpError(404, 'Report not found')
  if (['RESOLVED', 'CANCELLED'].includes(item.status)) {
    throw new HttpError(409, 'This report is closed; its credential can no longer be recovered.')
  }

  const since = new Date(Date.now() - ATTEMPT_WINDOW_HOURS * 3600_000).toISOString()
  const { count: recentFailures } = await db
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'FAILED_CREDENTIAL_RECOVERY')
    .eq('entity_id', lostItemId)
    .gt('created_at', since)
  if ((recentFailures ?? 0) >= MAX_FAILED_ATTEMPTS) {
    throw new HttpError(429, 'Too many failed attempts. Please try again tomorrow or contact an administrator.')
  }

  const { passed, onFile } = await checkPrivateAnswer(lostItemId, answer)
  if (!onFile) {
    throw new HttpError(
      409,
      'No private ownership details were recorded for this report, so the credential cannot be recovered online. Please contact an administrator.',
    )
  }
  if (!passed) {
    await audit('FAILED_CREDENTIAL_RECOVERY', { type: 'lost_item', id: lostItemId }, caller.user.id)
    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - (recentFailures ?? 0) - 1)
    throw new HttpError(
      403,
      `That doesn’t match the private details on file. ${remaining} attempt(s) remaining.`,
      'RECOVERY_FAILED',
    )
  }

  const claimCode = generateClaimCode()
  const { error } = await db.from('lost_item_secrets').upsert({
    lost_item_id: lostItemId,
    claim_code_hash: await hashClaimCode(claimCode),
    code_issued_at: new Date().toISOString(),
  })
  if (error) throw error

  await audit('RECOVERED_CLAIM_CREDENTIAL', { type: 'lost_item', id: lostItemId }, caller.user.id)
  await notify({
    user_id: caller.user.id,
    type: 'SYSTEM',
    title: 'Your claim credential was reset',
    message: `A new claim credential was issued for “${item.title}”. The previous code no longer works. If this wasn’t you, contact FoundIT immediately.`,
    link: `/lost/${lostItemId}`,
    email: true,
  })

  return ok({ claim_code: claimCode })
})
