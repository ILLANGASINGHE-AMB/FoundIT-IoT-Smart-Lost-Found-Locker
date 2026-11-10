import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, Sparkles } from 'lucide-react'
import { getMatchesForLostItem, requestRematch } from '../../services/matching'
import { SkeletonList } from '../ui'
import { MatchCard } from './MatchCard'

/** "Possible matches" section on the lost-item detail page. */
export function LostItemMatches({ lostItemId, canRematch }: { lostItemId: string; canRematch: boolean }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['matches', 'lost', lostItemId],
    queryFn: () => getMatchesForLostItem(lostItemId),
  })

  const rematch = useMutation({
    mutationFn: () => requestRematch('lost', lostItemId, false),
    onSuccess: (res) => {
      toast.success(
        res.new_candidates > 0 ? `Found ${res.new_candidates} new possible match(es)!` : 'No new matches right now.',
      )
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['lost-item', lostItemId] })
    },
  })

  const open = query.data?.filter((m) => m.status !== 'DISMISSED') ?? []

  return (
    <div className="card stack">
      <div className="row-between">
        <h2 className="card-title" style={{ margin: 0 }}>
          <Sparkles size={16} /> Possible matches
        </h2>
        {canRematch && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={rematch.isPending} onClick={() => rematch.mutate()}>
            <RefreshCw size={14} className={rematch.isPending ? 'spin' : ''} /> Check again
          </button>
        )}
      </div>
      {query.isLoading && <SkeletonList rows={2} height={96} />}
      {query.data && open.length === 0 && (
        <p className="muted small">
          No matches yet. We check every new found report automatically and will notify you.
        </p>
      )}
      {open.map((m) => (
        <MatchCard key={m.id} match={m} showLost={false} />
      ))}
    </div>
  )
}
