// ════════════════════════════════════════════════════════════════════════
// Demo mode — server-side logic ported to the browser.
// JS equivalents of the SQL functions (supabase/migrations) and the Edge
// Functions (supabase/functions), operating on the localStorage store.
// Semantic (Gemini) similarity is unavailable offline, so matching uses
// the same lexical fallback the real find-matches function uses.
// ════════════════════════════════════════════════════════════════════════

import { nowIso, transact, type Row, type Tx } from './store'
import { answerSimilarity, colorScore, textTrgm } from './trgm'

export class DemoError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface Caller {
  uid: string | null
}

const MAX_FAILED = 5
const WINDOW_MS = 24 * 3600_000
const ANSWER_THRESHOLD = 0.45
const ACTIVE_CLAIMS = ['PENDING', 'UNDER_REVIEW', 'APPROVED']

// ─── Crypto (demo secret; the real app keeps secrets server-side) ───────

const DEMO_SECRET = 'foundit-demo-secret'
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${DEMO_SECRET}:${value}`))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export function generateClaimCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const chars = Array.from(bytes)
    .filter((b) => b < 240)
    .slice(0, 12)
    .map((b) => ALPHABET[b % ALPHABET.length])
  while (chars.length < 12) chars.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)])
  const raw = chars.join('')
  return `FND-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}
const normalizeCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, '').replace(/^FND/, '')
export const hashClaimCode = (code: string) => sha256Hex(`code:${normalizeCode(code)}`)
export const hmacIdentifier = (type: string, value: string) =>
  sha256Hex(`id:${type.trim().toUpperCase()}:${value.replace(/[\s\-_./]/g, '').toUpperCase()}`)

// ─── Helpers ────────────────────────────────────────────────────────────

function requireUser(caller: Caller): string {
  if (!caller.uid) throw new DemoError(401, 'Please sign in to continue.')
  return caller.uid
}

function requireAdmin(tx: Tx, caller: Caller): string {
  const uid = requireUser(caller)
  if (!tx.isAdmin(uid)) throw new DemoError(403, 'Administrator access is required.')
  return uid
}

function notify(
  tx: Tx,
  input: { user_id?: string; toAdmins?: boolean; title: string; message: string; type: string; link?: string },
) {
  const recipients = input.toAdmins
    ? tx.where('profiles', (p) => p.role === 'admin').map((p) => p.id as string)
    : input.user_id
      ? [input.user_id]
      : []
  for (const user_id of recipients) {
    tx.insert('notifications', {
      user_id,
      title: input.title,
      message: input.message,
      type: input.type,
      channel: 'IN_APP',
      link: input.link ?? null,
    })
  }
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400_000)

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

// ─── Matching (port of score_match_pairs / run_matching) ────────────────

function scorePair(tx: Tx, l: Row, f: Row): { score: number; breakdown: Row } {
  const ls = tx.get('lost_item_secrets', l.id)
  const fs = tx.get('found_item_secrets', f.id)
  const identifierExact = Boolean(
    ls?.identifier_value_hmac && ls.identifier_value_hmac === fs?.identifier_value_hmac && l.identifier_type === f.identifier_type,
  )
  const days = daysBetween(l.date_lost as string, f.date_found as string)
  const s = {
    category: l.category_id === f.category_id ? 1 : 0,
    brand: textTrgm(l.brand, f.brand),
    model: textTrgm(l.model, f.model),
    color: colorScore(l.color, f.color),
    location: l.location_id === f.location_id ? 1 : 0,
    date: Math.abs(days) <= 1 ? 1 : Math.max(0, 1 - (Math.abs(days) - 1) / 6),
  }
  const trigram = Math.max(textTrgm(l.title, f.title), textTrgm(l.description, f.description))
  const description = trigram // no Gemini offline → lexical fallback
  const total =
    10 * s.category + 15 * s.brand + 15 * s.model + 10 * s.color + 20 * s.location + 10 * s.date + 20 * description
  const entry = (score: number, weight: number, method: string) => ({
    score: r3(score),
    weight,
    contribution: r2(weight * score),
    method,
  })
  return {
    score: identifierExact ? 100 : r2(total),
    breakdown: {
      category: entry(s.category, 10, 'exact'),
      brand: entry(s.brand, 15, 'trigram'),
      model: entry(s.model, 15, 'trigram'),
      color: entry(s.color, 10, 'exact'),
      location: entry(s.location, 20, 'exact'),
      date: { ...entry(s.date, 10, 'decay'), days_apart: days },
      description: { ...entry(description, 20, 'trigram'), trigram_similarity: r3(trigram), semantic_similarity: null },
      semantic_similarity: null,
      identifier_exact: identifierExact,
    },
  }
}

