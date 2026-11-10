// Shared HTTP helpers for every FoundIT Edge Function.
// Convention: every function responds with `{ data, error }`.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function ok<T>(data: T, status = 200): Response {
  return json({ data, error: null }, status)
}

export function fail(status: number, message: string, code?: string): Response {
  return json({ data: null, error: { message, code } }, status)
}

/**
 * Wrap a handler with CORS preflight handling, JSON body parsing and
 * uniform error responses. Unexpected errors never leak internals.
 */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return fail(405, 'Method not allowed')

    let body: Record<string, unknown> = {}
    try {
      const text = await req.text()
      body = text ? JSON.parse(text) : {}
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error()
    } catch {
      return fail(400, 'Request body must be a JSON object')
    }

    try {
      return await handler(req, body)
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.code)
      console.error('Unhandled error:', err instanceof Error ? err.message : err)
      return fail(500, 'The server could not complete the request. Please try again.')
    }
  })
}
