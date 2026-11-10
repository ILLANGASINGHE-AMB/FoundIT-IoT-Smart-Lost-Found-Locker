// POST /verify-claim-code  { claim_id, claim_code }
// Step 2 of claim verification (spec §24): the claim credential issued when
// the item was reported is hashed and compared with the stored HMAC.
// Same 5-failure lock policy. On success the claim moves to UNDER_REVIEW
// and admins are asked to review it.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireUser } from '../_shared/supabase.ts'
import { hashClaimCode, isWellFormedClaimCode, safeEqual } from '../_shared/crypto.ts'
import {
  assertClaimant,
  assertNotLocked,
  hasPassed,
  loadClaim,
  recordAttempt,
  textField,
  uuidField,
} from '../_shared/claims.ts'
import { notify } from '../_shared/notify.ts'

serve(async (req, body) => {
  const caller = await requireUser(req)
  const claim = await loadClaim(uuidField(body, 'claim_id'))
  assertClaimant(claim, caller)
  if (claim.status !== 'PENDING') throw new HttpError(409, 'This claim is not awaiting verification.')
  assertNotLocked(claim)

  if (!(await hasPassed(claim.id, 'PRIVATE_ATTRIBUTE'))) {
    throw new HttpError(409, 'Answer the private ownership question first.')
  }

  const code = textField(body, 'claim_code', 40)
  const db = adminClient()
  const { data: secret } = await db
    .from('lost_item_secrets')
    .select('claim_code_hash')
    .eq('lost_item_id', claim.lost_item_id)
    .maybeSingle()

  const passed =
    isWellFormedClaimCode(code) &&
    Boolean(secret?.claim_code_hash) &&
    safeEqual(await hashClaimCode(code), secret!.claim_code_hash)

  const outcome = await recordAttempt(claim, caller.user.id, 'CLAIM_CODE', passed)

  if (passed) {
    await db.from('claim_verifications').insert({
      claim_id: claim.id,
      verification_type: 'CLAIM_CODE',
      result: 'PASSED',
      notes: 'Claim credential verified.',
    })
    await db.from('claims').update({ status: 'UNDER_REVIEW' }).eq('id', claim.id)
    await audit('VERIFIED_CLAIM', { type: 'claim', id: claim.id }, caller.user.id)
    await notify({
      toAdmins: true,
      type: 'CLAIM',
      title: 'Claim verified — ready for review',
      message: 'A claimant passed both verification steps. Review and approve or reject the claim.',
      link: `/admin/claims/${claim.id}`,
    })
  }

  return ok({ ...outcome, next_step: passed ? 'REVIEW' : outcome.locked ? 'LOCKED' : 'CLAIM_CODE' })
})
