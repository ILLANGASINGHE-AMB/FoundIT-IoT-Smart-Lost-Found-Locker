// POST /log-qr-scan  { qr_slug, action: "SCAN" | "STORE" | "CLAIM" }
// Public (verify_jwt = false): QR scans can happen before login.
// Resolves an active collection point by slug and logs the scan to
// audit_logs with the service role (spec §27.4). A scan only changes where
// the user lands — never what they are allowed to do.

import { HttpError, ok, serve } from '../_shared/http.ts'
import { adminClient, audit } from '../_shared/supabase.ts'

const ACTIONS = new Set(['SCAN', 'STORE', 'CLAIM'])

async function optionalUserId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await adminClient().auth.getUser(token)
  return data.user?.id ?? null
}

serve(async (req, body) => {
  const slug = typeof body.qr_slug === 'string' ? body.qr_slug.trim().toLowerCase() : ''
  const action = typeof body.action === 'string' ? body.action.toUpperCase() : 'SCAN'
  if (!/^[a-z0-9_-]{6,32}$/.test(slug)) throw new HttpError(404, 'This QR code is not recognised.', 'QR_NOT_FOUND')
  if (!ACTIONS.has(action)) throw new HttpError(400, 'action must be SCAN, STORE or CLAIM')

  const { data: point } = await adminClient()
    .from('collection_points')
    .select('id, name, address, description, contact, location_id, location:locations(name)')
    .eq('qr_slug', slug)
    .eq('qr_active', true)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!point) throw new HttpError(404, 'This QR code is no longer active.', 'QR_INACTIVE')

  await audit(`QR_SCAN_${action}`, { type: 'collection_point', id: point.id }, await optionalUserId(req), {
    qr_slug: slug,
  })

  return ok({
    collection_point_id: point.id,
    name: point.name,
    address: point.address,
    description: point.description,
    contact: point.contact,
    location_id: point.location_id,
    // deno-lint-ignore no-explicit-any
    location_name: (point as any).location?.name ?? null,
  })
})
