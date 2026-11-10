// Keyed hashing for identifiers (spec §13) and claim credentials (spec §24).
// Secrets live only in Edge Function env vars — never shipped to the client.

import { env } from './supabase.ts'

const encoder = new TextEncoder()
const keyCache = new Map<string, Promise<CryptoKey>>()

function hmacKey(secretName: string): Promise<CryptoKey> {
  let key = keyCache.get(secretName)
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(env(secretName)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    keyCache.set(secretName, key)
  }
  return key
}

async function hmacHex(secretName: string, value: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secretName), encoder.encode(value))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ─── Identifiers (NIC, IMEI, serial number, …) ─────────────────────────

export function normalizeIdentifier(type: string, value: string): string {
  return `${type.trim().toUpperCase()}:${value.replace(/[\s\-_.\/]/g, '').toUpperCase()}`
}

/** HMAC-SHA256(IDENTIFIER_HMAC_SECRET, TYPE:VALUE). The raw value is never stored. */
export function hmacIdentifier(type: string, value: string): Promise<string> {
  return hmacHex('IDENTIFIER_HMAC_SECRET', normalizeIdentifier(type, value))
}

// ─── Claim credentials: FND-XXXX-XXXX-XXXX ──────────────────────────────

// Crockford-style alphabet without ambiguous characters (0/O, 1/I/L, U).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 12 random symbols ≈ 59 bits — plus server-side attempt limiting. */
export function generateClaimCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  // Rejection sampling keeps the distribution uniform.
  const chars: string[] = []
  let i = 0
  while (chars.length < 12) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes)
      i = 0
    }
    const b = bytes[i++]
    if (b < 240) chars.push(ALPHABET[b % ALPHABET.length])
  }
  const raw = chars.join('')
  return `FND-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

export function normalizeClaimCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^FND/, '')
}

export function isWellFormedClaimCode(code: string): boolean {
  return /^[2-9A-HJKMNP-TV-Z]{12}$/.test(normalizeClaimCode(code))
}

/** HMAC-SHA256(CLAIM_CODE_SECRET, normalized code). */
export function hashClaimCode(code: string): Promise<string> {
  return hmacHex('CLAIM_CODE_SECRET', normalizeClaimCode(code))
}
