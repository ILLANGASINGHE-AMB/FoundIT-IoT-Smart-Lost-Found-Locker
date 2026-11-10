// Google Gemini text embeddings for semantic matching (spec §18C).
// Model is configurable; vectors are truncated to EMBEDDING_DIMENSIONS and
// L2-normalised so cosine similarity is meaningful after truncation.

import { HttpError } from './http.ts'

export const EMBEDDING_DIMENSIONS = 768
const DEFAULT_MODEL = 'gemini-embedding-001'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export function geminiConfigured(): boolean {
  return Boolean(Deno.env.get('GEMINI_API_KEY'))
}

function normalize(values: number[]): number[] {
  const v = values.slice(0, EMBEDDING_DIMENSIONS)
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0))
  return norm > 0 ? v.map((x) => x / norm) : v
}

async function callEmbed(model: string, apiKey: string, body: unknown): Promise<Response> {
  return await fetch(`${API_BASE}/models/${model}:embedContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
}

/** Embed text with Gemini → number[EMBEDDING_DIMENSIONS] (unit length). */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new HttpError(503, 'Semantic matching is not configured (GEMINI_API_KEY missing).')
  const model = Deno.env.get('GEMINI_EMBEDDING_MODEL') ?? DEFAULT_MODEL
  const content = { parts: [{ text: text.slice(0, 8000) }] }

  // The documented request shape has varied between API revisions; try the
  // long-standing top-level fields first, then the nested config form.
  const attempts = [
    { model: `models/${model}`, content, taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: EMBEDDING_DIMENSIONS },
    { content, embedContentConfig: { taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: EMBEDDING_DIMENSIONS } },
  ]

  let lastError = ''
  for (const body of attempts) {
    const res = await callEmbed(model, apiKey, body)
    if (res.ok) {
      const json = await res.json()
      const values: unknown = json?.embedding?.values
      if (!Array.isArray(values) || values.length < EMBEDDING_DIMENSIONS) {
        throw new Error(`Gemini returned an unexpected embedding (${Array.isArray(values) ? values.length : 'none'})`)
      }
      return normalize(values as number[])
    }
    lastError = `${res.status} ${(await res.text()).slice(0, 300)}`
    if (res.status !== 400) break // only a request-shape problem is worth retrying
  }
  throw new Error(`Gemini embedContent failed: ${lastError}`)
}

/** pgvector text literal: "[0.1,0.2,…]". */
export function toVectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v.toFixed(7))).join(',')}]`
}
