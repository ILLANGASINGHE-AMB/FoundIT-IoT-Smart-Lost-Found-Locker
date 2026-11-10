// POST /find-matches  { item_type: "lost" | "found", item_id, reembed? }
// 1. Ensures the item has a Gemini embedding (re-embeds when asked or missing).
// 2. Runs run_matching(): trigram + semantic scoring, stores candidates ≥ 40%.
// 3. Notifies owners of lost items about every NEW candidate.
// If Gemini is unavailable, matching still runs on the lexical signals.
// Callable by the service role (after create), the owner, or an admin.

import { ok, serve } from '../_shared/http.ts'
import { adminClient, audit, isServiceCall, requireUser } from '../_shared/supabase.ts'
import { assertCanTouch, embedItem, loadItem, parseItemRef } from '../_shared/embeddings.ts'
import { geminiConfigured } from '../_shared/gemini.ts'
import { notify } from '../_shared/notify.ts'

interface NewCandidate {
  id: string
  lost_item_id: string
  found_item_id: string
  score: number
  owner_id: string
}

serve(async (req, body) => {
  const caller = isServiceCall(req) ? null : await requireUser(req)
  const { itemType, itemId } = parseItemRef(body)
  const db = adminClient()

  const item = await loadItem(itemType, itemId)
  assertCanTouch(caller, item)

  let semantic: 'used' | 'unavailable' = 'unavailable'
  if (geminiConfigured()) {
    try {
      if (!item.description_embedding || body.reembed === true) await embedItem(itemType, item)
      semantic = 'used'
    } catch (err) {
      console.error('embedding failed, falling back to lexical matching:', err instanceof Error ? err.message : err)
    }
  }

  const { data, error } = await db.rpc('run_matching', { p_item_type: itemType, p_item_id: itemId })
  if (error) throw error
  const created = (data ?? []) as NewCandidate[]

  if (created.length > 0) {
    const { data: lostTitles } = await db
      .from('lost_items')
      .select('id, title')
      .in('id', [...new Set(created.map((c) => c.lost_item_id))])
    const titleOf = new Map((lostTitles ?? []).map((r: { id: string; title: string }) => [r.id, r.title]))

    await Promise.all(
      created.map((c) =>
        notify({
          user_id: c.owner_id,
          type: 'MATCH',
          title: 'Your lost item may have been found',
          message: `A found item is a ${Math.round(c.score)}% match for “${titleOf.get(c.lost_item_id) ?? 'your lost item'}”. Review it to see if it’s yours.`,
          link: `/matches/${c.id}`,
          email: true,
        }),
      ),
    )

    await audit('MATCH_CANDIDATES_CREATED', { type: `${itemType}_item`, id: itemId }, caller?.user.id ?? null, {
      count: created.length,
      semantic,
    })
  }

  return ok({ item_type: itemType, item_id: itemId, new_candidates: created.length, semantic })
})
