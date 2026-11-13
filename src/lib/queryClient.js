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
      // v9.25: space the single retry out (1 s) instead of firing it
      // immediately into the same slow network that just failed.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// v9.40: every query key that carries category data, in one place —
// the Directory top-level list (['categories'], via fetchCategories),
// the Home category list + tiles (['home','categories'] and the
// ['categories'] counts), the full id/parent_id table deep links and
// the picker resolve from (['category-map']), and the picker tree
// fetch (['category-tree']). Any write to the categories table must
// invalidate ALL of them, or Home/Directory keep showing the list
// from before the change for up to the 5 min staleTime (the Clinic
// report: added in the Manager, invisible on Home/Directory).
// NOTE: ['home','counts'] is deliberately NOT here — it counts
// listings + posts only (HomePage.jsx countsQ), so adding a category
// (0 listings) cannot change it.
export const CATEGORY_QUERY_KEYS = [
  ['categories'],
  ['home', 'categories'],
  ['category-map'],
  ['category-tree'],
];

// v9.40: best-effort, fire-and-forget — invalidation is local, it
// cannot fail in practice, and it must never block the save flow or
// surface an error. Call after a successful category add / edit /
// delete / toggle (and after an on-the-fly creation in Submit).
export function invalidateCategoryQueries() {
  for (const key of CATEGORY_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: key })
  }
}
