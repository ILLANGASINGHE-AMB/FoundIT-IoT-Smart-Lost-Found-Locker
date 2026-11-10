// POST /approve-claim  { claim_id, collection_point_id?, notes? }
// Admin approves a claim after reviewing ownership. The item becomes ready
// for collection; competing claims on the same found item are rejected.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireAdmin } from '../_shared/supabase.ts'
import { loadClaim, textField, uuidField } from '../_shared/claims.ts'
import { notify } from '../_shared/notify.ts'

serve(async (req, body) => {
  const admin = await requireAdmin(req)
  const claim = await loadClaim(uuidField(body, 'claim_id'))
  const notes = textField(body, 'notes', 1000, false)
  const db = adminClient()

  if (!['PENDING', 'UNDER_REVIEW'].includes(claim.status)) {
    throw new HttpError(409, `Claims that are ${claim.status.toLowerCase()} cannot be approved.`)
  }

  let collectionPointId = claim.collection_point_id
  if (body.collection_point_id) {
    collectionPointId = uuidField(body, 'collection_point_id')
    const { data: point } = await db.from('collection_points').select('id, status').eq('id', collectionPointId).maybeSingle()
    if (!point || point.status !== 'ACTIVE') throw new HttpError(400, 'Choose an active collection point.')
  }
  if (!collectionPointId) throw new HttpError(400, 'Assign the collection point where the owner will collect the item.')

  const now = new Date().toISOString()
  const { data: approved, error } = await db
    .from('claims')
    .update({
      status: 'APPROVED',
      is_locked: false,
      approved_at: now,
      reviewed_at: now,
      reviewed_by: admin.user.id,
      collection_point_id: collectionPointId,
    })
    .eq('id', claim.id)
    .in('status', ['PENDING', 'UNDER_REVIEW'])
    .select('*')
    .single()
  if (error || !approved) throw new HttpError(409, 'The claim changed while you were reviewing it. Refresh and try again.')

  await Promise.all([
    db.from('claim_verifications').insert({
      claim_id: claim.id,
      verification_type: 'ADMIN_REVIEW',
      result: 'PASSED',
      verified_by: admin.user.id,
      notes: notes || 'Ownership approved by administrator.',
    }),
    db.from('lost_items').update({ status: 'CLAIMED' }).eq('id', claim.lost_item_id),
    db.from('found_items').update({ status: 'CLAIMED', collection_point_id: collectionPointId }).eq('id', claim.found_item_id),
  ])

  // Only one owner can get the item: reject competing active claims.
  const { data: competing } = await db
    .from('claims')
    .update({
      status: 'REJECTED',
      rejected_at: now,
      reviewed_at: now,
      reviewed_by: admin.user.id,
      rejection_reason: 'The item was released to another verified owner.',
      is_locked: false,
    })
    .eq('found_item_id', claim.found_item_id)
    .neq('id', claim.id)
    .in('status', ['PENDING', 'UNDER_REVIEW'])
    .select('id, claimant_id, lost_item_id')
  for (const other of competing ?? []) {
    await db.from('lost_items').update({ status: 'LOST' }).eq('id', other.lost_item_id).eq('status', 'CLAIM_PENDING')
    await notify({
      user_id: other.claimant_id,
      type: 'CLAIM',
      title: 'Your claim was not approved',
      message: 'The item was released to another verified owner. Your lost report stays open for new matches.',
      link: `/claims/${other.id}`,
      email: true,
    })
  }

  const { data: point } = await db.from('collection_points').select('name, address').eq('id', collectionPointId).single()
  await audit('APPROVED_CLAIM', { type: 'claim', id: claim.id }, admin.user.id, {
    collection_point_id: collectionPointId,
    competing_rejected: competing?.length ?? 0,
  })
  await notify({
    user_id: claim.claimant_id,
    type: 'COLLECTION',
    title: 'Your claim has been approved — your item is ready for collection',
    message: `Collect it at ${point?.name ?? 'the FoundIT Box'}${point?.address ? ` (${point.address})` : ''}. Bring your claim credential.`,
    link: `/claims/${claim.id}`,
    email: true,
  })

  return ok(approved)
})
