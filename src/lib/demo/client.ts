// Demo mode — assembles a client with the same surface the app uses from
// supabase-js: from() · rpc() · auth · storage · functions · channel().

import type { SupabaseClient } from '@supabase/supabase-js'
import { DemoAuth } from './auth'
import { DemoError, callRpc, invokeFunction } from './engine'
import { DemoQuery } from './query'
import { DemoChannel } from './realtime'
import { seedDemo } from './seed'
import { DemoBucket, clearDemoFiles } from './storage'
import { ensureSeeded, registerSeed, resetDemoData } from './store'

registerSeed(seedDemo)

export function createDemoClient(): SupabaseClient {
  const auth = new DemoAuth()
  const ready = ensureSeeded()
  const uid = () => auth.currentUserId

  const client = {
    auth,
    from: (table: string) => new DemoQuery(table, uid, ready),

    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      await ready
      try {
        return { data: callRpc(name, args, { uid: uid() }), error: null }
      } catch (err) {
        return { data: null, error: { message: err instanceof Error ? err.message : String(err), code: err instanceof DemoError ? err.code : undefined } }
      }
    },

    functions: {
      // Mirrors the Edge Function `{ data, error }` envelope so invokeEdge() works unchanged.
      invoke: async (name: string, opts?: { body?: Record<string, unknown> }) => {
        await ready
        try {
          const result = (await invokeFunction(name, opts?.body ?? {}, { uid: uid() })) as Record<string, unknown> | null
          if (result && typeof result === 'object' && '__error' in result) {
            return { data: { data: null, error: { message: String(result.__error) } }, error: null }
          }
          return { data: { data: result, error: null }, error: null }
        } catch (err) {
          return { data: { data: null, error: { message: err instanceof Error ? err.message : String(err) } }, error: null }
        }
      },
    },

    storage: { from: (bucket: string) => new DemoBucket(bucket) },

    channel: (topic: string) => new DemoChannel(topic),
    removeChannel: async (channel: DemoChannel) => channel.unsubscribe(),
  }

  return client as unknown as SupabaseClient
}

/** Wipe all demo data (DB, session, files) and re-seed. */
export async function resetDemo() {
  await clearDemoFiles()
  await resetDemoData()
}
