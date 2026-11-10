// Demo mode — a PostgREST-style query builder over the localStorage store.
// Supports the subset the app uses (select with embeds / !inner / fkey
// hints / column aliases, eq/neq/in/gt/gte/lte/ilike/or, order, range,
// limit, count, head, single/maybeSingle, insert/update/upsert/delete)
// and emulates the Row Level Security policies from the migrations.

import { FOREIGN_KEYS, load, pk, transact, type Row, type Tables, type Tx } from './store'

export interface QueryResult {
  data: unknown
  error: { message: string; code?: string } | null
  count: number | null
  status: number
  statusText: string
}

// ─── RLS emulation ──────────────────────────────────────────────────────

class Rls {
  private db: Tables
  private uid: string | null
  constructor(db: Tables, uid: string | null) {
    this.db = db
    this.uid = uid
  }

  private get(table: string, id: unknown) {
    return this.db[table]?.find((r) => r[pk(table)] === id)
  }

  get isAdmin() {
    return Boolean(this.uid && this.get('profiles', this.uid)?.role === 'admin')
  }

  ownsLost = (id: unknown) => this.get('lost_items', id)?.user_id === this.uid && this.uid !== null
  ownsFound = (id: unknown) => this.get('found_items', id)?.finder_id === this.uid && this.uid !== null
  ownsClaim = (id: unknown) => this.get('claims', id)?.claimant_id === this.uid && this.uid !== null

  canViewFound = (id: unknown) =>
    this.isAdmin ||
    this.ownsFound(id) ||
    (this.db.match_candidates ?? []).some((m) => m.found_item_id === id && this.ownsLost(m.lost_item_id))

  canSelect(table: string, r: Row): boolean {
    const admin = this.isAdmin
    switch (table) {
      case 'profiles':
        return r.id === this.uid || admin
      case 'categories':
      case 'locations':
        return true
      case 'collection_points':
        return r.status === 'ACTIVE' || admin
      case 'lost_items':
        return r.user_id === this.uid || admin
      case 'lost_item_private':
        return this.ownsLost(r.lost_item_id) || admin
      case 'found_items':
        return this.canViewFound(r.id)
      case 'item_images':
        return r.lost_item_id ? this.ownsLost(r.lost_item_id) || admin : this.canViewFound(r.found_item_id)
      case 'match_candidates':
        return this.ownsLost(r.lost_item_id) || admin
      case 'claims':
        return r.claimant_id === this.uid || admin
      case 'claim_verifications':
      case 'collections':
        return this.ownsClaim(r.claim_id) || admin
      case 'claim_attempts':
        return r.attempted_by === this.uid || admin
      case 'notifications':
        return r.user_id === this.uid || admin
      case 'audit_logs':
        return admin
      default:
        return false // secret tables and auth_users are never readable
    }
  }

  /** Column-level UPDATE grants + update policies + guard triggers. */
  checkUpdate(table: string, r: Row, changes: Row): string | null {
    const cols = Object.keys(changes)
    const allowed = (list: string[]) => cols.every((c) => list.includes(c))
    const admin = this.isAdmin
    switch (table) {
      case 'profiles':
        if (r.id !== this.uid) return 'skip'
        return allowed(['full_name', 'phone', 'address', 'bio', 'profile_image']) ? null : 'permission denied for table profiles'
      case 'lost_items': {
        if (r.user_id !== this.uid && !admin) return 'skip'
        if (!allowed(['category_id', 'location_id', 'title', 'description', 'brand', 'model', 'color', 'date_lost', 'status'])) {
          return 'permission denied for table lost_items'
        }
        if (admin) return null
        if (!['LOST', 'MATCHED'].includes(r.status as string)) return `This report can no longer be changed (status ${r.status}).`
        if ('status' in changes && changes.status !== r.status && changes.status !== 'CANCELLED') {
          return 'You can only cancel a report; other status changes are made by FoundIT.'
        }
        return null
      }
      case 'found_items': {
        if (r.finder_id !== this.uid && !admin) return 'skip'
        if (admin) return null
        if ('status' in changes && changes.status !== r.status) return 'Only FoundIT staff can change the status of a found report.'
        if (!['FOUND', 'IN_STORAGE', 'MATCHED'].includes(r.status as string)) return `This report can no longer be changed (status ${r.status}).`
        return null
      }
      case 'lost_item_private': {
        const item = this.get('lost_items', r.lost_item_id)
        if (!this.ownsLost(r.lost_item_id) || !['LOST', 'MATCHED'].includes(item?.status as string)) return 'skip'
        return allowed(['private_ownership_info']) ? null : 'permission denied'
      }
      case 'notifications':
        if (r.user_id !== this.uid) return 'skip'
        return allowed(['is_read']) ? null : 'permission denied for table notifications'
      case 'match_candidates':
        if (!admin) return 'skip'
        return allowed(['status']) ? null : 'permission denied'
      case 'collection_points':
        return admin ? null : 'skip'
      default:
        return 'permission denied'
    }
  }

