// POST /expire-unclaimed-items
// Marks found items past retention_expires_at as UNCLAIMED_EXPIRED, logs
// EXPIRED_UNCLAIMED_ITEM and notifies admins (all inside the SQL function).
// Runs daily via pg_cron; this endpoint lets an admin (or an external
// scheduler using the service role) trigger it on demand.

import { ok, serve } from '../_shared/http.ts'
import { adminClient, isServiceCall, requireAdmin } from '../_shared/supabase.ts'

serve(async (req) => {
  if (!isServiceCall(req)) await requireAdmin(req)

  const { data, error } = await adminClient().rpc('expire_unclaimed_items')
  if (error) throw error
  return ok({ expired: Number(data ?? 0) })
})
