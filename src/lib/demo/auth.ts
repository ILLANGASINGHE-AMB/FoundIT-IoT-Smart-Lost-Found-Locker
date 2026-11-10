// Demo mode — Supabase Auth stand-in. Passwords are SHA-256 hashed in
// localStorage (demo only). Email confirmation is skipped; password reset
// "emails" are shown in the browser console and as a toast.

import { ensureSeeded, load, nowIso, transact, uuid, type Row } from './store'

const SESSION_KEY = 'foundit-demo-session'
type Listener = (event: string, session: DemoSession | null) => void

export interface DemoUser {
  id: string
  email: string
  email_confirmed_at: string | null
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
  aud: string
  created_at: string
}

export interface DemoSession {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  expires_at: number
  user: DemoUser
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`foundit-demo:${password}`))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function toUser(row: Row): DemoUser {
  return {
    id: row.id as string,
    email: row.email as string,
    email_confirmed_at: (row.email_confirmed_at as string) ?? null,
    user_metadata: (row.user_metadata as Record<string, unknown>) ?? {},
    app_metadata: { provider: 'email' },
    aud: 'authenticated',
    created_at: row.created_at as string,
  }
}

function makeSession(user: DemoUser): DemoSession {
  return {
    access_token: `demo.${user.id}.${uuid()}`,
    refresh_token: uuid(),
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    user,
  }
}

const err = (message: string, status = 400) => ({ message, status, name: 'AuthApiError' })

export class DemoAuth {
  private listeners = new Set<Listener>()
  private session: DemoSession | null = null

  constructor() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      this.session = raw ? JSON.parse(raw) : null
    } catch {
      this.session = null
    }
    // Password-reset link opened (…/reset-password#demo_recovery=<userId>)
    const match = window.location.hash.match(/demo_recovery=([0-9a-f-]{36})/)
    if (match) {
      const row = load().auth_users.find((u) => u.id === match[1])
      if (row) {
        this.setSession(makeSession(toUser(row)), 'PASSWORD_RECOVERY')
        history.replaceState(null, '', window.location.pathname)
      }
    }
    // Keep tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key !== SESSION_KEY) return
      this.session = e.newValue ? JSON.parse(e.newValue) : null
      this.emit(this.session ? 'SIGNED_IN' : 'SIGNED_OUT')
    })
  }

  get currentUserId(): string | null {
    return this.session?.user.id ?? null
  }

  private setSession(session: DemoSession | null, event: string) {
    this.session = session
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    // Defer like supabase-js so React state updates outside the caller.
    setTimeout(() => this.emit(event), 0)
  }

  private emit(event: string) {
    this.listeners.forEach((fn) => fn(event, this.session))
  }

  async getSession() {
    await ensureSeeded()
    if (this.session && !load().auth_users.some((u) => u.id === this.session!.user.id)) this.session = null
    return { data: { session: this.session }, error: null }
  }

  async getUser() {
    return { data: { user: this.session?.user ?? null }, error: null }
  }

  onAuthStateChange(callback: Listener) {
    this.listeners.add(callback)
    setTimeout(() => callback('INITIAL_SESSION', this.session), 0)
    return { data: { subscription: { unsubscribe: () => this.listeners.delete(callback) } } }
  }

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    await ensureSeeded()
    const normalized = email.trim().toLowerCase()
    if (password.length < 6) return { data: { user: null, session: null }, error: err('Password should be at least 6 characters.') }
    const hash = await hashPassword(password)
    const result = transact((tx) => {
      if (tx.find('auth_users', (u) => u.email === normalized)) return null
      const meta = options?.data ?? {}
      const row = tx.insert('auth_users', {
        email: normalized,
        password_hash: hash,
        email_confirmed_at: nowIso(), // demo: no confirmation email
        user_metadata: meta,
      })
      // on_auth_user_created trigger
      tx.insert('profiles', {
        id: row.id,
        email: normalized,
        full_name: (meta.full_name as string) || normalized.split('@')[0],
        phone: (meta.phone as string) || null,
      })
      return row
    })
    if (!result) return { data: { user: null, session: null }, error: err('User already registered') }
    const user = toUser(result)
    const session = makeSession(user)
    this.setSession(session, 'SIGNED_IN')
    return { data: { user, session }, error: null }
  }

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await ensureSeeded()
    const row = load().auth_users.find((u) => u.email === email.trim().toLowerCase())
    if (!row || row.password_hash !== (await hashPassword(password))) {
      return { data: { user: null, session: null }, error: err('Invalid login credentials') }
    }
    const user = toUser(row)
    const session = makeSession(user)
    this.setSession(session, 'SIGNED_IN')
    return { data: { user, session }, error: null }
  }

  async signInWithOAuth() {
    return { data: null, error: err('Google sign-in is not available in demo mode.') }
  }

  async signOut() {
    this.setSession(null, 'SIGNED_OUT')
    return { error: null }
  }

  async resetPasswordForEmail(email: string) {
    await ensureSeeded()
    const row = load().auth_users.find((u) => u.email === email.trim().toLowerCase())
    if (row) {
      const link = `${window.location.origin}/reset-password#demo_recovery=${row.id}`
      console.info(`[FoundIT demo] Password reset link for ${row.email}: ${link}`)
      window.dispatchEvent(new CustomEvent('foundit-demo-email', { detail: { to: row.email, link } }))
    }
    return { data: {}, error: null }
  }

  async resend() {
    return { data: {}, error: null }
  }

  async updateUser({ password }: { password?: string }) {
    if (!this.session) return { data: { user: null }, error: err('Not signed in', 401) }
    if (password) {
      const hash = await hashPassword(password)
      const id = this.session.user.id
      transact((tx) => tx.update('auth_users', (u) => u.id === id, { password_hash: hash }))
    }
    this.setSession(this.session, 'USER_UPDATED')
    return { data: { user: this.session.user }, error: null }
  }
}