  checkInsert(table: string, r: Row): string | null {
    switch (table) {
      case 'item_images': {
        if (r.uploaded_by !== this.uid) return 'new row violates row-level security policy'
        const count = (this.db.item_images ?? []).filter(
          (i) => (r.lost_item_id && i.lost_item_id === r.lost_item_id) || (r.found_item_id && i.found_item_id === r.found_item_id),
        ).length
        if (count >= 10) return 'A report can have at most 10 photos.'
        const path = String(r.storage_path)
        if (r.lost_item_id && this.ownsLost(r.lost_item_id) && path.startsWith(`lost/${r.lost_item_id}/`)) return null
        if (r.found_item_id && this.ownsFound(r.found_item_id) && path.startsWith(`found/${r.found_item_id}/`)) return null
        return 'new row violates row-level security policy'
      }
      case 'collection_points':
        return this.isAdmin ? null : 'new row violates row-level security policy'
      default:
        return 'permission denied'
    }
  }

  canDelete(table: string, r: Row): boolean {
    if (table === 'item_images') return r.uploaded_by === this.uid || this.isAdmin
    if (table === 'notifications') return r.user_id === this.uid
    return false
  }
}

// ─── Select parsing & embedding ─────────────────────────────────────────

interface SelectNode {
  alias: string
  column?: string // plain column (possibly aliased)
  star?: boolean
  relation?: { table: string; hint?: string; inner: boolean; children: SelectNode[] }
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of input) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function parseSelect(input: string): SelectNode[] {
  return splitTopLevel(input.replace(/\s+/g, ' ')).map((token) => {
    if (token === '*') return { alias: '*', star: true }
    const paren = token.indexOf('(')
    if (paren === -1) {
      const [a, b] = token.split(':').map((s) => s.trim())
      return b ? { alias: a, column: b } : { alias: a, column: a }
    }
    const head = token.slice(0, paren).trim()
    const inside = token.slice(paren + 1, token.lastIndexOf(')'))
    const [aliasPart, targetPart] = head.includes(':') ? head.split(':') : [head, head]
    const [table, ...hints] = targetPart.trim().split('!')
    return {
      alias: aliasPart.trim(),
      relation: {
        table: table.trim(),
        inner: hints.includes('inner'),
        hint: hints.find((h) => h !== 'inner'),
        children: parseSelect(inside),
      },
    }
  })
}

function resolveRelation(source: string, target: string, hint?: string) {
  // many-to-one: source has a column referencing target
  const outgoing = FOREIGN_KEYS.filter((fk) => fk.table === source && fk.ref === target)
  if (outgoing.length) {
    const fk = (hint && outgoing.find((f) => hint === `${source}_${f.column}_fkey`)) || outgoing[0]
    return { kind: 'one' as const, column: fk.column }
  }
  // one-to-many: target references source
  const incoming = FOREIGN_KEYS.find((fk) => fk.table === target && fk.ref === source)
  if (incoming) return { kind: 'many' as const, column: incoming.column }
  throw new Error(`No relationship between ${source} and ${target}`)
}

