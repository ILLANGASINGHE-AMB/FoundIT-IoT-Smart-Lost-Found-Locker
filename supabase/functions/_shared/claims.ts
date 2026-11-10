import { HttpError } from './http.ts'
import { adminClient, audit, type Caller } from './supabase.ts'
import { notify } from './notify.ts'

/** Spec §31: lock after N failures inside the window and flag for admin review. */
export const MAX_FAILED_ATTEMPTS = 5
export const ATTEMPT_WINDOW_HOURS = 24
/** Minimum fuzzy similarity for a private-attribute answer to pass. */
export const ANSWER_PASS_THRESHOLD = 0.45

export const ACTIVE_CLAIM_STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED'] as const

export interface ClaimRow {
  id: string
  match_candidate_id: string | null
  lost_item_id: string
  found_item_id: string
  claimant_id: string
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'
  is_locked: boolean
  collection_point_id: string | null
}

export function uuidField(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new HttpError(400, `${field} must be a UUID`)
  }
  return value
}

export function textField(body: Record<string, unknown>, field: string, max = 1000, required = true): string {
  const value = body[field]
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`)
    return ''
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new HttpError(400, `${field} is required`)
  if (trimmed.length > max) throw new HttpError(400, `${field} is too long`)
  return trimmed
}

export async function loadClaim(claimId: string): Promise<ClaimRow> {
  const { data, error } = await adminClient().from('claims').select('*').eq('id', claimId).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Claim not found')
  return data as ClaimRow
}

/** The claimant (or an admin) may act on a claim; others get a 404. */
export function assertClaimant(claim: ClaimRow, caller: Caller): void {
  if (claim.claimant_id !== caller.user.id && caller.role !== 'admin') throw new HttpError(404, 'Claim not found')
}

export async function failedAttempts(claimId: string): Promise<number> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_HOURS * 3600_000).toISOString()
  const { count, error } = await adminClient()
    .from('claim_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('claim_id', claimId)
    .eq('result', 'FAILED')
    .gt('created_at', since)
  if (error) throw error
  return count ?? 0
}

export function assertNotLocked(claim: ClaimRow): void {
  if (claim.is_locked) {
    throw new HttpError(423, 'This claim is locked for review. An administrator will contact you.', 'CLAIM_LOCKED')
  }
}

export async function hasPassed(claimId: string, type: 'PRIVATE_ATTRIBUTE' | 'CLAIM_CODE'): Promise<boolean> {
  const { count } = await adminClient()
    .from('claim_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('claim_id', claimId)
    .eq('verification_type', type)
    .eq('result', 'PASSED')
  return (count ?? 0) > 0
}

export interface AttemptOutcome {
  result: 'PASSED' | 'FAILED'
  remaining_attempts: number
  locked: boolean
}

/**
 * Record one verification attempt (server-side only). On the Nth failure
 * inside the window the claim is locked, flagged UNDER_REVIEW, audited and
 * admins + claimant are notified.
 */
export async function recordAttempt(
  claim: ClaimRow,
  attemptedBy: string,
  type: 'PRIVATE_ATTRIBUTE' | 'CLAIM_CODE',
  passed: boolean,
): Promise<AttemptOutcome> {
  const db = adminClient()
  const result = passed ? 'PASSED' : 'FAILED'
  const { error } = await db.from('claim_attempts').insert({
    claim_id: claim.id,
    attempted_by: attemptedBy,
    attempt_type: type,
    result,
  })
  if (error) throw error

  const failures = await failedAttempts(claim.id)
  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - failures)

  if (!passed && failures >= MAX_FAILED_ATTEMPTS && !claim.is_locked) {
    await db.from('claims').update({ is_locked: true, status: 'UNDER_REVIEW' }).eq('id', claim.id)
    await audit('LOCKED_CLAIM_ATTEMPTS', { type: 'claim', id: claim.id }, attemptedBy, { failures })
    await Promise.all([
      notify({
        toAdmins: true,
        type: 'CLAIM',
        title: 'Claim locked after failed verification attempts',
        message: `A claim was locked after ${failures} failed verification attempts and needs manual review.`,
        link: `/admin/claims/${claim.id}`,
      }),
      notify({
        user_id: claim.claimant_id,
        type: 'CLAIM',
        title: 'Your claim is locked for review',
        message: 'Too many verification attempts failed. An administrator will review your claim and contact you.',
        link: `/claims/${claim.id}`,
      }),
    ])
    return { result, remaining_attempts: 0, locked: true }
  }

  return { result, remaining_attempts: remaining, locked: false }
}

/** Compare a private-attribute answer with the owner's stored private info. */
export async function checkPrivateAnswer(lostItemId: string, answer: string): Promise<{ passed: boolean; onFile: boolean }> {
  const db = adminClient()
  const { data } = await db
    .from('lost_item_private')
    .select('private_ownership_info')
    .eq('lost_item_id', lostItemId)
    .maybeSingle()
  const expected = data?.private_ownership_info?.trim()
  if (!expected) return { passed: false, onFile: false }

  const { data: score, error } = await db.rpc('answer_similarity', { answer, expected })
  if (error) throw error
  return { passed: Number(score) >= ANSWER_PASS_THRESHOLD, onFile: true }
}

/** Revert item statuses after a claim leaves the active set (reject / cancel). */
export async function releaseItemsAfterClaim(claim: ClaimRow): Promise<void> {
  const db = adminClient()

  const { count: openMatches } = await db
    .from('match_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('lost_item_id', claim.lost_item_id)
    .eq('status', 'OPEN')
  await db
    .from('lost_items')
    .update({ status: (openMatches ?? 0) > 0 ? 'MATCHED' : 'LOST' })
    .eq('id', claim.lost_item_id)
    .in('status', ['CLAIM_PENDING', 'CLAIMED'])

  const { count: otherActive } = await db
    .from('claims')
    .select('id', { count: 'exact', head: true })
    .eq('found_item_id', claim.found_item_id)
    .neq('id', claim.id)
    .in('status', [...ACTIVE_CLAIM_STATUSES])
  if ((otherActive ?? 0) === 0) {
    const { data: found } = await db
      .from('found_items')
      .select('collection_point_id')
      .eq('id', claim.found_item_id)
      .single()
    await db
      .from('found_items')
      .update({ status: found?.collection_point_id ? 'IN_STORAGE' : 'FOUND' })
      .eq('id', claim.found_item_id)
      .in('status', ['CLAIM_PENDING', 'CLAIMED'])
  }
}
