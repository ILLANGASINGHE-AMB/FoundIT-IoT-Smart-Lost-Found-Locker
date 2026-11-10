import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

let cachedAdmin: SupabaseClient | null = null

/** Service-role client: bypasses RLS. Only ever used server-side. */
export function adminClient(): SupabaseClient {
  cachedAdmin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdmin
}

export interface Caller {
  user: User
  role: 'user' | 'admin'
  isCollectionOfficer: boolean
}

function bearer(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/** True when the request carries the service-role key (function-to-function calls). */
export function isServiceCall(req: Request): boolean {
  const token = bearer(req)
  return Boolean(token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
}

/** Resolve the signed-in user from the request's JWT, or throw 401. */
export async function requireUser(req: Request): Promise<Caller> {
  const token = bearer(req)
  if (!token) throw new HttpError(401, 'Please sign in to continue.')

  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.')

  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_collection_officer')
    .eq('id', data.user.id)
    .single()

  return {
    user: data.user,
    role: profile?.role === 'admin' ? 'admin' : 'user',
    isCollectionOfficer: profile?.role === 'admin' && Boolean(profile?.is_collection_officer),
  }
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await requireUser(req)
  if (caller.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
  return caller
}

/** Write an audit_logs row (service role). Never throws. */
export async function audit(
  action: string,
  entity: { type: string; id?: string | null },
  userId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await adminClient().from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entity.type,
    entity_id: entity.id ?? null,
    metadata,
  })
  if (error) console.error('audit log failed:', action, error.message)
}

/** Run work after the response is sent (Supabase Edge Runtime), or inline as a fallback. */
export function runInBackground(promise: Promise<unknown>): void {
  const safe = promise.catch((err) => console.error('background task failed:', err?.message ?? err))
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(safe)
}
