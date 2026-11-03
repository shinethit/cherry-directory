/**
 * Escape a raw search string for PostgREST .or() filters.
 * Unescaped `,` / `(` / `)` break the OR syntax and `%` / `_` act as
 * wildcards, so a search for e.g. "a,b" or "100%" silently returns wrong rows.
 *
 * NOTE (v9.3): the query/mutation hooks that used to live here
 * (useListings, useListing, useCategories, useCreateListing,
 * useUpdateListing, useDeleteListing) were deleted — zero consumers; the
 * live pages query Supabase directly. Only this escaper is imported
 * (DirectoryPage, SearchPage), so only it stays.
 */
export function escapePostgrestOr(value) {
  const BS = String.fromCharCode(92)
  return String(value ?? '')
    .replaceAll(BS, BS + BS)
    .replaceAll('%', BS + '%')
    .replaceAll('_', BS + '_')
    .replaceAll(',', BS + ',')
    .replaceAll('(', BS + '(')
    .replaceAll(')', BS + ')')
}
