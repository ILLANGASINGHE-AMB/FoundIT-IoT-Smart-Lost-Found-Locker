// POST /submit-claim  { match_candidate_id }
// Opens a claim (status PENDING) for an OPEN match candidate. The owner of
// the lost item claims for themselves; an admin may open one on the
// owner's behalf ("Convert to claim"). Admins are notified.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireUser } from '../_shared/supabase.ts'
import { uuidField } from '../_shared/claims.ts'
import { notify } from '../_shared/notify.ts'

serve(async (req, body) => {
  const caller = await requireUser(req)
  const matchId = uuidField(body, 'match_candidate_id')
  const db = adminClient()

  const { data: match } = await db
    .from('match_candidates')
    .select('id, status, lost_item_id, found_item_id, lost_item:lost_items(user_id, status, title), found_item:found_items(status, collection_point_id)')
    .eq('id', matchId)
    .maybeSingle()

  // deno-lint-ignore no-explicit-any
  const m = match as any
  if (!m || (m.lost_item.user_id !== caller.user.id && caller.role !== 'admin')) {
    throw new HttpError(404, 'Match not found')
  }

  // Already claimed from this match? Return the existing claim (idempotent).
  const { data: existing } = await db
    .from('claims')
    .select('*')
    .eq('match_candidate_id', matchId)
    .in('status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
    .maybeSingle()
  if (existing) return ok(existing)

  if (m.status !== 'OPEN') throw new HttpError(409, 'This match can no longer be claimed.')
  if (!['LOST', 'MATCHED'].includes(m.lost_item.status)) {
    throw new HttpError(409, 'Your lost report is no longer open for claims.')
  }
  if (!['FOUND', 'IN_STORAGE', 'MATCHED', 'CLAIM_PENDING'].includes(m.found_item.status)) {
    throw new HttpError(409, 'This found item is no longer available to claim.')
  }

  const { data: claim, error } = await db
    .from('claims')
    .insert({
      match_candidate_id: matchId,
      lost_item_id: m.lost_item_id,
      found_item_id: m.found_item_id,
      claimant_id: m.lost_item.user_id,
      collection_point_id: m.found_item.collection_point_id,
      status: 'PENDING',
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You already have an active claim for this item.')
    throw error
  }

  await Promise.all([
    db.from('match_candidates').update({ status: 'CONVERTED_TO_CLAIM' }).eq('id', matchId),
    db.from('lost_items').update({ status: 'CLAIM_PENDING' }).eq('id', m.lost_item_id),
    db
      .from('found_items')
      .update({ status: 'CLAIM_PENDING' })
      .eq('id', m.found_item_id)
      .in('status', ['FOUND', 'IN_STORAGE', 'MATCHED']),
  ])

  await audit('SUBMITTED_CLAIM', { type: 'claim', id: claim.id }, caller.user.id, {
    match_candidate_id: matchId,
    on_behalf: caller.user.id !== m.lost_item.user_id,
  })
  await notify({
    toAdmins: true,
    type: 'CLAIM',
    title: 'New claim submitted',
    message: `A claim was opened for “${m.lost_item.title}”.`,
    link: `/admin/claims/${claim.id}`,
  })

  return ok(claim, 201)
})
