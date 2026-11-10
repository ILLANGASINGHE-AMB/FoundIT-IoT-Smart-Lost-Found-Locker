import { supabase } from '../lib/supabase'
import { invokeEdge } from '../lib/errors'
import type { Claim, ClaimAttempt, ClaimStatus, ClaimVerification, Collection, CollectionPoint } from '../types'

type Named = { name: string } | null

export type ClaimWithItems = Claim & {
  lost_item: { id: string; title: string; date_lost: string; status: string; category: Named } | null
  found_item: { id: string; title: string; date_found: string; status: string; location: Named } | null
  collection_point: Pick<CollectionPoint, 'id' | 'name' | 'address' | 'contact' | 'description'> | null
}

export type ClaimDetail = ClaimWithItems & {
  claim_verifications: ClaimVerification[]
  claim_attempts: ClaimAttempt[]
  collections: Collection[]
}

const LIST_SELECT = `*,
  lost_item:lost_items(id, title, date_lost, status, category:categories(name)),
  found_item:found_items(id, title, date_found, status, location:locations(name)),
  collection_point:collection_points(id, name, address, contact, description)`

export async function getMyClaims(status: ClaimStatus | 'ALL' = 'ALL'): Promise<ClaimWithItems[]> {
  const { data: auth } = await supabase.auth.getUser()
  let query = supabase
    .from('claims')
    .select(LIST_SELECT)
    .eq('claimant_id', auth.user?.id ?? '')
    .order('submitted_at', { ascending: false })
  if (status !== 'ALL') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error('Could not load your claims.')
  return data as unknown as ClaimWithItems[]
}

export async function getClaimById(id: string): Promise<ClaimDetail> {
  const { data, error } = await supabase
    .from('claims')
    .select(`${LIST_SELECT}, claim_verifications(*), claim_attempts(*), collections(*)`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Could not load this claim.')
  if (!data) throw new Error('Claim not found.')
  return data as unknown as ClaimDetail
}

export async function getActiveClaimForMatch(matchId: string): Promise<Claim | null> {
  const { data } = await supabase
    .from('claims')
    .select('*')
    .eq('match_candidate_id', matchId)
    .in('status', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Claim) ?? null
}

// ─── Edge Functions ────────────────────────────────────────────────────

export function submitClaim(matchCandidateId: string) {
  return invokeEdge<Claim>('submit-claim', { match_candidate_id: matchCandidateId })
}

export interface VerificationOutcome {
  result: 'PASSED' | 'FAILED'
  remaining_attempts: number
  locked: boolean
  next_step: 'PRIVATE_ATTRIBUTE' | 'CLAIM_CODE' | 'REVIEW' | 'LOCKED'
}

export function verifyClaim(claimId: string, answer: string) {
  return invokeEdge<VerificationOutcome>('verify-claim', { claim_id: claimId, private_attribute_answer: answer })
}

export function verifyClaimCode(claimId: string, code: string) {
  return invokeEdge<VerificationOutcome>('verify-claim-code', { claim_id: claimId, claim_code: code })
}

export function recoverCredential(lostItemId: string, answer: string) {
  return invokeEdge<{ claim_code: string }>('recover-claim-credential', {
    lost_item_id: lostItemId,
    private_attribute_answer: answer,
  })
}

export async function cancelClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_claim', { p_claim_id: claimId })
  if (error) throw new Error(error.message || 'Could not cancel the claim.')
}

// ─── Admin / collection officer ────────────────────────────────────────

export function approveClaim(claimId: string, collectionPointId?: string | null, notes?: string) {
  return invokeEdge<Claim>('approve-claim', {
    claim_id: claimId,
    collection_point_id: collectionPointId || undefined,
    notes,
  })
}

export function rejectClaim(claimId: string, reason: string) {
  return invokeEdge<Claim>('reject-claim', { claim_id: claimId, reason })
}

export function completeCollection(
  claimId: string,
  input: { claimCode?: string; overrideReason?: string; notes?: string },
) {
  return invokeEdge<Claim>('complete-collection', {
    claim_id: claimId,
    claim_code: input.claimCode || undefined,
    override_reason: input.overrideReason || undefined,
    notes: input.notes || undefined,
  })
}

export const MAX_ATTEMPTS = 5

export function failedAttemptsInWindow(attempts: ClaimAttempt[]): number {
  const since = Date.now() - 24 * 3600_000
  return attempts.filter((a) => a.result === 'FAILED' && new Date(a.created_at).getTime() > since).length
}
