// ════════════════════════════════════════════════════════════════════════
// Demo mode — in-browser database (localStorage).
//
// Mirrors the Supabase schema closely enough that the real app code runs
// unchanged. Every operation re-reads from localStorage so several tabs
// stay consistent. Not secure and not for production: it exists so the
// whole system can be tried on localhost without a Supabase project.
// ════════════════════════════════════════════════════════════════════════

export type Row = Record<string, unknown> & { id?: string }
export type Tables = Record<string, Row[]>

const STORAGE_KEY = 'foundit-demo-db-v1'

export const TABLES = [
  'auth_users',
  'profiles',
  'categories',
  'locations',
  'collection_points',
  'lost_items',
  'lost_item_private',
  'lost_item_secrets',
  'found_items',
  'found_item_secrets',
  'item_images',
  'match_candidates',
  'claims',
  'claim_verifications',
  'claim_attempts',
  'collections',
  'notifications',
  'audit_logs',
] as const

/** Primary key per table (tables keyed by a foreign key have no `id`). */
export const PRIMARY_KEY: Record<string, string> = {
  lost_item_private: 'lost_item_id',
  lost_item_secrets: 'lost_item_id',
  found_item_secrets: 'found_item_id',
}
export const pk = (table: string) => PRIMARY_KEY[table] ?? 'id'

/** Foreign keys, used to resolve PostgREST-style embeds. */
export const FOREIGN_KEYS: { table: string; column: string; ref: string }[] = [
  { table: 'lost_items', column: 'user_id', ref: 'profiles' },
  { table: 'lost_items', column: 'category_id', ref: 'categories' },
  { table: 'lost_items', column: 'location_id', ref: 'locations' },
  { table: 'lost_item_private', column: 'lost_item_id', ref: 'lost_items' },
  { table: 'lost_item_secrets', column: 'lost_item_id', ref: 'lost_items' },
  { table: 'found_items', column: 'finder_id', ref: 'profiles' },
  { table: 'found_items', column: 'category_id', ref: 'categories' },
  { table: 'found_items', column: 'location_id', ref: 'locations' },
  { table: 'found_items', column: 'collection_point_id', ref: 'collection_points' },
  { table: 'found_item_secrets', column: 'found_item_id', ref: 'found_items' },
  { table: 'item_images', column: 'lost_item_id', ref: 'lost_items' },
  { table: 'item_images', column: 'found_item_id', ref: 'found_items' },
  { table: 'item_images', column: 'uploaded_by', ref: 'profiles' },
  { table: 'collection_points', column: 'location_id', ref: 'locations' },
  { table: 'match_candidates', column: 'lost_item_id', ref: 'lost_items' },
  { table: 'match_candidates', column: 'found_item_id', ref: 'found_items' },
  { table: 'claims', column: 'match_candidate_id', ref: 'match_candidates' },
  { table: 'claims', column: 'lost_item_id', ref: 'lost_items' },
  { table: 'claims', column: 'found_item_id', ref: 'found_items' },
  { table: 'claims', column: 'claimant_id', ref: 'profiles' },
  { table: 'claims', column: 'reviewed_by', ref: 'profiles' },
  { table: 'claims', column: 'collection_point_id', ref: 'collection_points' },
  { table: 'claim_verifications', column: 'claim_id', ref: 'claims' },
  { table: 'claim_verifications', column: 'verified_by', ref: 'profiles' },
  { table: 'claim_attempts', column: 'claim_id', ref: 'claims' },
  { table: 'claim_attempts', column: 'attempted_by', ref: 'profiles' },
  { table: 'collections', column: 'claim_id', ref: 'claims' },
  { table: 'collections', column: 'collected_by', ref: 'profiles' },
  { table: 'notifications', column: 'user_id', ref: 'profiles' },
  { table: 'audit_logs', column: 'user_id', ref: 'profiles' },
]

export const uuid = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()

const TABLE_DEFAULTS: Record<string, () => Row> = {
  profiles: () => ({ role: 'user', is_collection_officer: false, phone: null, address: null, bio: null, profile_image: null }),
  collection_points: () => ({ status: 'ACTIVE', qr_active: true, location_id: null, address: null, description: null, contact: null }),
  lost_items: () => ({ status: 'LOST', brand: null, model: null, color: null, identifier_type: null, retention_expires_at: null, description_embedding: null }),
  found_items: () => ({
    status: 'FOUND',
    brand: null,
    model: null,
    color: null,
    identifier_type: null,
    collection_point_id: null,
    description_embedding: null,
    retention_expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
  }),
  match_candidates: () => ({ status: 'OPEN', score_breakdown: {} }),
  claims: () => ({
    status: 'PENDING',
    is_locked: false,
    private_attribute_answer: null,
    collection_point_id: null,
    rejection_reason: null,
    submitted_at: nowIso(),
    reviewed_at: null,
    approved_at: null,
    rejected_at: null,
    completed_at: null,
    reviewed_by: null,
    match_candidate_id: null,
  }),
  notifications: () => ({ type: 'SYSTEM', channel: 'IN_APP', link: null, is_read: false }),
  audit_logs: () => ({ metadata: {}, entity_type: null, entity_id: null, user_id: null }),
  claim_verifications: () => ({ verified_by: null, notes: null }),
  collections: () => ({ notes: null, collected_at: nowIso() }),
}