export function runMatching(tx: Tx, itemType: 'lost' | 'found', itemId: string, threshold = 40) {
  const lostPool =
    itemType === 'lost' ? tx.where('lost_items', (l) => l.id === itemId) : tx.where('lost_items', () => true)
  const foundPool =
    itemType === 'found' ? tx.where('found_items', (f) => f.id === itemId) : tx.where('found_items', () => true)

  const created: Row[] = []
  for (const l of lostPool) {
    if (!['LOST', 'MATCHED'].includes(l.status as string)) continue
    for (const f of foundPool) {
      if (!['FOUND', 'IN_STORAGE', 'MATCHED'].includes(f.status as string)) continue
      if (l.user_id === f.finder_id) continue
      const days = daysBetween(l.date_lost as string, f.date_found as string)
      if (days < -1 || days > 90) continue

      const { score, breakdown } = scorePair(tx, l, f)
      const existing = tx.find('match_candidates', (m) => m.lost_item_id === l.id && m.found_item_id === f.id)
      if (existing) {
        if (existing.status === 'OPEN') tx.update('match_candidates', (m) => m === existing, { score, score_breakdown: breakdown })
        continue
      }
      if (score < threshold) continue
      const m = tx.insert('match_candidates', { lost_item_id: l.id, found_item_id: f.id, score, score_breakdown: breakdown })
      if (l.status === 'LOST') tx.update('lost_items', (x) => x.id === l.id, { status: 'MATCHED' })
      if (f.status === 'FOUND') tx.update('found_items', (x) => x.id === f.id, { status: 'MATCHED' })
      created.push({ ...m, owner_id: l.user_id, lost_title: l.title })
    }
  }
  return created
}

function matchAndNotify(tx: Tx, itemType: 'lost' | 'found', itemId: string, uid: string | null) {
  const created = runMatching(tx, itemType, itemId)
  for (const c of created) {
    notify(tx, {
      user_id: c.owner_id as string,
      type: 'MATCH',
      title: 'Your lost item may have been found',
      message: `A found item is a ${Math.round(c.score as number)}% match for “${c.lost_title}”. Review it to see if it’s yours.`,
      link: `/matches/${c.id}`,
    })
  }
  if (created.length) tx.audit('MATCH_CANDIDATES_CREATED', `${itemType}_item`, itemId, uid, { count: created.length, semantic: 'unavailable' })
  return created.length
}

// ─── Claim helpers ──────────────────────────────────────────────────────

function loadClaim(tx: Tx, id: unknown, caller: Caller, allowAdmin = true): Row {
  const uid = requireUser(caller)
  const claim = tx.get('claims', id)
  if (!claim || (claim.claimant_id !== uid && !(allowAdmin && tx.isAdmin(uid)))) {
    throw new DemoError(404, 'Claim not found')
  }
  return claim
}

const failures = (tx: Tx, claimId: unknown) =>
  tx.where(
    'claim_attempts',
    (a) => a.claim_id === claimId && a.result === 'FAILED' && Date.now() - new Date(a.created_at as string).getTime() < WINDOW_MS,
  ).length

const hasPassed = (tx: Tx, claimId: unknown, type: string) =>
  tx.where('claim_verifications', (v) => v.claim_id === claimId && v.verification_type === type && v.result === 'PASSED').length > 0

function recordAttempt(tx: Tx, claim: Row, by: string, type: string, passed: boolean) {
  tx.insert('claim_attempts', { claim_id: claim.id, attempted_by: by, attempt_type: type, result: passed ? 'PASSED' : 'FAILED' })
  const n = failures(tx, claim.id)
  if (!passed && n >= MAX_FAILED && !claim.is_locked) {
    tx.update('claims', (c) => c.id === claim.id, { is_locked: true, status: 'UNDER_REVIEW' })
    tx.audit('LOCKED_CLAIM_ATTEMPTS', 'claim', claim.id as string, by, { failures: n })
    notify(tx, {
      toAdmins: true,
      type: 'CLAIM',
      title: 'Claim locked after failed verification attempts',
      message: `A claim was locked after ${n} failed verification attempts and needs manual review.`,
      link: `/admin/claims/${claim.id}`,
    })
    notify(tx, {
      user_id: claim.claimant_id as string,
      type: 'CLAIM',
      title: 'Your claim is locked for review',
      message: 'Too many verification attempts failed. An administrator will review your claim and contact you.',
      link: `/claims/${claim.id}`,
    })
    return { result: 'FAILED', remaining_attempts: 0, locked: true }
  }
  return { result: passed ? 'PASSED' : 'FAILED', remaining_attempts: Math.max(0, MAX_FAILED - n), locked: false }
}

function releaseItems(tx: Tx, claim: Row) {
  const openMatches = tx.where('match_candidates', (m) => m.lost_item_id === claim.lost_item_id && m.status === 'OPEN').length
  tx.update(
    'lost_items',
    (l) => l.id === claim.lost_item_id && ['CLAIM_PENDING', 'CLAIMED'].includes(l.status as string),
    { status: openMatches ? 'MATCHED' : 'LOST' },
  )
  const otherActive = tx.where(
    'claims',
    (c) => c.found_item_id === claim.found_item_id && c.id !== claim.id && ACTIVE_CLAIMS.includes(c.status as string),
  ).length
  if (!otherActive) {
    const f = tx.get('found_items', claim.found_item_id)
    tx.update(
      'found_items',
      (x) => x.id === claim.found_item_id && ['CLAIM_PENDING', 'CLAIMED'].includes(x.status as string),
      { status: f?.collection_point_id ? 'IN_STORAGE' : 'FOUND' },
    )
  }
}

