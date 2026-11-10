import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'
import { formatDate } from '../../lib/format'
import type { MatchWithItems } from '../../services/matching'
import { ScoreRing } from './ScoreRing'
import { SemanticBadge } from './SemanticBadge'

const STATUS_PILL = {
  OPEN: { label: 'Open', tone: 'pill-blue' },
  DISMISSED: { label: 'Dismissed', tone: 'pill-gray' },
  CONVERTED_TO_CLAIM: { label: 'Claimed', tone: 'pill-green' },
} as const

/** Match summary: score ring, both items, status and actions. */
export function MatchCard({ match, showLost = true }: { match: MatchWithItems; showLost?: boolean }) {
  const found = match.found_item
  const status = STATUS_PILL[match.status]

  return (
    <Link to={`/matches/${match.id}`} className="card match-card">
      <ScoreRing score={match.score} />
      <div className="match-card-body">
        <div className="row">
          <span className={`pill ${status.tone}`}>{status.label}</span>
          <SemanticBadge breakdown={match.score_breakdown} />
        </div>
        <h3>{found?.title ?? 'Found item'}</h3>
        {showLost && match.lost_item && (
          <p className="muted small">
            Possible match for your <strong>{match.lost_item.title}</strong>
          </p>
        )}
        <p className="match-card-meta">
          {found?.location?.name && (
            <span>
              <MapPin size={12} /> {found.location.name}
            </span>
          )}
          {found?.date_found && (
            <span>
              <Calendar size={12} /> Found {formatDate(found.date_found)}
            </span>
          )}
        </p>
      </div>
      <ArrowRight size={18} className="match-card-arrow" />
    </Link>
  )
}