const HAS_UPDATED_AT = new Set([
  'profiles', 'collection_points', 'lost_items', 'lost_item_private', 'lost_item_secrets',
  'found_items', 'found_item_secrets', 'match_candidates', 'claims',
])

// ─── Persistence ────────────────────────────────────────────────────────

let seedFn: (() => Promise<Tables>) | null = null
export function registerSeed(fn: () => Promise<Tables>) {
  seedFn = fn
}

function emptyTables(): Tables {
  return Object.fromEntries(TABLES.map((t) => [t, []]))
}

export function load(): Tables {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...emptyTables(), ...JSON.parse(raw) }
  } catch {
    /* corrupted or unavailable storage — start empty */
  }
  return emptyTables()
}

export function save(db: Tables) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (err) {
    console.error('Demo DB could not be saved (storage full?)', err)
  }
}

let ready: Promise<void> | null = null

/** Seeds the demo database on first use. */
export function ensureSeeded(): Promise<void> {
  ready ??= (async () => {
    let exists = false
    try {
      exists = Boolean(localStorage.getItem(STORAGE_KEY))
    } catch {
      exists = false
    }
    if (!exists && seedFn) save(await seedFn())
  })()
  return ready
}

export async function resetDemoData() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('foundit-demo-session')
  } catch {
    /* ignore */
  }
  ready = null
  await ensureSeeded()
}

// ─── Row helpers (service-level, no RLS) ────────────────────────────────

export function withDefaults(table: string, values: Row): Row {
  const base: Row = { ...(TABLE_DEFAULTS[table]?.() ?? {}) }
  const row: Row = { ...base, ...values }
  if (pk(table) === 'id' && !row.id) row.id = uuid()
  if (!('created_at' in row) && table !== 'collections') row.created_at = nowIso()
  if (HAS_UPDATED_AT.has(table)) row.updated_at = row.updated_at ?? nowIso()
  return row
}

export function touch(table: string, row: Row) {
  if (HAS_UPDATED_AT.has(table)) row.updated_at = nowIso()
}

/** Insert listeners (Realtime emulation). */
type InsertListener = (table: string, row: Row) => void
const insertListeners = new Set<InsertListener>()
export function onInsert(fn: InsertListener) {
  insertListeners.add(fn)
  return () => insertListeners.delete(fn)
}
export function emitInsert(table: string, row: Row) {
  insertListeners.forEach((fn) => fn(table, row))
}

/**
 * Run a read-modify-write transaction against the stored database.
 * Inserts made through `tx.insert` are announced to Realtime listeners
 * after the transaction is saved.
 */
export function transact<T>(fn: (tx: Tx) => T): T {
  const db = load()
  const inserted: [string, Row][] = []
  const tx = new Tx(db, inserted)
  const result = fn(tx)
  save(db)
  inserted.forEach(([table, row]) => emitInsert(table, row))
  return result
}

export class Tx {
  db: Tables
  private inserted: [string, Row][]
  constructor(db: Tables, inserted: [string, Row][]) {
    this.db = db
    this.inserted = inserted
  }

  rows(table: string): Row[] {
    return (this.db[table] ??= [])
  }

  find(table: string, pred: (r: Row) => boolean): Row | undefined {
    return this.rows(table).find(pred)
  }

  get(table: string, id: unknown): Row | undefined {
    const key = pk(table)
    return this.rows(table).find((r) => r[key] === id)
  }

  where(table: string, pred: (r: Row) => boolean): Row[] {
    return this.rows(table).filter(pred)
  }

  insert(table: string, values: Row): Row {
    const row = withDefaults(table, values)
    this.rows(table).push(row)
    this.inserted.push([table, row])
    return row
  }

  update(table: string, pred: (r: Row) => boolean, changes: Row): Row[] {
    const updated: Row[] = []
    for (const row of this.rows(table)) {
      if (pred(row)) {
        Object.assign(row, changes)
        touch(table, row)
        updated.push(row)
      }
    }
    return updated
  }

  remove(table: string, pred: (r: Row) => boolean): Row[] {
    const all = this.rows(table)
    const removed = all.filter(pred)
    this.db[table] = all.filter((r) => !pred(r))
    return removed
  }

  audit(action: string, entityType: string, entityId: string | null, userId: string | null, metadata: Row = {}) {
    this.insert('audit_logs', { action, entity_type: entityType, entity_id: entityId, user_id: userId, metadata })
  }

  isAdmin(uid: string | null): boolean {
    return Boolean(uid && this.get('profiles', uid)?.role === 'admin')
  }
}
