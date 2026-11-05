import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // v9.17: gcTime 24 h (was 10 min) — the persisted offline cache
      // (PersistQueryClientProvider, main.jsx) must survive a day of
      // inactive queries, or the cache would be garbage-collected
      // before the user ever goes offline.
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
