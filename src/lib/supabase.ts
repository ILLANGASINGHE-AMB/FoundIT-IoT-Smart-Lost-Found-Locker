import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createDemoClient } from './demo/client'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Demo mode runs the whole system in the browser (localStorage +
 * IndexedDB) — no Supabase project needed. It is on when
 * VITE_DEMO_MODE=true, or automatically when Supabase isn't configured.
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || !isSupabaseConfigured

export const supabase: SupabaseClient = isDemoMode
  ? createDemoClient()
  : createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow so email-verification / password-reset links work even
        // when opened on a different device than the one that signed up.
        flowType: 'implicit',
      },
    })

/** Public base URL of the deployed app (used in auth redirects and QR codes). */
export const appUrl = (
  (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin
).replace(/\/$/, '')
