import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui'
import { ReportForm } from '../../components/items/ReportForm'
import { useCollectionPoints } from '../../hooks/useLookups'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * /lost/new and /found/new. The found form accepts
 * ?collection_point_id=…&location_id=… (pre-filled by the QR landing page).
 */
export function ReportItemPage({ kind }: { kind: 'lost' | 'found' }) {
  const [params] = useSearchParams()
  const collectionPointId = params.get('collection_point_id')
  const locationId = params.get('location_id')
  const { data: points } = useCollectionPoints()
  const point = points?.find((p) => p.id === collectionPointId)

  const prefill =
    kind === 'found'
      ? {
          collection_point_id: collectionPointId && UUID.test(collectionPointId) ? collectionPointId : undefined,
          location_id: locationId && UUID.test(locationId) ? locationId : undefined,
          collectionPointName: point?.name,
        }
      : undefined

  return (
    <div className="page page-narrow">
      <PageHeader
        backTo={kind === 'lost' ? '/lost' : '/found'}
        backLabel={kind === 'lost' ? 'My lost items' : 'My found items'}
        title={kind === 'lost' ? 'Report a lost item' : 'Report a found item'}
        description={
          kind === 'lost'
            ? 'The more detail you give, the better our matching works. Private details are never shown to others.'
            : 'Describe what you found and where. Don’t include anything only the owner would know.'
        }
      />
      <ReportForm kind={kind} prefill={prefill} />
    </div>
  )
}
