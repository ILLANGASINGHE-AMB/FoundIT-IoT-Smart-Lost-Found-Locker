// POST /generate-embedding  { item_type: "lost" | "found", item_id }
// Embeds an item's title/attributes/description with Google Gemini and
// stores the vector in description_embedding (pgvector).
// Callable by the service role, the item's owner, or an admin.

import { ok, serve } from '../_shared/http.ts'
import { isServiceCall, requireUser } from '../_shared/supabase.ts'
import { assertCanTouch, embedItem, loadItem, parseItemRef } from '../_shared/embeddings.ts'

serve(async (req, body) => {
  const caller = isServiceCall(req) ? null : await requireUser(req)
  const { itemType, itemId } = parseItemRef(body)

  const item = await loadItem(itemType, itemId)
  assertCanTouch(caller, item)

  const dimensions = await embedItem(itemType, item)
  return ok({ item_type: itemType, item_id: itemId, dimensions })
})
