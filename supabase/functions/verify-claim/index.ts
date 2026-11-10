// POST /verify-claim  { claim_id, private_attribute_answer }
// Step 1 of claim verification (spec §23 method 1/4): the claimant answers
// with their private ownership detail; it is fuzzy-compared server-side
// with what they recorded when reporting the item. Every attempt is logged
// in claim_attempts; 5 failures in 24h lock the claim for admin review.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import {
  assertClaimant,
  assertNotLocked,
  checkPrivateAnswer,
  failedAttempts,
  hasPassed,
  loadClaim,
  MAX_FAILED_ATTEMPTS,
  recordAttempt,
  textField,
  uuidField,
} from '../_shared/claims.ts'

serve(async (req, body) => {
  const caller = await requireUser(req)
  const claim = await loadClaim(uuidField(body, 'claim_id'))
  assertClaimant(claim, caller)
  if (claim.status !== 'PENDING') throw new HttpError(409, 'This claim is not awaiting verification.')
  assertNotLocked(claim)

  if (await hasPassed(claim.id, 'PRIVATE_ATTRIBUTE')) {
    return ok({
      result: 'PASSED',
      remaining_attempts: MAX_FAILED_ATTEMPTS - (await failedAttempts(claim.id)),
      locked: false,
      next_step: 'CLAIM_CODE',
    })
  }

  const answer = textField(body, 'private_attribute_answer', 1000)
  const db = adminClient()
  const { passed, onFile } = await checkPrivateAnswer(claim.lost_item_id, answer)

  // Keep the answer on the claim so the reviewer can compare it with the item.
  await db.from('claims').update({ private_attribute_answer: answer }).eq('id', claim.id)

  if (!onFile) {
    // Nothing recorded at report time: nothing to auto-check, so the step
    // passes and the reviewer compares the answer with the physical item.
    await db.from('claim_verifications').insert({
      claim_id: claim.id,
      verification_type: 'PRIVATE_ATTRIBUTE',
      result: 'PASSED',
      notes: 'No private details on file — reviewer must compare the answer with the item.',
    })
    return ok({
      result: 'PASSED',
      remaining_attempts: MAX_FAILED_ATTEMPTS - (await failedAttempts(claim.id)),
      locked: false,
      next_step: 'CLAIM_CODE',
    })
  }

  const outcome = await recordAttempt(claim, caller.user.id, 'PRIVATE_ATTRIBUTE', passed)
  if (passed) {
    await db.from('claim_verifications').insert({
      claim_id: claim.id,
      verification_type: 'PRIVATE_ATTRIBUTE',
      result: 'PASSED',
      notes: 'Answer matched the private ownership details on file.',
    })
  }

  return ok({ ...outcome, next_step: passed ? 'CLAIM_CODE' : outcome.locked ? 'LOCKED' : 'PRIVATE_ATTRIBUTE' })
})
