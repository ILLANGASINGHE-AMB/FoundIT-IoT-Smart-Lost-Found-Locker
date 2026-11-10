import { customAlphabet } from 'nanoid'
import { supabase } from '../lib/supabase'
import { invokeEdge } from '../lib/errors'
import type {
  AuditLog,
  ClaimStatus,
  CollectionPoint,
  FoundItemStatus,
  LostItemStatus,
  MatchStatus,
  Profile,
} from '../types'
import type { ClaimDetail, ClaimWithItems } from './claims'
import type { MatchWithItems } from './matching'

export { listProfiles as getUsers, adminUpdateUser } from './profile'

// ─── Dashboard & analytics ─────────────────────────────────────────────

export interface AdminStats {
  users: number
  lost_items: number
  found_items: number
  open_matches: number
  pending_claims: number
  locked_claims: number
  ready_for_collection: number
  resolved_cases: number
  unclaimed_expired: number
  items_in_storage: number
  recovery_rate: number
}

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) throw new Error('Could not load dashboard stats.')
  return data as AdminStats
}

export interface Analytics {
  since: string
  by_category: { name: string; lost: number; found: number; total: number }[]
  by_location: { name: string; total: number }[]
  monthly: { month: string; lost: number; found: number; recovered: number; recovery_rate: number }[]
  claim_status: { status: ClaimStatus; count: number }[]
  kpis: {
    total_lost: number
    total_found: number
    matched: number
    recovered: number
    avg_recovery_hours: number | null
    unclaimed_expiry_rate: number
  }
}

export async function getAnalytics(months = 6): Promise<Analytics> {
  const { data, error } = await supabase.rpc('admin_analytics', { p_months: months })
  if (error) throw new Error('Could not load analytics.')
  return data as Analytics
}

export type AuditLogWithUser = AuditLog & { user: Pick<Profile, 'full_name' | 'email'> | null }

export async function getAuditLogs(limit = 20): Promise<AuditLogWithUser[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('Could not load recent activity.')
  return data as unknown as AuditLogWithUser[]
}

// ─── Items ─────────────────────────────────────────────────────────────

export type AdminItemKind = 'lost' | 'found'

