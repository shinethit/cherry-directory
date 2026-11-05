// Shared listing display name — v9.17. A listing needs only ONE name
// (Myanmar or English), so every render site must fall back to the other
// language — a bare `listing.name` in EN mode renders blank for a
// Myanmar-only listing. Use this everywhere a listing name is shown
// (detail H1/SEO title, menu, submissions, claim summary, cards).
export function displayName(listing, lang) {
  if (!listing) return ''
  if (lang === 'mm') return listing.name_mm || listing.name || ''
  return listing.name || listing.name_mm || ''
}

export default displayName
