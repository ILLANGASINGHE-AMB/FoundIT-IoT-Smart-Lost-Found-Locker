import { supabase } from '../lib/supabase'
import type { Category, CollectionPoint, ItemImage, Location } from '../types'

export type ItemKind = 'lost' | 'found'

// ─── Lookups ───────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw new Error('Could not load categories.')
  return data as Category[]
}

export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase.from('locations').select('*').order('name')
  if (error) throw new Error('Could not load locations.')
  return data as Location[]
}

export async function getActiveCollectionPoints(): Promise<CollectionPoint[]> {
  const { data, error } = await supabase
    .from('collection_points')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('name')
  if (error) throw new Error('Could not load collection points.')
  return data as CollectionPoint[]
}

// ─── Images (Supabase Storage, private bucket) ─────────────────────────

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_MAX_COUNT = 10
const BUCKET = 'item-images'

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: use a JPEG, PNG or WebP image.`
  if (file.size > IMAGE_MAX_BYTES) return `${file.name}: photos must be 5 MB or smaller.`
  return null
}

export async function uploadItemImage(kind: ItemKind, itemId: string, file: File, userId: string): Promise<ItemImage> {
  const problem = validateImage(file)
  if (problem) throw new Error(problem)

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${kind}/${itemId}/${crypto.randomUUID()}.${ext}`

  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  })
  if (upload.error) throw new Error(`Could not upload ${file.name}.`)

  const { data, error } = await supabase
    .from('item_images')
    .insert({
      [kind === 'lost' ? 'lost_item_id' : 'found_item_id']: itemId,
      uploaded_by: userId,
      storage_path: path,
    })
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(/at most 10/i.test(error.message) ? 'A report can have at most 10 photos.' : `Could not save ${file.name}.`)
  }
  return data as ItemImage
}

export async function deleteItemImage(image: ItemImage): Promise<void> {
  const { error } = await supabase.from('item_images').delete().eq('id', image.id)
  if (error) throw new Error('Could not remove the photo.')
  await supabase.storage.from(BUCKET).remove([image.storage_path])
}

export interface ItemImageWithUrl extends ItemImage {
  url: string
}

export async function getItemImages(kind: ItemKind, itemId: string): Promise<ItemImageWithUrl[]> {
  const { data, error } = await supabase
    .from('item_images')
    .select('*')
    .eq(kind === 'lost' ? 'lost_item_id' : 'found_item_id', itemId)
    .order('created_at')
  if (error) throw new Error('Could not load photos.')
  return withSignedUrls(data as ItemImage[])
}

/** Private bucket: resolve short-lived signed URLs for display. */
export async function withSignedUrls(images: ItemImage[]): Promise<ItemImageWithUrl[]> {
  if (images.length === 0) return []
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(images.map((img) => img.storage_path), 60 * 60)
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return images
    .map((img) => ({ ...img, url: urls.get(img.storage_path) ?? '' }))
    .filter((img) => img.url)
}

/** First photo (as signed URL) for each item — used by list cards. */
export async function getCoverImages(kind: ItemKind, itemIds: string[]): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map()
  const column = kind === 'lost' ? 'lost_item_id' : 'found_item_id'
  const { data } = await supabase
    .from('item_images')
    .select('*')
    .in(column, itemIds)
    .order('created_at')
  const first = new Map<string, ItemImage>()
  for (const img of (data ?? []) as ItemImage[]) {
    const id = (kind === 'lost' ? img.lost_item_id : img.found_item_id)!
    if (!first.has(id)) first.set(id, img)
  }
  const signed = await withSignedUrls([...first.values()])
  return new Map(signed.map((img) => [(kind === 'lost' ? img.lost_item_id : img.found_item_id)!, img.url]))
}