// ─── Edge Functions ─────────────────────────────────────────────────────

type Body = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const orNull = (v: unknown) => str(v) || null

export async function invokeFunction(name: string, body: Body, caller: Caller): Promise<unknown> {
  switch (name) {
    case 'create-lost-item': {
      const uid = requireUser(caller)
      if (!str(body.title) || !str(body.description)) throw new DemoError(400, 'Title and description are required.')
      const claimCode = generateClaimCode()
      const codeHash = await hashClaimCode(claimCode)
      const idHmac =
        body.identifier_type && str(body.identifier_value)
          ? await hmacIdentifier(str(body.identifier_type), str(body.identifier_value))
          : null
      return transact((tx) => {
        const item = tx.insert('lost_items', {
          user_id: uid,
          category_id: body.category_id,
          location_id: body.location_id,
          title: str(body.title),
          description: str(body.description),
          brand: orNull(body.brand),
          model: orNull(body.model),
          color: orNull(body.color),
          identifier_type: idHmac ? body.identifier_type : null,
          date_lost: body.date_lost,
        })
        tx.insert('lost_item_private', { lost_item_id: item.id, private_ownership_info: orNull(body.private_ownership_info) })
        tx.insert('lost_item_secrets', {
          lost_item_id: item.id,
          claim_code_hash: codeHash,
          identifier_value_hmac: idHmac,
          code_issued_at: nowIso(),
        })
        tx.audit('CREATED_LOST_ITEM', 'lost_item', item.id as string, uid)
        matchAndNotify(tx, 'lost', item.id as string, uid)
        const fresh = tx.get('lost_items', item.id)!
        return { id: fresh.id, title: fresh.title, status: fresh.status, created_at: fresh.created_at, claim_code: claimCode }
      })
    }

    case 'create-found-item': {
      const uid = requireUser(caller)
      if (!str(body.title) || !str(body.description)) throw new DemoError(400, 'Title and description are required.')
      const idHmac =
        body.identifier_type && str(body.identifier_value)
          ? await hmacIdentifier(str(body.identifier_type), str(body.identifier_value))
          : null
      return transact((tx) => {
        const cp = body.collection_point_id ? tx.get('collection_points', body.collection_point_id) : null
        if (body.collection_point_id && (!cp || cp.status !== 'ACTIVE')) {
          throw new DemoError(400, 'That collection point is not accepting items.')
        }
        const item = tx.insert('found_items', {
          finder_id: uid,
          category_id: body.category_id,
          location_id: body.location_id,
          title: str(body.title),
          description: str(body.description),
          brand: orNull(body.brand),
          model: orNull(body.model),
          color: orNull(body.color),
          identifier_type: idHmac ? body.identifier_type : null,
          date_found: body.date_found,
          collection_point_id: cp ? cp.id : null,
          status: cp ? 'IN_STORAGE' : 'FOUND',
        })
        if (idHmac) tx.insert('found_item_secrets', { found_item_id: item.id, identifier_value_hmac: idHmac })
        tx.audit('CREATED_FOUND_ITEM', 'found_item', item.id as string, uid, { collection_point_id: cp?.id ?? null })
        matchAndNotify(tx, 'found', item.id as string, uid)
        const fresh = tx.get('found_items', item.id)!
        return { id: fresh.id, title: fresh.title, status: fresh.status, created_at: fresh.created_at }
      })
    }

    case 'generate-embedding':
      return { item_type: body.item_type, item_id: body.item_id, dimensions: 0 }

    case 'find-matches': {
      const uid = requireUser(caller)
      const type = body.item_type === 'found' ? 'found' : 'lost'
      return transact((tx) => {
        const item = tx.get(type === 'lost' ? 'lost_items' : 'found_items', body.item_id)
        const owner = item?.[type === 'lost' ? 'user_id' : 'finder_id']
        if (!item || (owner !== uid && !tx.isAdmin(uid))) throw new DemoError(404, 'Item not found')
        const n = matchAndNotify(tx, type, item.id as string, uid)
        return { item_type: type, item_id: item.id, new_candidates: n, semantic: 'unavailable' }
      })
    }

    case 'submit-claim': {
      const uid = requireUser(caller)
      return transact((tx) => {
        const m = tx.get('match_candidates', body.match_candidate_id)
        const lost = m && tx.get('lost_items', m.lost_item_id)
        const found = m && tx.get('found_items', m.found_item_id)
        if (!m || !lost || !found || (lost.user_id !== uid && !tx.isAdmin(uid))) throw new DemoError(404, 'Match not found')
        const existing = tx.find('claims', (c) => c.match_candidate_id === m.id && ACTIVE_CLAIMS.includes(c.status as string))
        if (existing) return existing
        if (m.status !== 'OPEN') throw new DemoError(409, 'This match can no longer be claimed.')
        if (!['LOST', 'MATCHED'].includes(lost.status as string)) throw new DemoError(409, 'Your lost report is no longer open for claims.')
        if (!['FOUND', 'IN_STORAGE', 'MATCHED', 'CLAIM_PENDING'].includes(found.status as string)) {
          throw new DemoError(409, 'This found item is no longer available to claim.')
        }
        if (tx.find('claims', (c) => c.found_item_id === found.id && c.claimant_id === lost.user_id && ACTIVE_CLAIMS.includes(c.status as string))) {
          throw new DemoError(409, 'You already have an active claim for this item.')
        }
        const claim = tx.insert('claims', {
          match_candidate_id: m.id,
          lost_item_id: lost.id,
          found_item_id: found.id,
          claimant_id: lost.user_id,
          collection_point_id: found.collection_point_id ?? null,
        })
        tx.update('match_candidates', (x) => x.id === m.id, { status: 'CONVERTED_TO_CLAIM' })
        tx.update('lost_items', (x) => x.id === lost.id, { status: 'CLAIM_PENDING' })
        tx.update('found_items', (x) => x.id === found.id && ['FOUND', 'IN_STORAGE', 'MATCHED'].includes(x.status as string), {
          status: 'CLAIM_PENDING',
        })
        tx.audit('SUBMITTED_CLAIM', 'claim', claim.id as string, uid, { match_candidate_id: m.id })
        notify(tx, { toAdmins: true, type: 'CLAIM', title: 'New claim submitted', message: `A claim was opened for “${lost.title}”.`, link: `/admin/claims/${claim.id}` })
        return claim
      })
    }

    case 'verify-claim': {
      const answer = str(body.private_attribute_answer)
      if (!answer) throw new DemoError(400, 'private_attribute_answer is required')
      return transact((tx) => {
        const claim = loadClaim(tx, body.claim_id, caller)
        if (claim.status !== 'PENDING') throw new DemoError(409, 'This claim is not awaiting verification.')
        if (claim.is_locked) throw new DemoError(423, 'This claim is locked for review. An administrator will contact you.')
        if (hasPassed(tx, claim.id, 'PRIVATE_ATTRIBUTE')) {
          return { result: 'PASSED', remaining_attempts: MAX_FAILED - failures(tx, claim.id), locked: false, next_step: 'CLAIM_CODE' }
        }
        tx.update('claims', (c) => c.id === claim.id, { private_attribute_answer: answer })
        const expected = str(tx.get('lost_item_private', claim.lost_item_id)?.private_ownership_info)
        if (!expected) {
          tx.insert('claim_verifications', {
            claim_id: claim.id,
            verification_type: 'PRIVATE_ATTRIBUTE',
            result: 'PASSED',
            notes: 'No private details on file — reviewer must compare the answer with the item.',
          })
          return { result: 'PASSED', remaining_attempts: MAX_FAILED - failures(tx, claim.id), locked: false, next_step: 'CLAIM_CODE' }
        }
        const passed = answerSimilarity(answer, expected) >= ANSWER_THRESHOLD
        const out = recordAttempt(tx, claim, caller.uid!, 'PRIVATE_ATTRIBUTE', passed)
        if (passed) {
          tx.insert('claim_verifications', {
            claim_id: claim.id,
            verification_type: 'PRIVATE_ATTRIBUTE',
            result: 'PASSED',
            notes: 'Answer matched the private ownership details on file.',
          })
        }
        return { ...out, next_step: passed ? 'CLAIM_CODE' : out.locked ? 'LOCKED' : 'PRIVATE_ATTRIBUTE' }
      })
    }

    case 'verify-claim-code': {
      const codeHash = await hashClaimCode(str(body.claim_code))
      return transact((tx) => {
        const claim = loadClaim(tx, body.claim_id, caller)
        if (claim.status !== 'PENDING') throw new DemoError(409, 'This claim is not awaiting verification.')
        if (claim.is_locked) throw new DemoError(423, 'This claim is locked for review. An administrator will contact you.')
        if (!hasPassed(tx, claim.id, 'PRIVATE_ATTRIBUTE')) throw new DemoError(409, 'Answer the private ownership question first.')
        const passed = tx.get('lost_item_secrets', claim.lost_item_id)?.claim_code_hash === codeHash
        const out = recordAttempt(tx, claim, caller.uid!, 'CLAIM_CODE', passed)
        if (passed) {
          tx.insert('claim_verifications', { claim_id: claim.id, verification_type: 'CLAIM_CODE', result: 'PASSED', notes: 'Claim credential verified.' })
          tx.update('claims', (c) => c.id === claim.id, { status: 'UNDER_REVIEW' })
          tx.audit('VERIFIED_CLAIM', 'claim', claim.id as string, caller.uid)
          notify(tx, {
            toAdmins: true,
            type: 'CLAIM',
            title: 'Claim verified — ready for review',
            message: 'A claimant passed both verification steps. Review and approve or reject the claim.',
            link: `/admin/claims/${claim.id}`,
          })
        }
        return { ...out, next_step: passed ? 'REVIEW' : out.locked ? 'LOCKED' : 'CLAIM_CODE' }
      })
    }

    case 'recover-claim-credential': {
      const uid = requireUser(caller)
      const answer = str(body.private_attribute_answer)
      const newCode = generateClaimCode()
      const newHash = await hashClaimCode(newCode)
      return transact((tx) => {
        const item = tx.get('lost_items', body.lost_item_id)
        if (!item || item.user_id !== uid) throw new DemoError(404, 'Report not found')
        if (['RESOLVED', 'CANCELLED'].includes(item.status as string)) {
          throw new DemoError(409, 'This report is closed; its credential can no longer be recovered.')
        }
        const recent = tx.where(
          'audit_logs',
          (a) => a.action === 'FAILED_CREDENTIAL_RECOVERY' && a.entity_id === item.id && Date.now() - new Date(a.created_at as string).getTime() < WINDOW_MS,
        ).length
        if (recent >= MAX_FAILED) throw new DemoError(429, 'Too many failed attempts. Please try again tomorrow or contact an administrator.')
        const expected = str(tx.get('lost_item_private', item.id)?.private_ownership_info)
        if (!expected) {
          throw new DemoError(409, 'No private ownership details were recorded for this report, so the credential cannot be recovered online. Please contact an administrator.')
        }
        if (answerSimilarity(answer, expected) < ANSWER_THRESHOLD) {
          tx.audit('FAILED_CREDENTIAL_RECOVERY', 'lost_item', item.id as string, uid)
          return { __error: `That doesn’t match the private details on file. ${Math.max(0, MAX_FAILED - recent - 1)} attempt(s) remaining.` }
        }
        tx.update('lost_item_secrets', (s) => s.lost_item_id === item.id, { claim_code_hash: newHash, code_issued_at: nowIso() })
        tx.audit('RECOVERED_CLAIM_CREDENTIAL', 'lost_item', item.id as string, uid)
        notify(tx, {
          user_id: uid,
          type: 'SYSTEM',
          title: 'Your claim credential was reset',
          message: `A new claim credential was issued for “${item.title}”. The previous code no longer works.`,
          link: `/lost/${item.id}`,
        })
        return { claim_code: newCode }
      })
    }

    case 'approve-claim':
      return transact((tx) => {
        const admin = requireAdmin(tx, caller)
        const claim = loadClaim(tx, body.claim_id, caller)
        if (!['PENDING', 'UNDER_REVIEW'].includes(claim.status as string)) {
          throw new DemoError(409, `Claims that are ${String(claim.status).toLowerCase()} cannot be approved.`)
        }
        const pointId = (body.collection_point_id as string) || (claim.collection_point_id as string)
        const point = pointId ? tx.get('collection_points', pointId) : null
        if (!point || point.status !== 'ACTIVE') throw new DemoError(400, 'Assign the collection point where the owner will collect the item.')
        const now = nowIso()
        tx.update('claims', (c) => c.id === claim.id, {
          status: 'APPROVED',
          is_locked: false,
          approved_at: now,
          reviewed_at: now,
          reviewed_by: admin,
          collection_point_id: point.id,
        })
        tx.insert('claim_verifications', {
          claim_id: claim.id,
          verification_type: 'ADMIN_REVIEW',
          result: 'PASSED',
          verified_by: admin,
          notes: str(body.notes) || 'Ownership approved by administrator.',
        })
        tx.update('lost_items', (l) => l.id === claim.lost_item_id, { status: 'CLAIMED' })
        tx.update('found_items', (f) => f.id === claim.found_item_id, { status: 'CLAIMED', collection_point_id: point.id })
        const competing = tx.update(
          'claims',
          (c) => c.found_item_id === claim.found_item_id && c.id !== claim.id && ['PENDING', 'UNDER_REVIEW'].includes(c.status as string),
          { status: 'REJECTED', rejected_at: now, reviewed_at: now, reviewed_by: admin, is_locked: false, rejection_reason: 'The item was released to another verified owner.' },
        )
        for (const other of competing) {
          tx.update('lost_items', (l) => l.id === other.lost_item_id && l.status === 'CLAIM_PENDING', { status: 'LOST' })
          notify(tx, {
            user_id: other.claimant_id as string,
            type: 'CLAIM',
            title: 'Your claim was not approved',
            message: 'The item was released to another verified owner. Your lost report stays open for new matches.',
            link: `/claims/${other.id}`,
          })
        }
        tx.audit('APPROVED_CLAIM', 'claim', claim.id as string, admin, { collection_point_id: point.id, competing_rejected: competing.length })
        notify(tx, {
          user_id: claim.claimant_id as string,
          type: 'COLLECTION',
          title: 'Your claim has been approved — your item is ready for collection',
          message: `Collect it at ${point.name}${point.address ? ` (${point.address})` : ''}. Bring your claim credential.`,
          link: `/claims/${claim.id}`,
        })
        return tx.get('claims', claim.id)
      })

    case 'reject-claim':
      return transact((tx) => {
        const admin = requireAdmin(tx, caller)
        const claim = loadClaim(tx, body.claim_id, caller)
        const reason = str(body.reason)
        if (!reason) throw new DemoError(400, 'reason is required')
        if (!['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(claim.status as string)) {
          throw new DemoError(409, `Claims that are ${String(claim.status).toLowerCase()} cannot be rejected.`)
        }
        const now = nowIso()
        tx.update('claims', (c) => c.id === claim.id, {
          status: 'REJECTED',
          is_locked: false,
          rejected_at: now,
          reviewed_at: now,
          reviewed_by: admin,
          rejection_reason: reason,
        })
        tx.insert('claim_verifications', { claim_id: claim.id, verification_type: 'ADMIN_REVIEW', result: 'FAILED', verified_by: admin, notes: reason })
        releaseItems(tx, claim)
        tx.audit('REJECTED_CLAIM', 'claim', claim.id as string, admin, { reason })
        notify(tx, {
          user_id: claim.claimant_id as string,
          type: 'CLAIM',
          title: 'Your claim has been rejected',
          message: `Reason: ${reason}. Your lost report stays open and we’ll keep looking for matches.`,
          link: `/claims/${claim.id}`,
        })
        return tx.get('claims', claim.id)
      })

    case 'complete-collection': {
      const code = str(body.claim_code)
      const codeHash = code ? await hashClaimCode(code) : null
      return transact((tx) => {
        const officer = requireAdmin(tx, caller)
        if (!tx.get('profiles', officer)?.is_collection_officer) throw new DemoError(403, 'Only collection officers can release items.')
        const claim = loadClaim(tx, body.claim_id, caller)
        if (claim.status !== 'APPROVED') throw new DemoError(409, 'Only approved claims can be collected.')
        const override = str(body.override_reason)
        if (!code && !override) {
          throw new DemoError(400, 'Enter the claimant’s claim credential, or record why identity was verified manually.')
        }
        if (codeHash) {
          const ok = tx.get('lost_item_secrets', claim.lost_item_id)?.claim_code_hash === codeHash
          recordAttempt(tx, claim, officer, 'CLAIM_CODE', ok)
          if (!ok) return { __error: 'That claim credential is not valid for this claim.' }
        }
        const now = nowIso()
        tx.update('claims', (c) => c.id === claim.id, { status: 'COMPLETED', completed_at: now })
        tx.insert('collections', {
          claim_id: claim.id,
          collected_by: officer,
          collected_at: now,
          notes: [str(body.notes), override && `Manual identity verification: ${override}`].filter(Boolean).join('\n') || null,
        })
        tx.update('lost_items', (l) => l.id === claim.lost_item_id, { status: 'RESOLVED' })
        tx.update('found_items', (f) => f.id === claim.found_item_id, { status: 'RETURNED' })
        tx.update('match_candidates', (m) => m.found_item_id === claim.found_item_id && m.status === 'OPEN', { status: 'DISMISSED' })
        tx.audit('COMPLETED_COLLECTION', 'claim', claim.id as string, officer, { verified_by: code ? 'CLAIM_CODE' : 'MANUAL_OVERRIDE' })
        notify(tx, {
          user_id: claim.claimant_id as string,
          type: 'COLLECTION',
          title: 'Your item has been collected',
          message: 'Your item was handed over and your case is closed. Thank you for using FoundIT!',
          link: `/claims/${claim.id}`,
        })
        return tx.get('claims', claim.id)
      })
    }

    case 'log-qr-scan':
      return transact((tx) => {
        const slug = str(body.qr_slug).toLowerCase()
        const action = str(body.action).toUpperCase() || 'SCAN'
        const point = tx.find('collection_points', (p) => p.qr_slug === slug && p.qr_active === true && p.status === 'ACTIVE')
        if (!point) throw new DemoError(404, 'This QR code is no longer active.', 'QR_INACTIVE')
        tx.audit(`QR_SCAN_${action}`, 'collection_point', point.id as string, caller.uid, { qr_slug: slug })
        return {
          collection_point_id: point.id,
          name: point.name,
          address: point.address,
          description: point.description,
          contact: point.contact,
          location_id: point.location_id,
          location_name: point.location_id ? tx.get('locations', point.location_id)?.name ?? null : null,
        }
      })

    case 'expire-unclaimed-items':
      return transact((tx) => {
        requireAdmin(tx, caller)
        return { expired: expireUnclaimed(tx, caller.uid) }
      })

    default:
      throw new DemoError(404, `Function ${name} is not available in demo mode.`)
  }
}

// ─── RPC (SQL functions) ────────────────────────────────────────────────

function expireUnclaimed(tx: Tx, uid: string | null): number {
  const expired = tx.update(
    'found_items',
    (f) => new Date(f.retention_expires_at as string).getTime() < Date.now() && ['FOUND', 'IN_STORAGE', 'MATCHED'].includes(f.status as string),
    { status: 'UNCLAIMED_EXPIRED' },
  )
  for (const f of expired) {
    tx.audit('EXPIRED_UNCLAIMED_ITEM', 'found_item', f.id as string, uid, { title: f.title })
    tx.update('match_candidates', (m) => m.found_item_id === f.id && m.status === 'OPEN', { status: 'DISMISSED' })
  }
  if (expired.length) {
    notify(tx, {
      toAdmins: true,
      type: 'SYSTEM',
      title: 'Unclaimed items expired',
      message: `${expired.length} found item(s) passed their retention period and were marked unclaimed.`,
      link: '/admin/items?tab=found&status=UNCLAIMED_EXPIRED',
    })
  }
  return expired.length
}

const monthKey = (iso: string) => iso.slice(0, 7)

export function callRpc(name: string, args: Body, caller: Caller): unknown {
  return transact((tx) => {
    const uid = caller.uid
    const admin = tx.isAdmin(uid)
    const deny = () => {
      throw new DemoError(403, 'Administrator access is required', '42501')
    }

    switch (name) {
      case 'admin_update_user': {
        if (!admin) deny()
        const target = tx.get('profiles', args.target_user_id)
        if (!target) throw new DemoError(404, 'User not found')
        if (target.id === uid && args.new_role === 'user') throw new DemoError(403, 'You cannot remove your own admin role')
        const role = (args.new_role as string) ?? target.role
        const officer = role !== 'admin' ? false : ((args.new_is_collection_officer as boolean | null) ?? target.is_collection_officer)
        tx.update('profiles', (p) => p.id === target.id, { role, is_collection_officer: officer })
        tx.audit('UPDATED_USER_ROLE', 'profile', target.id as string, uid, { role, is_collection_officer: officer })
        return tx.get('profiles', target.id)
      }

      case 'dismiss_match': {
        const m = tx.get('match_candidates', args.p_match_id)
        const lost = m && tx.get('lost_items', m.lost_item_id)
        if (!m || !lost || (lost.user_id !== uid && !admin)) throw new DemoError(404, 'Match not found')
        if (m.status !== 'OPEN') throw new DemoError(400, `This match has already been ${String(m.status).toLowerCase()}`)
        tx.update('match_candidates', (x) => x.id === m.id, { status: 'DISMISSED' })
        const stillOpen = (col: string, id: unknown) => tx.where('match_candidates', (x) => x[col] === id && x.status === 'OPEN').length
        if (lost.status === 'MATCHED' && !stillOpen('lost_item_id', lost.id)) tx.update('lost_items', (x) => x.id === lost.id, { status: 'LOST' })
        const f = tx.get('found_items', m.found_item_id)
        if (f?.status === 'MATCHED' && !stillOpen('found_item_id', f.id)) {
          tx.update('found_items', (x) => x.id === f.id, { status: f.collection_point_id ? 'IN_STORAGE' : 'FOUND' })
        }
        tx.audit('DISMISSED_MATCH', 'match_candidate', m.id as string, uid, { score: m.score })
        return tx.get('match_candidates', m.id)
      }

      case 'cancel_claim': {
        const c = tx.get('claims', args.p_claim_id)
        if (!c || c.claimant_id !== uid) throw new DemoError(404, 'Claim not found')
        if (!['PENDING', 'UNDER_REVIEW'].includes(c.status as string)) throw new DemoError(400, 'Only pending claims can be cancelled')
        tx.update('claims', (x) => x.id === c.id, { status: 'CANCELLED', is_locked: false })
        tx.update('match_candidates', (m) => m.id === c.match_candidate_id && m.status === 'CONVERTED_TO_CLAIM', { status: 'OPEN' })
        tx.update('lost_items', (l) => l.id === c.lost_item_id && l.status === 'CLAIM_PENDING', { status: 'MATCHED' })
        const others = tx.where('claims', (o) => o.found_item_id === c.found_item_id && o.id !== c.id && ACTIVE_CLAIMS.includes(o.status as string)).length
        if (!others) {
          const f = tx.get('found_items', c.found_item_id)
          tx.update('found_items', (x) => x.id === c.found_item_id && x.status === 'CLAIM_PENDING', {
            status: f?.collection_point_id ? 'IN_STORAGE' : 'MATCHED',
          })
        }
        tx.audit('CANCELLED_CLAIM', 'claim', c.id as string, uid)
        return tx.get('claims', c.id)
      }

      case 'user_dashboard_stats': {
        const myLost = tx.where('lost_items', (l) => l.user_id === uid)
        const myLostIds = new Set(myLost.map((l) => l.id))
        const myClaims = tx.where('claims', (c) => c.claimant_id === uid)
        return {
          lost_items: myLost.filter((l) => l.status !== 'CANCELLED').length,
          found_items: tx.where('found_items', (f) => f.finder_id === uid).length,
          open_matches: tx.where('match_candidates', (m) => myLostIds.has(m.lost_item_id as string) && m.status === 'OPEN').length,
          active_claims: myClaims.filter((c) => ACTIVE_CLAIMS.includes(c.status as string)).length,
          ready_to_collect: myClaims.filter((c) => c.status === 'APPROVED').length,
          unread_notifications: tx.where('notifications', (n) => n.user_id === uid && !n.is_read && n.channel === 'IN_APP').length,
        }
      }

      case 'admin_dashboard_stats': {
        if (!admin) deny()
        const lost = tx.rows('lost_items')
        const found = tx.rows('found_items')
        const claims = tx.rows('claims')
        const resolved = lost.filter((l) => l.status === 'RESOLVED').length
        const reportable = lost.filter((l) => l.status !== 'CANCELLED').length
        return {
          users: tx.rows('profiles').length,
          lost_items: lost.length,
          found_items: found.length,
          open_matches: tx.where('match_candidates', (m) => m.status === 'OPEN').length,
          pending_claims: claims.filter((c) => ['PENDING', 'UNDER_REVIEW'].includes(c.status as string)).length,
          locked_claims: claims.filter((c) => c.is_locked).length,
          ready_for_collection: claims.filter((c) => c.status === 'APPROVED').length,
          resolved_cases: resolved,
          unclaimed_expired: found.filter((f) => f.status === 'UNCLAIMED_EXPIRED').length,
          items_in_storage: found.filter((f) => ['IN_STORAGE', 'CLAIM_PENDING', 'CLAIMED'].includes(f.status as string)).length,
          recovery_rate: reportable ? Math.round((1000 * resolved) / reportable) / 10 : 0,
        }
      }

      case 'admin_analytics': {
        if (!admin) deny()
        const months = Math.max(1, Number(args.p_months ?? 6))
        const start = new Date()
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        start.setMonth(start.getMonth() - (months - 1))
        const since = start.toISOString()
        const lost = tx.rows('lost_items')
        const found = tx.rows('found_items')
        const claims = tx.rows('claims')
        const inWindow = (r: Row) => (r.created_at as string) >= since

        const byCategory = tx
          .rows('categories')
          .map((c) => {
            const l = lost.filter((x) => x.category_id === c.id && inWindow(x)).length
            const f = found.filter((x) => x.category_id === c.id && inWindow(x)).length
            return { name: c.name, lost: l, found: f, total: l + f }
          })
          .filter((r) => r.total > 0)
          .sort((a, b) => b.total - a.total)

        const byLocation = tx
          .rows('locations')
          .map((loc) => ({
            name: loc.name,
            total: [...lost, ...found].filter((x) => x.location_id === loc.id && inWindow(x)).length,
          }))
          .filter((r) => r.total > 0)
          .sort((a, b) => b.total - a.total)

        const monthly = Array.from({ length: months }, (_, i) => {
          const d = new Date(start)
          d.setMonth(start.getMonth() + i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const lm = lost.filter((x) => monthKey(x.created_at as string) === key)
          const active = lm.filter((x) => x.status !== 'CANCELLED')
          return {
            month: key,
            lost: lm.length,
            found: found.filter((x) => monthKey(x.created_at as string) === key).length,
            recovered: claims.filter((c) => c.status === 'COMPLETED' && c.completed_at && monthKey(c.completed_at as string) === key).length,
            recovery_rate: active.length ? Math.round((1000 * active.filter((x) => x.status === 'RESOLVED').length) / active.length) / 10 : 0,
          }
        })

        const statusCounts = new Map<string, number>()
        claims.forEach((c) => statusCounts.set(c.status as string, (statusCounts.get(c.status as string) ?? 0) + 1))

        const completed = claims.filter((c) => c.status === 'COMPLETED' && c.completed_at)
        const hours = completed.map((c) => {
          const l = tx.get('lost_items', c.lost_item_id)
          return l ? (new Date(c.completed_at as string).getTime() - new Date(l.created_at as string).getTime()) / 3600_000 : 0
        })
        const settled = found.filter((f) => new Date(f.retention_expires_at as string).getTime() < Date.now() || ['RETURNED', 'UNCLAIMED_EXPIRED'].includes(f.status as string))

        return {
          since: since.slice(0, 10),
          by_category: byCategory,
          by_location: byLocation,
          monthly,
          claim_status: [...statusCounts].map(([status, count]) => ({ status, count })),
          kpis: {
            total_lost: lost.length,
            total_found: found.length,
            matched: new Set(tx.rows('match_candidates').map((m) => m.lost_item_id)).size,
            recovered: completed.length,
            avg_recovery_hours: hours.length ? Math.round((10 * hours.reduce((a, b) => a + b, 0)) / hours.length) / 10 : null,
            unclaimed_expiry_rate: settled.length
              ? Math.round((1000 * settled.filter((f) => f.status === 'UNCLAIMED_EXPIRED').length) / settled.length) / 10
              : 0,
          },
        }
      }

      case 'admin_set_item_status': {
        if (!admin) deny()
        const table = args.p_kind === 'lost' ? 'lost_items' : 'found_items'
        const ids = new Set(args.p_ids as string[])
        const updated = tx.update(table, (r) => ids.has(r.id as string) && r.status !== args.p_status, { status: args.p_status })
        ids.forEach((id) => tx.audit('ADMIN_SET_ITEM_STATUS', `${args.p_kind}_item`, id, uid, { status: args.p_status }))
        return updated.length
      }

      case 'expire_unclaimed_items':
        if (!admin) deny()
        return expireUnclaimed(tx, uid)

      default:
        throw new DemoError(404, `RPC ${name} is not available in demo mode.`)
    }
  })
}
