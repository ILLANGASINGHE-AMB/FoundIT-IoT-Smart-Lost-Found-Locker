import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toastError } from './errors'

export const queryClient = new QueryClient({
  // Every query/mutation error surfaces as a friendly toast unless the
  // caller handles it itself (meta: { silent: true }).
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!query.meta?.silent) toastError(error)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (!mutation.meta?.silent && !mutation.options.onError) toastError(error)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
