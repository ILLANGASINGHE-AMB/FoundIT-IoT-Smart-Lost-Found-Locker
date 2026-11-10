import { supabase } from '../lib/supabase'
import { invokeEdge } from '../lib/errors'
import type { LostItem, LostItemStatus } from '../types'

export interface LostItemInput {
  title: string
  description: string
  category_id: string
  location_id: string
  date_lost: string
  brand?: string | null
  model?: string | null
  color?: string | null
  identifier_type?: string | null
  identifier_value?: string | null
  private_ownership_info?: string | null
}

export interface CreateLostItemResult {
  id: string
  title: string
  status: LostItemStatus
  created_at: string
  /** Shown to the user exactly once — never stored in plain text. */
  claim_code: string
}

/** Goes through the Edge Function: identifiers are HMAC'd and the claim code issued server-side. */
export function createLostItem(input: LostItemInput): Promise<CreateLostItemResult> {
  return invokeEdge<CreateLostItemResult>('create-lost-item', { ...input })
}

export type LostItemWithLookups = LostItem & {
  category: { name: string } | null
  location: { name: string } | null
}

const withLookups = '*, category:categories(name), location:locations(name)'

export async function getLostItems(status?: LostItemStatus | 'ALL'): Promise<LostItemWithLookups[]> {
  const { data: auth } = await supabase.auth.getUser()
  let query = supabase
    .from('lost_items')
    .select(withLookups)
    .eq('user_id', auth.user?.id ?? '')
    .order('created_at', { ascending: false })
  if (status && status !== 'ALL') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error('Could not load your lost reports.')
  return data as LostItemWithLookups[]
}

export async function getLostItemById(id: string): Promise<LostItemWithLookups> {
  const { data, error } = await supabase.from('lost_items').select(withLookups).eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load the report.')
  if (!data) throw new Error('Report not found.')
  return data as LostItemWithLookups
}

/** Owner (or admin) only — RLS returns nothing for anyone else. */
export async function getLostItemPrivateInfo(id: string): Promise<string | null> {
  const { data } = await supabase
    .from('lost_item_private')
    .select('private_ownership_info')
    .eq('lost_item_id', id)
    .maybeSingle()
  return data?.private_ownership_info ?? null
}

export type LostItemUpdate = Pick<
  LostItemInput,
  'title' | 'description' | 'category_id' | 'location_id' | 'date_lost' | 'brand' | 'model' | 'color'
> & { private_ownership_info?: string | null }

export async function updateLostItem(id: string, input: LostItemUpdate): Promise<void> {
  const { private_ownership_info, ...fields } = input
  const { error } = await supabase.from('lost_items').update(fields).eq('id', id)
  if (error) throw new Error(error.message.includes('no longer') ? error.message : 'Could not update the report.')

  if (private_ownership_info !== undefined) {
    const { error: privateError } = await supabase
      .from('lost_item_private')
      .update({ private_ownership_info: private_ownership_info || null })
      .eq('lost_item_id', id)
    if (privateError) throw new Error('Report saved, but the private details could not be updated.')
  }
}

export async function cancelLostItem(id: string): Promise<void> {
  const { error } = await supabase.from('lost_items').update({ status: 'CANCELLED' }).eq('id', id)
  if (error) throw new Error(error.message.includes('no longer') ? error.message : 'Could not cancel the report.')
}
