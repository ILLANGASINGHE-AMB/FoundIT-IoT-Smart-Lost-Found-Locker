// POST /create-lost-item
// Creates a lost report for the signed-in user. Identifier values are
// HMAC'd server-side (never stored raw) and a claim credential is issued:
// only its hash is stored, the plain code is returned exactly once.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireUser, runInBackground } from '../_shared/supabase.ts'
import { generateClaimCode, hashClaimCode, hmacIdentifier } from '../_shared/crypto.ts'
import { lostItemInput, parseOrThrow, requestMatching } from '../_shared/items.ts'

serve(async (req, body) => {
  const { user } = await requireUser(req)
  const input = parseOrThrow(lostItemInput, body)
  const db = adminClient()

  const identifierHmac =
    input.identifier_type && input.identifier_value
      ? await hmacIdentifier(input.identifier_type, input.identifier_value)
      : null

  const { data: item, error } = await db
    .from('lost_items')
    .insert({
      user_id: user.id,
      category_id: input.category_id,
      location_id: input.location_id,
      title: input.title,
      description: input.description,
      brand: input.brand,
      model: input.model,
      color: input.color,
      identifier_type: input.identifier_value ? input.identifier_type : null,
      date_lost: input.date_lost,
    })
    .select('id, title, status, created_at')
    .single()

  if (error || !item) {
    if (error?.code === '23503') throw new HttpError(400, 'Choose an existing category and location.')
    throw error ?? new Error('insert failed')
  }

  const claimCode = generateClaimCode()
  const [privateRes, secretRes] = await Promise.all([
    db.from('lost_item_private').insert({
      lost_item_id: item.id,
      private_ownership_info: input.private_ownership_info,
    }),
    db.from('lost_item_secrets').insert({
      lost_item_id: item.id,
      claim_code_hash: await hashClaimCode(claimCode),
      identifier_value_hmac: identifierHmac,
      code_issued_at: new Date().toISOString(),
    }),
  ])

  if (privateRes.error || secretRes.error) {
    // Keep reports atomic: roll back the item if its companions failed.
    await db.from('lost_items').delete().eq('id', item.id)
    throw privateRes.error ?? secretRes.error
  }

  await audit('CREATED_LOST_ITEM', { type: 'lost_item', id: item.id }, user.id)
  runInBackground(requestMatching('lost', item.id))

  return ok({ ...item, claim_code: claimCode }, 201)
})
