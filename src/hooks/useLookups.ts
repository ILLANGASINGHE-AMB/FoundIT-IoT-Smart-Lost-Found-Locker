import { useQuery } from '@tanstack/react-query'
import { getActiveCollectionPoints, getCategories, getLocations } from '../services/items'

const DAY = 24 * 60 * 60 * 1000

export function useCategories() {
  return useQuery({ queryKey: ['lookups', 'categories'], queryFn: getCategories, staleTime: DAY })
}

export function useLocations() {
  return useQuery({ queryKey: ['lookups', 'locations'], queryFn: getLocations, staleTime: DAY })
}

export function useCollectionPoints() {
  return useQuery({
    queryKey: ['collection-points', 'active'],
    queryFn: getActiveCollectionPoints,
    staleTime: 5 * 60 * 1000,
  })
}
