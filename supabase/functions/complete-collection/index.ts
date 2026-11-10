// POST /complete-collection  { claim_id, claim_code?, override_reason?, notes? }
// Collection officer (admin with is_collection_officer) hands the item over.
// The claimant presents their claim credential at the desk; if they can't,
// the officer may verify identity manually and give an override reason
// (audited). Closes the case: claim COMPLETED, lost RESOLVED, found RETURNED.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireAdmin } from '../_shared/supabase.ts'
import { hashClaimCode, isWellFormedClaimCode, safeEqual } from '../_shared/crypto.ts'
import { loadClaim, recordAttempt, textField, uuidField } from '../_shared/claims.ts'
import { notify } from '../_shared/notify.ts'

serve(async (req, body) => {
  const officer = await requireAdmin(req)
  if (!officer.isCollectionOfficer) {
    throw new HttpError(403, 'Only collection officers can release items.')
  }

  const claim = await loadClaim(uuidField(body, 'claim_id'))
  if (claim.status !== 'APPROVED') throw new HttpError(409, 'Only approved claims can be collected.')

  const code = textField(body, 'claim_code', 40, false)
  const overrideReason = textField(body, 'override_reason', 500, false)
  const notes = textField(body, 'notes', 1000, false)
  const db = adminClient()

  if (!code && !overrideReason) {
    throw new HttpError(400, 'Enter the claimant’s claim credential, or record why identity was verified manually.')
  }

  if (code) {
    const { data: secret } = await db
      .from('lost_item_secrets')
      .select('claim_code_hash')
      .eq('lost_item_id', claim.lost_item_id)
      .maybeSingle()
    const passed =
      isWellFormedClaimCode(code) &&
      Boolean(secret?.claim_code_hash) &&
      safeEqual(await hashClaimCode(code), secret!.claim_code_hash)
    await recordAttempt(claim, officer.user.id, 'CLAIM_CODE', passed)
    if (!passed) throw new HttpError(403, 'That claim credential is not valid for this claim.', 'INVALID_CODE')
  }

  const now = new Date().toISOString()
  const { data: completed, error } = await db
    .from('claims')
    .update({ status: 'COMPLETED', completed_at: now })
    .eq('id', claim.id)
    .eq('status', 'APPROVED')
    .select('*')
    .single()
  if (error || !completed) throw new HttpError(409, 'The claim changed in the meantime. Refresh and try again.')

  const { error: collectionError } = await db.from('collections').insert({
    claim_id: claim.id,
    collected_by: officer.user.id,
    collected_at: now,
    notes: [notes, overrideReason && `Manual identity verification: ${overrideReason}`].filter(Boolean).join('\n') || null,
  })
  if (collectionError) throw collectionError

  await Promise.all([
    db.from('lost_items').update({ status: 'RESOLVED' }).eq('id', claim.lost_item_id),
    db.from('found_items').update({ status: 'RETURNED' }).eq('id', claim.found_item_id),
    db.from('match_candidates').update({ status: 'DISMISSED' }).eq('found_item_id', claim.found_item_id).eq('status', 'OPEN'),
  ])

  await audit('COMPLETED_COLLECTION', { type: 'claim', id: claim.id }, officer.user.id, {
    verified_by: code ? 'CLAIM_CODE' : 'MANUAL_OVERRIDE',
    override_reason: overrideReason || null,
  })
  await notify({
    user_id: claim.claimant_id,
    type: 'COLLECTION',
    title: 'Your item has been collected',
    message: 'Your item was handed over and your case is closed. Thank you for using FoundIT!',
    link: `/claims/${claim.id}`,
    email: true,
  })

  return ok(completed)
})
