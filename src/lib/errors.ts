import { FunctionsHttpError } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from './supabase'

/** Turn any thrown value into a message that is safe to show to a user. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'Network error — check your connection and try again.'
  }
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export function toastError(error: unknown, fallback?: string) {
  toast.error(friendlyError(error, fallback))
}

/**
 * Invoke a Supabase Edge Function that follows the `{ data, error }`
 * envelope convention, unwrapping it and surfacing the server's message.
 */
export async function invokeEdge<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error?.message ?? 'The server could not complete the request.')
    }
    throw new Error(friendlyError(error))
  }

  if (data?.error) throw new Error(data.error.message)
  return data?.data as T
}
