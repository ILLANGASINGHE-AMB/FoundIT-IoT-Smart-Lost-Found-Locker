import { HttpError } from './http.ts'
import { adminClient, type Caller } from './supabase.ts'
import { embedText, toVectorLiteral } from './gemini.ts'

export type ItemType = 'lost' | 'found'

export function parseItemRef(body: Record<string, unknown>): { itemType: ItemType; itemId: string } {
  const itemType = body.item_type
  const itemId = body.item_id
  if (itemType !== 'lost' && itemType !== 'found') throw new HttpError(400, 'item_type must be "lost" or "found"')
  if (typeof itemId !== 'string' || !/^[0-9a-f-]{36}$/i.test(itemId)) throw new HttpError(400, 'item_id must be a UUID')
  return { itemType, itemId }
}

const table = (t: ItemType) => (t === 'lost' ? 'lost_items' : 'found_items')

interface ItemRow {
  id: string
  title: string
  description: string
  brand: string | null
  model: string | null
  color: string | null
  description_embedding: string | null
  owner: string
  category: { name: string } | null
}

export async function loadItem(itemType: ItemType, itemId: string): Promise<ItemRow> {
  const ownerCol = itemType === 'lost' ? 'user_id' : 'finder_id'
  const { data, error } = await adminClient()
    .from(table(itemType))
    .select(`id, title, description, brand, model, color, description_embedding, owner:${ownerCol}, category:categories(name)`)
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Item not found')
  return data as unknown as ItemRow
}

/** Users may only trigger work on their own items; admins and service calls on any. */
export function assertCanTouch(caller: Caller | null, item: ItemRow): void {
  if (!caller) return // service-role call
  if (caller.role === 'admin' || caller.user.id === item.owner) return
  throw new HttpError(404, 'Item not found')
}

/**
 * The same text layout is used for lost and found items so their
 * embeddings are directly comparable.
 */
export function embeddingText(item: ItemRow): string {
  return [
    `Item: ${item.title}`,
    item.category?.name && `Category: ${item.category.name}`,
    item.brand && `Brand: ${item.brand}`,
    item.model && `Model: ${item.model}`,
    item.color && `Colour: ${item.color}`,
    `Description: ${item.description}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Generate and store the item's description embedding. */
export async function embedItem(itemType: ItemType, item: ItemRow): Promise<number> {
  const vector = await embedText(embeddingText(item))
  const { error } = await adminClient()
    .from(table(itemType))
    .update({ description_embedding: toVectorLiteral(vector) })
    .eq('id', item.id)
  if (error) throw error
  return vector.length
}
