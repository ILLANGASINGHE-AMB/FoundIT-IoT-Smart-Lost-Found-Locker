import { Sparkles } from 'lucide-react'
import type { ScoreBreakdown } from '../../types'

/** Raw Gemini cosine similarity above which the match is called "meaning-based". */
export const SEMANTIC_HIGHLIGHT = 0.75

export function hasSemanticBoost(breakdown: ScoreBreakdown | null | undefined): boolean {
  const s = breakdown?.semantic_similarity
  return typeof s === 'number' && s >= SEMANTIC_HIGHLIGHT
}

/** "AI-matched on meaning" pill — shown when Gemini similarity contributed significantly. */
export function SemanticBadge({ breakdown }: { breakdown: ScoreBreakdown | null | undefined }) {
  if (!hasSemanticBoost(breakdown)) return null
  return (
    <span className="pill pill-purple" title="Descriptions were compared by meaning using Google Gemini embeddings">
      <Sparkles size={12} /> AI-matched on meaning
    </span>
  )
}
