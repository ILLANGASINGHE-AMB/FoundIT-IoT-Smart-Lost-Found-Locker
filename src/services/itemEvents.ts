import type { ItemKind } from './items'

/**
 * Hook point called after an owner edits a report. The Matching Engine
 * (M3) uses it to refresh the item's embedding and re-run matching.
 */
export async function onItemUpdated(_kind: ItemKind, _itemId: string): Promise<void> {
  // No-op until the Matching Engine is integrated.
}