export interface AdminItemFilters {
  status?: string
  categoryId?: string
  locationId?: string
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface AdminItemRow {
  id: string
  title: string
  status: LostItemStatus | FoundItemStatus
  date: string
  created_at: string
  retention_expires_at: string | null
  category: { name: string } | null
  location: { name: string } | null
  owner: { full_name: string; email: string } | null
}

export async function listItems(
  kind: AdminItemKind,
  { status, categoryId, locationId, from, to, search, page = 0, pageSize = 25 }: AdminItemFilters,
): Promise<{ rows: AdminItemRow[]; count: number }> {
  const table = kind === 'lost' ? 'lost_items' : 'found_items'
  const dateCol = kind === 'lost' ? 'date_lost' : 'date_found'
  const ownerCol = kind === 'lost' ? 'user_id' : 'finder_id'
  let query = supabase
    .from(table)
    .select(
      `id, title, status, created_at, retention_expires_at, date:${dateCol},
       category:categories(name), location:locations(name), owner:profiles!${table}_${ownerCol}_fkey(full_name, email)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (status) query = query.eq('status', status)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (locationId) query = query.eq('location_id', locationId)
  if (from) query = query.gte(dateCol, from)
  if (to) query = query.lte(dateCol, to)
  const term = search?.trim().replace(/[%,()]/g, '')
  if (term) query = query.ilike('title', `%${term}%`)

  const { data, error, count } = await query
  if (error) throw new Error('Could not load items.')
  return { rows: data as unknown as AdminItemRow[], count: count ?? 0 }
}

/** Admin bulk status change (audited server-side by admin_set_item_status). */
export async function bulkUpdateItemStatus(kind: AdminItemKind, ids: string[], status: string): Promise<number> {
  if (ids.length === 0) return 0
  const { data, error } = await supabase.rpc('admin_set_item_status', {
    p_kind: kind,
    p_ids: ids,
    p_status: status,
  })
  if (error) throw new Error(error.message || 'Could not update the selected items.')
  return Number(data ?? 0)
}

export function expireItems() {
  return invokeEdge<{ expired: number }>('expire-unclaimed-items', {})
}

// ─── Matches ───────────────────────────────────────────────────────────

const MATCH_SELECT = `*,
  lost_item:lost_items(id, title, description, brand, model, color, date_lost, status, user_id, identifier_type,
    category:categories(name), location:locations(name)),
  found_item:found_items(id, title, description, brand, model, color, date_found, status, identifier_type, collection_point_id,
    category:categories(name), location:locations(name), collection_point:collection_points(name, address))`

export async function listMatches(status: MatchStatus | 'ALL' = 'OPEN', minScore = 0): Promise<MatchWithItems[]> {
  let query = supabase
    .from('match_candidates')
    .select(MATCH_SELECT)
    .gte('score', minScore)
    .order('score', { ascending: false })
    .limit(200)
  if (status !== 'ALL') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error('Could not load match candidates.')
  return data as unknown as MatchWithItems[]
}

export async function setMatchStatus(id: string, status: MatchStatus): Promise<void> {
  const { error } = await supabase.from('match_candidates').update({ status }).eq('id', id)
  if (error) throw new Error('Could not update the match.')
}

// ─── Claims ────────────────────────────────────────────────────────────

const CLAIM_LIST_SELECT = `*,
  lost_item:lost_items(id, title, date_lost, status, category:categories(name)),
  found_item:found_items(id, title, date_found, status, location:locations(name)),
  collection_point:collection_points(id, name, address, contact, description),
  claimant:profiles!claims_claimant_id_fkey(full_name, email, phone)`

export type AdminClaimRow = ClaimWithItems & {
  claimant: Pick<Profile, 'full_name' | 'email' | 'phone'> | null
}

export async function listClaims(status: ClaimStatus | 'ACTIVE' | 'ALL' = 'ACTIVE'): Promise<AdminClaimRow[]> {
  let query = supabase.from('claims').select(CLAIM_LIST_SELECT).order('submitted_at', { ascending: false }).limit(200)
  if (status === 'ACTIVE') query = query.in('status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
  else if (status !== 'ALL') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error('Could not load claims.')
  return data as unknown as AdminClaimRow[]
}

export type AdminClaimReview = ClaimDetail & {
  claimant: Pick<Profile, 'full_name' | 'email' | 'phone'> | null
  lost_full: (MatchWithItems['lost_item'] & { private?: string | null }) | null
  found_full: MatchWithItems['found_item'] | null
  match: { score: number; score_breakdown: MatchWithItems['score_breakdown'] } | null
}

/** Everything a reviewer needs: both items, private info, attempts, verifications. */
export async function getClaimForReview(id: string): Promise<AdminClaimReview> {
  const { data, error } = await supabase
    .from('claims')
    .select(
      `${CLAIM_LIST_SELECT}, claim_verifications(*), claim_attempts(*), collections(*),
       match:match_candidates(score, score_breakdown),
       lost_full:lost_items(id, title, description, brand, model, color, date_lost, status, user_id, identifier_type,
         category:categories(name), location:locations(name)),
       found_full:found_items(id, title, description, brand, model, color, date_found, status, identifier_type,
         collection_point_id, category:categories(name), location:locations(name), collection_point:collection_points(name, address))`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Could not load the claim.')
  if (!data) throw new Error('Claim not found.')

  const review = data as unknown as AdminClaimReview
  if (review.lost_full) {
    const { data: priv } = await supabase
      .from('lost_item_private')
      .select('private_ownership_info')
      .eq('lost_item_id', review.lost_item_id)
      .maybeSingle()
    review.lost_full = { ...review.lost_full, private: priv?.private_ownership_info ?? null }
  }
  return review
}

// ─── Collection points ─────────────────────────────────────────────────

export type CollectionPointWithLocation = CollectionPoint & { location: { name: string } | null }

export async function listCollectionPoints(): Promise<CollectionPointWithLocation[]> {
  const { data, error } = await supabase.from('collection_points').select('*, location:locations(name)').order('name')
  if (error) throw new Error('Could not load collection points.')
  return data as unknown as CollectionPointWithLocation[]
}

/** Short, random, non-sequential routing token (spec §27.1). */
export const generateQrSlug = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10)

export type CollectionPointInput = Pick<CollectionPoint, 'name' | 'location_id' | 'address' | 'description' | 'contact'>

export async function manageCollectionPoint(
  action: 'create' | 'update' | 'deactivate' | 'activate' | 'rotate-qr' | 'toggle-qr',
  input: { id?: string; values?: Partial<CollectionPointInput>; qrActive?: boolean },
): Promise<CollectionPoint> {
  const table = supabase.from('collection_points')
  const run = async () => {
    switch (action) {
      case 'create':
        return table.insert({ ...input.values, qr_slug: generateQrSlug() }).select('*').single()
      case 'update':
        return table.update(input.values ?? {}).eq('id', input.id!).select('*').single()
      case 'deactivate':
        return table.update({ status: 'INACTIVE', qr_active: false }).eq('id', input.id!).select('*').single()
      case 'activate':
        return table.update({ status: 'ACTIVE', qr_active: true }).eq('id', input.id!).select('*').single()
      case 'rotate-qr':
        // New slug: every previously printed code stops resolving immediately.
        return table.update({ qr_slug: generateQrSlug(), qr_active: true }).eq('id', input.id!).select('*').single()
      case 'toggle-qr':
        return table.update({ qr_active: Boolean(input.qrActive) }).eq('id', input.id!).select('*').single()
    }
  }
  const { data, error } = await run()
  if (error) throw new Error(error.message || 'Could not save the collection point.')
  return data as CollectionPoint
}
