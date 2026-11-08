// v9.32: descendant ids for the Directory listings query. Moved verbatim
// from DirectoryPage (collectDescendantIds) so the query, the picker
// counts and the tests share one implementation.

// Descendant ids (ALL levels, not just children) of a category, from a
// flat id/parent_id list.
export function collectDescendantIds(allCats, rootId) {
  const ids = [rootId]
  let frontier = [rootId]
  while (frontier.length) {
    const next = (allCats || []).filter(c => frontier.includes(c.parent_id)).map(c => c.id)
    ids.push(...next)
    frontier = next
  }
  return ids
}

// Union of two id/parent_id row lists, deduped by id (map rows win on
// conflict — they carry name/icon; tree rows are id/parent_id only).
export function mergeTreeRows(mapRows, treeRows) {
  const byId = new Map()
  for (const c of treeRows || []) if (c?.id && !byId.has(c.id)) byId.set(c.id, c)
  for (const c of mapRows || []) if (c?.id) byId.set(c.id, c)
  return [...byId.values()]
}

// Category ids whose listings a Directory listings view must show.
// Direct ("အားလုံး") and featured views are single-id by definition;
// every other subcategory view is the subcategory + ALL descendants,
// which is what the picker badge counts (loadSubcategories).
// Empty tree -> [subId] (direct-only degradation, never a crash).
export function resolveListingCategoryIds({ subId, isDirect, isFeatured, mapRows, treeRows }) {
  if (!subId || isDirect || isFeatured) return [subId]
  return collectDescendantIds(mergeTreeRows(mapRows, treeRows), subId)
}
