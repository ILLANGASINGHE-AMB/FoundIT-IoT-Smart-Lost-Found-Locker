import { supabase } from '../lib/supabase'
import { invokeEdge } from '../lib/errors'
import type { CollectionPoint, FoundItem, FoundItemStatus } from '../types'

export interface FoundItemInput {
  title: string
  description: string
  category_id: string
  location_id: string
  date_found: string
  brand?: string | null
  model?: string | null
  color?: string | null
  identifier_type?: string | null
  identifier_value?: string | null
  collection_point_id?: string | null
}

export interface CreateFoundItemResult {
  id: string
  title: string
  status: FoundItemStatus
  created_at: string
}

export function createFoundItem(input: FoundItemInput): Promise<CreateFoundItemResult> {
  return invokeEdge<CreateFoundItemResult>('create-found-item', { ...input })
}

export type FoundItemWithLookups = FoundItem & {
  category: { name: string } | null
  location: { name: string } | null
  collection_point: Pick<CollectionPoint, 'id' | 'name' | 'address'> | null
}

const withLookups =
  '*, category:categories(name), location:locations(name), collection_point:collection_points(id, name, address)'

export async function getFoundItems(status?: FoundItemStatus | 'ALL'): Promise<FoundItemWithLookups[]> {
  const { data: auth } = await supabase.auth.getUser()
  let query = supabase
    .from('found_items')
    .select(withLookups)
    .eq('finder_id', auth.user?.id ?? '')
    .order('created_at', { ascending: false })
  if (status && status !== 'ALL') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error('Could not load your found reports.')
  return data as FoundItemWithLookups[]
}

export async function getFoundItemById(id: string): Promise<FoundItemWithLookups> {
  const { data, error } = await supabase.from('found_items').select(withLookups).eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load the report.')
  if (!data) throw new Error('Report not found.')
  return data as FoundItemWithLookups
}

export type FoundItemUpdate = Pick<
  FoundItemInput,
  'title' | 'description' | 'category_id' | 'location_id' | 'date_found' | 'brand' | 'model' | 'color'
>

export async function updateFoundItem(id: string, input: FoundItemUpdate): Promise<void> {
  const { error } = await supabase.from('found_items').update(input).eq('id', id)
  if (error) throw new Error(error.message.includes('no longer') ? error.message : 'Could not update the report.')
}
