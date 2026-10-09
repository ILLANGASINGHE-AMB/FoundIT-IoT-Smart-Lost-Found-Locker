export type CreateLostItemInput = {
  title: string
  description: string
  category_id: string
  location_id: string
  date_lost: string
}

export async function createLostItem(input: CreateLostItemInput) {
  const response = await fetch('http://127.0.0.1:3001/api/lost-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || 'Could not save the report')
  }

  return response.json()
}



export type LostItemSummary = {
  id: string
  title: string
  status: 'LOST' | 'RESOLVED' | 'CANCELLED'
  date_lost: string
  category: string
  location: string
   created_at: string
}

export async function getLostItems(): Promise<LostItemSummary[]> {
  const response = await fetch('http://127.0.0.1:3001/api/lost-items')

  if (!response.ok) {
    throw new Error('Could not load your lost reports')
  }

  return response.json()
}


export type LostItemDetails = LostItemSummary & {
  description: string
  brand: string | null
  model: string | null
  color: string | null
  category_id: string
  location_id: string
  created_at: string
  updated_at: string
}

export async function getLostItemById(
  id: string
): Promise<LostItemDetails> {
  const response = await fetch(
    `http://127.0.0.1:3001/api/lost-items/${encodeURIComponent(id)}`
  )

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Report not found'
        : 'Could not load report details'
    )
  }

  return response.json()
}

export type CancelLostItemResult = {
  id: string
  status: 'CANCELLED'
  updated_at: string
}

export async function cancelLostItem(
  id: string
): Promise<CancelLostItemResult> {
  const response = await fetch(
    `http://127.0.0.1:3001/api/lost-items/${encodeURIComponent(id)}/cancel`,
    { method: 'PATCH' }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || 'Could not cancel the report')
  }

  return response.json()
}