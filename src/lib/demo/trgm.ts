// JS port of PostgreSQL pg_trgm similarity / word_similarity, so demo
// matching scores behave like the real database functions.

function trigrams(text: string): Set<string> {
  const out = new Set<string>()
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  for (const word of words) {
    const padded = `  ${word} `
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  }
  return out
}

export function similarity(a: string, b: string): number {
  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  ta.forEach((t) => tb.has(t) && shared++)
  return shared / (ta.size + tb.size - shared)
}

/** Best similarity between `a` and any run of consecutive words in `b`. */
export function wordSimilarity(a: string, b: string): number {
  const words = b.toLowerCase().split(/\s+/).filter(Boolean)
  const n = Math.max(1, a.split(/\s+/).filter(Boolean).length)
  let best = similarity(a, b)
  for (let size = Math.max(1, n - 1); size <= n + 1; size++) {
    for (let i = 0; i + size <= words.length; i++) {
      best = Math.max(best, similarity(a, words.slice(i, i + size).join(' ')))
    }
  }
  return best
}

/** text_trgm() from the matching migration. */
export function textTrgm(a: unknown, b: unknown): number {
  const x = typeof a === 'string' ? a.trim() : ''
  const y = typeof b === 'string' ? b.trim() : ''
  if (!x || !y) return 0
  if (x.toLowerCase() === y.toLowerCase()) return 1
  return similarity(x, y)
}

/** color_score() from the matching migration. */
export function colorScore(a: unknown, b: unknown): number {
  const x = typeof a === 'string' ? a.trim().toLowerCase() : ''
  const y = typeof b === 'string' ? b.trim().toLowerCase() : ''
  if (!x || !y) return 0
  if (x === y) return 1
  return x.includes(y) || y.includes(x) ? 0.5 : 0
}

/** answer_similarity() from the claims migration. */
export function answerSimilarity(answer: string, expected: string): number {
  if (!answer.trim() || !expected.trim()) return 0
  return Math.max(similarity(answer, expected), wordSimilarity(answer, expected), wordSimilarity(expected, answer))
}
