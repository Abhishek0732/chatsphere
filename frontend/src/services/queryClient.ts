import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance. Exported as a module singleton so that
 * non-React code (the WebSocket service) can push server events directly
 * into the cache.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
