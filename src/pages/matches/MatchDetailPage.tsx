import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ClipboardCheck, Info, MapPin, ThumbsDown } from 'lucide-react'
import { dismissMatch, getMatchById } from '../../services/matching'
import { formatDate } from '../../lib/format'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { ItemImageGallery } from '../../components/items/ItemImageGallery'
import { StatusBadge } from '../../components/items/StatusBadge'
import { ScoreRing } from '../../components/matching/ScoreRing'
import { ScoreBreakdown } from '../../components/matching/ScoreBreakdown'
import { SemanticBadge } from '../../components/matching/SemanticBadge'

/**
 * /matches/:id — Your Lost Item | Possible Found Item, with the score and
 * the reasoning behind it (spec §41). Never shows the other party's
 * private information.
 */
export function MatchDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['match', id], queryFn: () => getMatchById(id) })

  const dismiss = useMutation({
    mutationFn: () => dismissMatch(id),
    onSuccess: () => {
      toast.success('Thanks — we won’t show this match again.')
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['match', id] })
      navigate('/matches')
    },
  })

  if (query.isLoading) {
    return (
      <div className="page">
        <Skeleton height={120} radius={16} />
        <div className="grid-2">
          <Skeleton height={320} radius={16} />
          <Skeleton height={320} radius={16} />
        </div>
      </div>
    )
  }

  if (query.isError || !query.data?.lost_item || !query.data.found_item) {
    return (
      <div className="page">
        <PageHeader title="Match" backTo="/matches" backLabel="My matches" />
        <ErrorState message={query.error?.message ?? 'This match is no longer available.'} />
      </div>
    )
  }

  const match = query.data
  const lost = match.lost_item!
  const found = match.found_item!
  const isOpen = match.status === 'OPEN'

  return (
    <div className="page">
      <PageHeader backTo="/matches" backLabel="My matches" title="Possible match" />

      <section className="card match-banner">
        <ScoreRing score={match.score} size={88} />
        <div className="stack" style={{ gap: 6 }}>
          <h2>Possible match — {Math.round(match.score)}%</h2>
          <div className="row">
            <SemanticBadge breakdown={match.score_breakdown} />
            {match.status !== 'OPEN' && (
              <span className="pill pill-gray">{match.status === 'DISMISSED' ? 'Dismissed' : 'Claim started'}</span>
            )}
          </div>
          <p className="muted small">
            <Info size={13} /> A high score means the reports look alike — it doesn’t prove ownership. You’ll confirm
            it’s yours with your private details and claim credential.
          </p>
        </div>
        {isOpen && (
          <div className="match-banner-actions">
            <Link to={`/claims/new/${match.id}`} className="btn btn-primary">
              <ClipboardCheck size={16} /> Start claim
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={dismiss.isPending}
              onClick={() => window.confirm('Dismiss this match? We won’t suggest it again.') && dismiss.mutate()}
            >
              <ThumbsDown size={16} /> Not my item
            </button>
          </div>
        )}
      </section>

      <div className="grid-2 match-compare">
        <section className="card stack">
          <div className="row-between">
            <h2 className="card-title" style={{ margin: 0 }}>
              Your lost item
            </h2>
            <StatusBadge status={lost.status} />
          </div>
          <ItemImageGallery kind="lost" itemId={lost.id} />
          <h3>{lost.title}</h3>
          <p className="muted small">
            Lost {formatDate(lost.date_lost)} · {lost.location?.name}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{lost.description}</p>
          <Link to={`/lost/${lost.id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
            View your report
          </Link>
        </section>

        <section className="card stack">
          <div className="row-between">
            <h2 className="card-title" style={{ margin: 0 }}>
              Possible found item
            </h2>
            <StatusBadge status={found.status} />
          </div>
          <ItemImageGallery kind="found" itemId={found.id} />
          <h3>{found.title}</h3>
          <p className="muted small">
            Found {formatDate(found.date_found)} · {found.location?.name}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{found.description}</p>
          {found.collection_point ? (
            <p className="small">
              <MapPin size={13} /> Held at <strong>{found.collection_point.name}</strong>
              {found.collection_point.address && ` — ${found.collection_point.address}`}
            </p>
          ) : (
            <p className="small muted">
              <MapPin size={13} /> Not yet handed in at a FoundIT Box.
            </p>
          )}
        </section>
      </div>

      <section className="stack">
        <h2 className="card-title">Why we think it matches</h2>
        <ScoreBreakdown breakdown={match.score_breakdown} lost={lost} found={found} />
      </section>
    </div>
  )
}
