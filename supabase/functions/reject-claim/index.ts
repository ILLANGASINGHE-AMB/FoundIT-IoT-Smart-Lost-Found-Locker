// POST /reject-claim  { claim_id, reason }
// Admin rejects a claim. Item statuses roll back so matching continues.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireAdmin } from '../_shared/supabase.ts'
import { loadClaim, releaseItemsAfterClaim, textField, uuidField } from '../_shared/claims.ts'
import { notify } from '../_shared/notify.ts'

serve(async (req, body) => {
  const admin = await requireAdmin(req)
  const claim = await loadClaim(uuidField(body, 'claim_id'))
  const reason = textField(body, 'reason', 500)
  const db = adminClient()

  if (!['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(claim.status)) {
    throw new HttpError(409, `Claims that are ${claim.status.toLowerCase()} cannot be rejected.`)
  }

  const now = new Date().toISOString()
  const { data: rejected, error } = await db
    .from('claims')
    .update({
      status: 'REJECTED',
      is_locked: false,
      rejected_at: now,
      reviewed_at: now,
      reviewed_by: admin.user.id,
      rejection_reason: reason,
    })
    .eq('id', claim.id)
    .eq('status', claim.status)
    .select('*')
    .single()
  if (error || !rejected) throw new HttpError(409, 'The claim changed while you were reviewing it. Refresh and try again.')

  await db.from('claim_verifications').insert({
    claim_id: claim.id,
    verification_type: 'ADMIN_REVIEW',
    result: 'FAILED',
    verified_by: admin.user.id,
    notes: reason,
  })
  await releaseItemsAfterClaim(claim)

  await audit('REJECTED_CLAIM', { type: 'claim', id: claim.id }, admin.user.id, { reason })
  await notify({
    user_id: claim.claimant_id,
    type: 'CLAIM',
    title: 'Your claim has been rejected',
    message: `Reason: ${reason}. Your lost report stays open and we’ll keep looking for matches.`,
    link: `/claims/${claim.id}`,
    email: true,
  })

  return ok(rejected)
})
