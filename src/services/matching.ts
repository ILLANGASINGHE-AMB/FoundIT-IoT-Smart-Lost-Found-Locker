import { supabase } from '../lib/supabase'
import { invokeEdge } from '../lib/errors'
import type { FoundItem, LostItem, MatchCandidate, MatchStatus } from '../types'
import type { ItemKind } from './items'

type Named = { name: string } | null

export type MatchLostItem = Pick<
  LostItem,
  'id' | 'title' | 'description' | 'brand' | 'model' | 'color' | 'date_lost' | 'status' | 'user_id' | 'identifier_type'
> & { category: Named; location: Named }

export type MatchFoundItem = Pick<
  FoundItem,
  'id' | 'title' | 'description' | 'brand' | 'model' | 'color' | 'date_found' | 'status' | 'identifier_type' | 'collection_point_id'
> & { category: Named; location: Named; collection_point: { name: string; address: string | null } | null }

export type MatchWithItems = MatchCandidate & {
  lost_item: MatchLostItem | null
  found_item: MatchFoundItem | null
}

const SELECT = `*,
  lost_item:lost_items(id, title, description, brand, model, color, date_lost, status, user_id, identifier_type,
    category:categories(name), location:locations(name)),
  found_item:found_items(id, title, description, brand, model, color, date_found, status, identifier_type, collection_point_id,
    category:categories(name), location:locations(name), collection_point:collection_points(name, address))`

/** All candidates for the signed-in user's lost items (RLS-scoped), best first. */
export async function getMyMatches(status: MatchStatus | 'ALL' = 'OPEN'): Promise<MatchWithItems[]> {
  const { data: auth } = await supabase.auth.getUser()
  let query = supabase
    .from('match_candidates')
    .select(SELECT.replace('lost_item:lost_items(', 'lost_item:lost_items!inner('))
    .eq('lost_item.user_id', auth.user?.id ?? '')
    .order('score', { ascending: false })
  if (status !== 'ALL') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error('Could not load your matches.')
  return data as unknown as MatchWithItems[]
}

export async function getMatchesForLostItem(lostItemId: string): Promise<MatchWithItems[]> {
  const { data, error } = await supabase
    .from('match_candidates')
    .select(SELECT)
    .eq('lost_item_id', lostItemId)
    .order('score', { ascending: false })
  if (error) throw new Error('Could not load matches for this report.')
  return data as unknown as MatchWithItems[]
}

export async function getMatchById(id: string): Promise<MatchWithItems> {
  const { data, error } = await supabase.from('match_candidates').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load this match.')
  if (!data) throw new Error('Match not found.')
  return data as unknown as MatchWithItems
}

/** "Not my item" — sets status = DISMISSED (kept for the audit trail). */
export async function dismissMatch(id: string): Promise<void> {
  const { error } = await supabase.rpc('dismiss_match', { p_match_id: id })
  if (error) throw new Error(error.message || 'Could not dismiss this match.')
}

/** Re-embed (Gemini) and re-run matching for one of the user's items. */
export function requestRematch(kind: ItemKind, itemId: string, reembed = true) {
  return invokeEdge<{ new_candidates: number; semantic: 'used' | 'unavailable' }>('find-matches', {
    item_type: kind,
    item_id: itemId,
    reembed,
  })
}
