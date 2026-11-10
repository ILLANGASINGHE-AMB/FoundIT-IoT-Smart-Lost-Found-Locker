// Demo mode — Supabase Realtime stand-in. INSERTs made in this tab are
// delivered directly; inserts from other tabs arrive via BroadcastChannel.

import { onInsert, type Row } from './store'

type Handler = (payload: { new: Row; eventType: 'INSERT'; table: string }) => void
interface Binding {
  table: string
  filter?: [string, string]
  handler: Handler
}

const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('foundit-demo-realtime') : null
const channels = new Set<DemoChannel>()

function deliver(table: string, row: Row) {
  channels.forEach((ch) => ch.dispatch(table, row))
}

onInsert((table, row) => {
  deliver(table, row)
  broadcast?.postMessage({ table, row })
})
broadcast?.addEventListener('message', (e: MessageEvent<{ table: string; row: Row }>) => deliver(e.data.table, e.data.row))

export class DemoChannel {
  private bindings: Binding[] = []

  topic: string
  constructor(topic: string) {
    this.topic = topic
  }

  on(_type: 'postgres_changes', opts: { event: string; schema?: string; table: string; filter?: string }, handler: Handler) {
    const m = opts.filter?.match(/^(\w+)=eq\.(.+)$/)
    this.bindings.push({ table: opts.table, filter: m ? [m[1], m[2]] : undefined, handler })
    return this
  }

  subscribe(cb?: (status: string) => void) {
    channels.add(this)
    cb?.('SUBSCRIBED')
    return this
  }

  unsubscribe() {
    channels.delete(this)
    return Promise.resolve('ok')
  }

  dispatch(table: string, row: Row) {
    for (const b of this.bindings) {
      if (b.table !== table) continue
      if (b.filter && String(row[b.filter[0]]) !== b.filter[1]) continue
      b.handler({ new: row, eventType: 'INSERT', table })
    }
  }
}
