import type { ItemKind } from './items'
import { requestRematch } from './matching'

/**
 * Called after an owner edits a report: refresh the Gemini embedding and
 * re-run matching (M3). Best-effort — an edit never fails because of it.
 */
export async function onItemUpdated(kind: ItemKind, itemId: string): Promise<void> {
  try {
    await requestRematch(kind, itemId, true)
  } catch (err) {
    console.warn('Re-matching after edit failed:', err)
  }
}
