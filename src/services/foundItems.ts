export type CreateFoundItemInput = {
  title: string
  description: string
  category_id: string
  location_id: string
  date_found: string
}

export async function createFoundItem(input: CreateFoundItemInput) {
  const response = await fetch('http://127.0.0.1:3001/api/found-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || 'Could not save the found report')
  }

  return response.json()
}

export type FoundItemSummary = {
  id: string
  title: string
  status: 'FOUND' | 'RETURNED' | 'UNCLAIMED_EXPIRED' | 'CLOSED'
  date_found: string
  created_at: string
  category: string
  location: string
}

export async function getFoundItems(): Promise<FoundItemSummary[]> {
  const response = await fetch('http://127.0.0.1:3001/api/found-items')

  if (!response.ok) {
    throw new Error('Could not load your found reports')
  }

  return response.json()
}

export type FoundItemDetails = FoundItemSummary & {
  description: string
  brand: string | null
  model: string | null
  color: string | null
  category_id: string
  location_id: string
  updated_at: string
}

export async function getFoundItemById(
  id: string
): Promise<FoundItemDetails> {
  const response = await fetch(
    `http://127.0.0.1:3001/api/found-items/${encodeURIComponent(id)}`
  )

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Report not found'
        : 'Could not load found report details'
    )
  }

  return response.json()
}