function project(db: Tables, rls: Rls, table: string, row: Row, nodes: SelectNode[]): Row | null {
  const out: Row = {}
  for (const node of nodes) {
    if (node.star) Object.assign(out, row)
    else if (node.column) out[node.alias] = row[node.column]
  }
  for (const node of nodes) {
    if (!node.relation) continue
    const { table: target, hint, inner, children } = node.relation
    const rel = resolveRelation(table, target, hint)
    const visible = (r: Row) => rls.canSelect(target, r)
    if (rel.kind === 'one') {
      const fkValue = row[rel.column]
      const match = fkValue == null ? undefined : (db[target] ?? []).find((r) => r[pk(target)] === fkValue)
      const value = match && visible(match) ? project(db, rls, target, match, children) : null
      if (inner && !value) return null
      out[node.alias] = value
    } else {
      const matches = (db[target] ?? []).filter((r) => r[rel.column] === row[pk(table)] && visible(r))
      const values = matches.map((r) => project(db, rls, target, r, children)).filter(Boolean)
      if (inner && values.length === 0) return null
      out[node.alias] = values
    }
  }
  return out
}

// ─── Filters ────────────────────────────────────────────────────────────

type Filter = (row: Row) => boolean

const getPath = (row: Row, path: string): unknown =>
  path.split('.').reduce<unknown>((v, key) => (v && typeof v === 'object' ? (v as Row)[key] : undefined), row)

const likeToRegex = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')

const cmp = (a: unknown, b: unknown) => (a == null ? -1 : b == null ? 1 : a < b ? -1 : a > b ? 1 : 0)

function parseOr(expr: string): Filter {
  const parts = splitTopLevel(expr).map((p) => {
    const [col, op, ...rest] = p.split('.')
    const value = rest.join('.')
    if (op === 'ilike') {
      const re = likeToRegex(value)
      return (r: Row) => re.test(String(r[col] ?? ''))
    }
    if (op === 'eq') return (r: Row) => String(r[col]) === value
    return () => false
  })
  return (r) => parts.some((f) => f(r))
}

// ─── Builder ────────────────────────────────────────────────────────────

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

export class DemoQuery implements PromiseLike<QueryResult> {
  private op: Op = 'select'
  private selectStr: string | null = null
  private countMode = false
  private headMode = false
  private filters: Filter[] = []
  private embeddedFilters: Filter[] = []
  private orders: { column: string; ascending: boolean }[] = []
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private limitN: number | null = null
  private singleMode: 'single' | 'maybe' | null = null
  private payload: Row | Row[] | null = null

  private table: string
  private getUid: () => string | null
  private ready: Promise<void>

  constructor(table: string, getUid: () => string | null, ready: Promise<void>) {
    this.table = table
    this.getUid = getUid
    this.ready = ready
  }

  select(columns = '*', opts?: { count?: string; head?: boolean }) {
    this.selectStr = columns
    if (opts?.count) this.countMode = true
    if (opts?.head) this.headMode = true
    return this
  }
  insert(values: Row | Row[]) {
    this.op = 'insert'
    this.payload = values
    return this
  }
  upsert(values: Row | Row[]) {
    this.op = 'upsert'
    this.payload = values
    return this
  }
  update(values: Row) {
    this.op = 'update'
    this.payload = values
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }

