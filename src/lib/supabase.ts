import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error(
    'FoundIT: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env.local and fill in your Supabase project values.',
  )
}

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Implicit flow so email-verification / password-reset links work even
      // when opened on a different device than the one that signed up.
      flowType: 'implicit',
    },
  },
)

/** Public base URL of the deployed app (used in auth redirects and QR codes). */
export const appUrl = (
  (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin
).replace(/\/$/, '')
