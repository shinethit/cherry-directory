// Admin-only listing delete (v9.20) — shared by AdminPage (listings tab)
// and ListingDetailPage (bottom of the page, next to Report).
//
// WHY THIS EXISTS: the Admin panel already had a DELETE button
// (AdminPage handleDelete), but it could never delete a listing the admin
// did not submit themselves — the ONLY listings DELETE policy in the DB
// is "Owner can delete own listing" (submitted_by / owner_id, 9.3.sql).
// No "Admin deletes listings" policy ever existed (other tables have one:
// notices, donations, lost_found, jobs, price_reports), so the button
// failed at RLS for exactly the case the user wants — deleting someone
// else's business that no longer exists. supabase-migration-9.20.sql adds
// the missing policy; this helper is the client half.
//
// WHAT A DELETE DOES (all verified in the 9.17 migration, not assumed):
//  - the listing row goes first, then linked rows are cleaned up — the
//    old order deleted reviews first, so a failure on the listing delete
//    left them already gone (AdminPage comment, kept here).
//  - reviews: deleted here; each review delete fires the 9.17 trigger
//    handle_review_deleted_points — a -5 reversal row in user_points and
//    profiles.total_reviews -1 per review.
//  - points: the 9.17 trigger handle_listing_deleted_points inserts -10
//    (submit_listing) and, if the listing was approved, -20
//    (listing_approved) reversal rows — only for legs actually awarded,
//    never twice. profiles.points stays in sync via sync_user_points()
//    (9.3), so the submitter's displayed total really drops.
//  - bookmarks: removed by the 9.17 trigger cleanup_bookmarks_on_target_delete.
//  - reports + edit_suggestions for the listing: deleted here.
//  - photos: the listing's images array dies with the row, so the photos
//    disappear from the app — but the files stay in Cloudinary (there is
//    no signed destroy path in the app; cloudinary.js only uploads).
//  - audit: logged when a log function is passed (AdminPage); the detail
//    page passes its own useAuditLog log the same way.
//
// GATING: Admin only (isAdmin = role 'admin' or 'super_admin'). Moderators
// can open the Admin panel (RequireAdmin admits them) but must NOT see or
// call this — the RLS policy enforces the same rule server-side, so the
// UI gate is not the only defence.
//
// NOTE (9.20 amendment, user decision 2026-11-06 "Admin ပဲဖျက်ခွင့်ပေး"):
// MySubmissionsPage.jsx no longer calls this at all — owner delete was
// removed from MySubmissions (handleDelete + Delete button deleted) and
// the "Owner can delete own listing" policy (9.3.sql) is dropped by
// supabase-migration-9.20.sql. The only callers are AdminPage and
// ListingDetailPage, both isAdmin-gated.

export function deleteListingConfirmMessage(name) {
  return `‘${name || 'ဤလုပ်ငန်း'}’ ကို အပြီးဖျက်မလား? ပြန်မရနိုင်ပါ။
• လုပ်ငန်း၊ ဓာတ်ပုံ၊ review၊ bookmark အားလုံး ပျက်မည်
• တင်သွင်းသူ၏ အမှတ် ပြန်နှုတ်မည် — တင်ခြင်း +10၊ အတည်ပြုခြင်း +20 (အတည်ပြုပြီးလျှင်)
• review ရေးသူတိုင်း၏ +5 အမှတ် ပြန်နှုတ်မည်
Admin သာ ဖျက်ခွင့်ရှိသည်။`
}

export async function deleteListingWithCleanup(client, id, { log } = {}) {
  const { data: deleted, error } = await client.from('listings').delete().eq('id', id).select('name, name_mm')
  if (error) throw error
  const name = deleted?.[0]?.name_mm || deleted?.[0]?.name
  // Best-effort cleanup of linked rows — a failure here must not silently
  // block the delete, but it must not be hidden either.
  const cleanupErrors = []
  const cleanups = [
    ['reports', { target_type: 'listing', target_id: id }],
    ['edit_suggestions', { listing_id: id }],
    ['reviews', { listing_id: id }],
  ]
  for (const [table, match] of cleanups) {
    const { error: e } = await client.from(table).delete().match(match)
    if (e) cleanupErrors.push(`${table}: ${e.message}`)
  }
  if (log) {
    try {
      await log({ action: 'delete', table: 'listings', id, name, before: { name } })
    } catch {
      // Audit log is fire-and-forget — it must never delay the toast.
    }
  }
  return { name, cleanupErrors }
}