  private addFilter(column: string, test: (v: unknown) => boolean) {
    const f: Filter = (row) => test(getPath(row, column))
    if (column.includes('.')) this.embeddedFilters.push(f)
    else this.filters.push(f)
    return this
  }
  eq(c: string, v: unknown) {
    return this.addFilter(c, (x) => x === v || (x != null && v != null && String(x) === String(v)))
  }
  neq(c: string, v: unknown) {
    return this.addFilter(c, (x) => x !== v)
  }
  in(c: string, values: unknown[]) {
    return this.addFilter(c, (x) => values.includes(x))
  }
  gt(c: string, v: unknown) {
    return this.addFilter(c, (x) => x != null && cmp(x, v) > 0)
  }
  gte(c: string, v: unknown) {
    return this.addFilter(c, (x) => x != null && cmp(x, v) >= 0)
  }
  lt(c: string, v: unknown) {
    return this.addFilter(c, (x) => x != null && cmp(x, v) < 0)
  }
  lte(c: string, v: unknown) {
    return this.addFilter(c, (x) => x != null && cmp(x, v) <= 0)
  }
  ilike(c: string, pattern: string) {
    const re = likeToRegex(pattern)
    return this.addFilter(c, (x) => re.test(String(x ?? '')))
  }
  or(expr: string) {
    this.filters.push(parseOr(expr))
    return this
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true })
    return this
  }
  range(from: number, to: number) {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }
  limit(n: number) {
    this.limitN = n
    return this
  }
  single() {
    this.singleMode = 'single'
    return this
  }
  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }

  then<A = QueryResult, B = never>(
    onfulfilled?: ((value: QueryResult) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.ready.then(() => this.execute()).then(onfulfilled, onrejected)
  }

  private fail(message: string, code = '42501', status = 403): QueryResult {
    return { data: null, error: { message, code }, count: null, status, statusText: 'Error' }
  }

  private shape(rows: Row[], count: number | null): QueryResult {
    if (this.singleMode) {
      if (rows.length > 1) return this.fail('JSON object requested, multiple (or no) rows returned', 'PGRST116', 406)
      if (rows.length === 0) {
        return this.singleMode === 'maybe'
          ? { data: null, error: null, count, status: 200, statusText: 'OK' }
          : this.fail('JSON object requested, multiple (or no) rows returned', 'PGRST116', 406)
      }
      return { data: rows[0], error: null, count, status: 200, statusText: 'OK' }
    }
    return { data: this.headMode ? null : rows, error: null, count, status: 200, statusText: 'OK' }
  }

  private readRows(db: Tables, rls: Rls, source: Row[]): { rows: Row[]; count: number } {
    const nodes = parseSelect(this.selectStr ?? '*')
    const rows = source.filter((r) => rls.canSelect(this.table, r)).filter((r) => this.filters.every((f) => f(r)))
    // Order on the raw rows: selected columns may be aliased or omitted.
    for (const o of [...this.orders].reverse()) {
      rows.sort((a, b) => (o.ascending ? 1 : -1) * cmp(a[o.column], b[o.column]))
    }
    let projected = rows
      .map((r) => project(db, rls, this.table, r, nodes))
      .filter((r): r is Row => r !== null && this.embeddedFilters.every((f) => f(r)))
    const count = projected.length
    if (this.rangeFrom !== null) projected = projected.slice(this.rangeFrom, (this.rangeTo ?? projected.length) + 1)
    if (this.limitN !== null) projected = projected.slice(0, this.limitN)
    return { rows: projected, count }
  }

  private execute(): QueryResult {
    const uid = this.getUid()
    try {
      if (this.op === 'select') {
        const db = load()
        const rls = new Rls(db, uid)
        const { rows, count } = this.readRows(db, rls, db[this.table] ?? [])
        return this.shape(rows, this.countMode ? count : null)
      }

      return transact((tx: Tx) => {
        const rls = new Rls(tx.db, uid)
        let affected: Row[] = []

        if (this.op === 'insert' || this.op === 'upsert') {
          const values = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
          for (const v of values) {
            const problem = rls.checkInsert(this.table, v)
            if (problem) throw new RlsError(problem)
            affected.push(tx.insert(this.table, v))
          }
        } else if (this.op === 'update') {
          const changes = this.payload as Row
          const targets = tx.rows(this.table).filter((r) => rls.canSelect(this.table, r) && this.filters.every((f) => f(r)))
          for (const r of targets) {
            const problem = rls.checkUpdate(this.table, r, changes)
            if (problem === 'skip') continue
            if (problem) throw new RlsError(problem)
            affected.push(...tx.update(this.table, (x) => x === r, changes))
          }
        } else if (this.op === 'delete') {
          const targets = tx
            .rows(this.table)
            .filter((r) => rls.canSelect(this.table, r) && this.filters.every((f) => f(r)) && rls.canDelete(this.table, r))
          affected = tx.remove(this.table, (r) => targets.includes(r))
        }

        if (this.selectStr === null) return { data: null, error: null, count: null, status: 204, statusText: 'No Content' }
        const { rows } = this.readRows(tx.db, new Rls(tx.db, uid), affected)
        return this.shape(rows, null)
      })
    } catch (err) {
      if (err instanceof RlsError) return this.fail(err.message)
      return this.fail(err instanceof Error ? err.message : 'Demo query failed', 'DEMO', 400)
    }
  }
}

class RlsError extends Error {}
