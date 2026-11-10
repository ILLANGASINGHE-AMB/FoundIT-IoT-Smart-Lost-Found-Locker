import { Fingerprint } from 'lucide-react'
import { formatDate } from '../../lib/format'
import type { ScoreBreakdown as Breakdown, ScoreBreakdownEntry } from '../../types'
import type { MatchFoundItem, MatchLostItem } from '../../services/matching'
import { SEMANTIC_HIGHLIGHT } from './SemanticBadge'

const METHOD_LABEL: Record<ScoreBreakdownEntry['method'], string> = {
  exact: 'Exact',
  trigram: 'Text similarity',
  semantic: 'Meaning (AI)',
  decay: 'Date proximity',
  blend: 'Text + meaning',
}

type Row = {
  key: keyof Breakdown
  label: string
  lost: string
  found: string
}

/** Per-attribute table: your value · found value · contribution · method (spec §41). */
export function ScoreBreakdown({
  breakdown,
  lost,
  found,
}: {
  breakdown: Breakdown
  lost: MatchLostItem
  found: MatchFoundItem
}) {
  const rows: Row[] = [
    { key: 'category', label: 'Category', lost: lost.category?.name ?? '—', found: found.category?.name ?? '—' },
    { key: 'brand', label: 'Brand', lost: lost.brand || '—', found: found.brand || '—' },
    { key: 'model', label: 'Model', lost: lost.model || '—', found: found.model || '—' },
    { key: 'color', label: 'Colour', lost: lost.color || '—', found: found.color || '—' },
    { key: 'location', label: 'Location', lost: lost.location?.name ?? '—', found: found.location?.name ?? '—' },
    { key: 'date', label: 'Date', lost: formatDate(lost.date_lost), found: formatDate(found.date_found) },
    { key: 'description', label: 'Description', lost: 'Your description', found: 'Finder’s description' },
  ]

  const semantic = breakdown.description?.semantic_similarity

  return (
    <div className="stack">
      {breakdown.identifier_exact && (
        <div className="alert alert-success">
          <Fingerprint size={18} />
          <span>
            <strong>Identifier match.</strong> The identifier on file for both reports is identical, so this is
            scored as a 100% match. Ownership still has to be verified before the item is released.
          </span>
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table breakdown-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Your item</th>
              <th>Found item</th>
              <th>Points</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const entry = breakdown[row.key] as ScoreBreakdownEntry | undefined
              if (!entry) return null
              const isDescription = row.key === 'description'
              const method =
                isDescription && entry.method === 'blend' && (semantic ?? 0) >= SEMANTIC_HIGHLIGHT
                  ? 'Text + meaning'
                  : METHOD_LABEL[entry.method]
              return (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{row.lost}</td>
                  <td>{row.found}</td>
                  <td>
                    <div className="breakdown-bar" aria-hidden="true">
                      <span style={{ width: `${(entry.contribution / entry.weight) * 100}%` }} />
                    </div>
                    <span className="small">
                      {entry.contribution.toFixed(1)} / {entry.weight}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${entry.method === 'blend' ? 'pill-purple' : 'pill-gray'}`}>{method}</span>
                    {isDescription && breakdown.description && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        text {Math.round(breakdown.description.trigram_similarity * 100)}%
                        {semantic != null && <> · meaning {Math.round(semantic * 100)}%</>}
                      </div>
                    )}
                    {row.key === 'date' && breakdown.date?.days_apart != null && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {Math.abs(breakdown.date.days_apart)} day(s) apart
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
