export type LookupOption = {
  id: string
  name: string
}

const API_URL = 'http://127.0.0.1:3001/api'

async function fetchOptions(
  endpoint: 'categories' | 'locations'
): Promise<LookupOption[]> {
  const response = await fetch(`${API_URL}/${endpoint}`)

  if (!response.ok) {
    throw new Error(`Could not load ${endpoint}`)
  }

  return response.json()
}

export function getCategories(): Promise<LookupOption[]> {
  return fetchOptions('categories')
}

export function getLocations(): Promise<LookupOption[]> {
  return fetchOptions('locations')
}