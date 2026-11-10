import { appUrl, supabase } from '../lib/supabase'
import { invokeEdge } from '../lib/errors'

export interface QrCollectionPoint {
  collection_point_id: string
  name: string
  address: string | null
  description: string | null
  contact: string | null
  location_id: string | null
  location_name: string | null
}

/** Logs the scan (audit_logs, server-side) and resolves the collection point. */
export function logQrScan(slug: string, action: 'SCAN' | 'STORE' | 'CLAIM' = 'SCAN') {
  return invokeEdge<QrCollectionPoint>('log-qr-scan', { qr_slug: slug, action })
}

/** Read-only lookup (no logging) for an active collection point. */
export async function getCollectionPointBySlug(slug: string) {
  const { data } = await supabase
    .from('collection_points')
    .select('*')
    .eq('qr_slug', slug)
    .eq('qr_active', true)
    .maybeSingle()
  return data
}

/** The URL encoded into a FoundIT Box QR code (spec §27.1). */
export function qrUrl(slug: string): string {
  return `${appUrl}/q/${slug}`
}
