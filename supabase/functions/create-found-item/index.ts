// POST /create-found-item
// Creates a found report. If the item was handed in at a FoundIT Box
// (collection_point_id, e.g. pre-filled from a QR scan) it starts as
// IN_STORAGE. Identifiers are HMAC'd server-side.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit, requireUser, runInBackground } from '../_shared/supabase.ts'
import { hmacIdentifier } from '../_shared/crypto.ts'
import { foundItemInput, parseOrThrow, requestMatching } from '../_shared/items.ts'

serve(async (req, body) => {
  const { user } = await requireUser(req)
  const input = parseOrThrow(foundItemInput, body)
  const db = adminClient()

  if (input.collection_point_id) {
    const { data: point } = await db
      .from('collection_points')
      .select('id, status')
      .eq('id', input.collection_point_id)
      .maybeSingle()
    if (!point || point.status !== 'ACTIVE') {
      throw new HttpError(400, 'That collection point is not accepting items.')
    }
  }

  const { data: item, error } = await db
    .from('found_items')
    .insert({
      finder_id: user.id,
      category_id: input.category_id,
      location_id: input.location_id,
      title: input.title,
      description: input.description,
      brand: input.brand,
      model: input.model,
      color: input.color,
      identifier_type: input.identifier_value ? input.identifier_type : null,
      date_found: input.date_found,
      collection_point_id: input.collection_point_id ?? null,
      status: input.collection_point_id ? 'IN_STORAGE' : 'FOUND',
    })
    .select('id, title, status, created_at')
    .single()

  if (error || !item) {
    if (error?.code === '23503') throw new HttpError(400, 'Choose an existing category and location.')
    throw error ?? new Error('insert failed')
  }

  if (input.identifier_type && input.identifier_value) {
    const { error: secretError } = await db.from('found_item_secrets').insert({
      found_item_id: item.id,
      identifier_value_hmac: await hmacIdentifier(input.identifier_type, input.identifier_value),
    })
    if (secretError) {
      await db.from('found_items').delete().eq('id', item.id)
      throw secretError
    }
  }

  await audit('CREATED_FOUND_ITEM', { type: 'found_item', id: item.id }, user.id, {
    collection_point_id: input.collection_point_id ?? null,
  })
  runInBackground(requestMatching('found', item.id))

  return ok(item, 201)
})
