import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileSearch, PackageSearch, Plus } from 'lucide-react'
import { getLostItems } from '../../services/lostItems'
import { getFoundItems } from '../../services/foundItems'
import { getCoverImages, type ItemKind } from '../../services/items'
import { ItemCard } from '../../components/items/ItemCard'
import { EmptyState, ErrorState, PageHeader, SkeletonCards } from '../../components/ui'
import type { ItemStatus } from '../../types'

const FILTERS: Record<ItemKind, { value: string; label: string }[]> = {
  lost: [
    { value: 'ALL', label: 'All' },
    { value: 'LOST', label: 'Lost' },
    { value: 'MATCHED', label: 'Matched' },
    { value: 'CLAIM_PENDING', label: 'Claim pending' },
    { value: 'CLAIMED', label: 'Ready to collect' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ],
  found: [
    { value: 'ALL', label: 'All' },
    { value: 'FOUND', label: 'Found' },
    { value: 'IN_STORAGE', label: 'In FoundIT Box' },
    { value: 'MATCHED', label: 'Matched' },
    { value: 'CLAIM_PENDING', label: 'Claim pending' },
    { value: 'RETURNED', label: 'Returned' },
    { value: 'UNCLAIMED_EXPIRED', label: 'Expired' },
  ],
}

interface ListRow {
  id: string
  title: string
  status: ItemStatus
  date: string
  category: string
  location: string
}

async function loadItems(kind: ItemKind, status: string) {
  const rows: ListRow[] =
    kind === 'lost'
      ? (await getLostItems(status as never)).map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          date: i.date_lost,
          category: i.category?.name ?? '',
          location: i.location?.name ?? '',
        }))
      : (await getFoundItems(status as never)).map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          date: i.date_found,
          category: i.category?.name ?? '',
          location: i.location?.name ?? '',
        }))
  const covers = await getCoverImages(
    kind,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({ ...r, imageUrl: covers.get(r.id) }))
}

/** /lost and /found — the signed-in user's reports with a status filter. */
export function ItemsListPage({ kind }: { kind: ItemKind }) {
  const [status, setStatus] = useState('ALL')
  const query = useQuery({
    queryKey: [kind === 'lost' ? 'lost-items' : 'found-items', status],
    queryFn: () => loadItems(kind, status),
  })

  const isLost = kind === 'lost'
  const newLink = isLost ? '/lost/new' : '/found/new'

  return (
    <div className="page">
      <PageHeader
        title={isLost ? 'My Lost Items' : 'My Found Items'}
        description={
          isLost
            ? 'Items you reported as lost. We match them against everything handed in.'
            : 'Items you found and reported. Thank you for helping!'
        }
        actions={
          <Link to={newLink} className="btn btn-primary">
            <Plus size={16} /> {isLost ? 'Report lost item' : 'Report found item'}
          </Link>
        }
      />

      <div className="tabs" role="tablist" aria-label="Filter by status">
        {FILTERS[kind].map((f) => (
          <button
            key={f.value}
            role="tab"
            className="tab"
            aria-selected={status === f.value}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading && <SkeletonCards count={6} />}
      {query.isError && <ErrorState message="Could not load your reports." onRetry={() => query.refetch()} />}

      {query.data && query.data.length === 0 && (
        <div className="card">
          <EmptyState
            icon={isLost ? <FileSearch size={26} /> : <PackageSearch size={26} />}
            title={status === 'ALL' ? 'No reports yet' : 'Nothing with this status'}
            description={
              status === 'ALL'
                ? isLost
                  ? 'Lost something? Report it and we’ll let you know when something similar is handed in.'
                  : 'Found something? Report it so its owner can get it back.'
                : 'Try another filter.'
            }
            action={
              status === 'ALL' && (
                <Link to={newLink} className="btn btn-primary">
                  <Plus size={16} /> Create a report
                </Link>
              )
            }
          />
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <div className="card-grid">
          {query.data.map((item) => (
            <ItemCard
              key={item.id}
              to={`/${kind}/${item.id}`}
              title={item.title}
              category={item.category}
              location={item.location}
              status={item.status}
              date={item.date}
              imageUrl={item.imageUrl}
            />
          ))}
        </div>
      )}
    </div>
  )
}
