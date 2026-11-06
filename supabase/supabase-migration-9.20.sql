-- ============================================================
-- Cherry Directory — Migration 9.20
-- Run AFTER deploying 9.20, in the Supabase SQL editor.
-- Idempotent: safe to re-run (DROP IF EXISTS first).
-- ============================================================
-- §1. Admin-only delete for listings.
--
-- WHY: the Admin panel already had a DELETE button, but it could never
-- delete a listing the admin did not submit themselves. The ONLY
-- listings DELETE policy in the DB is "Owner can delete own listing"
-- (submitted_by / owner_id, 9.3.sql). Every other deletable table has an
-- "Admin deletes X" policy (notices, donations, lost_found, jobs,
-- price_reports) — listings is the odd one out. So deleting a closed
-- business failed at RLS, and the user saw "no option to delete".
--
-- WHO: Admin only — role 'admin' or 'super_admin', matching the app's
-- isAdmin (AuthContext). Moderators are deliberately NOT included: the
-- user said only Admin may delete. The UI gates the button the same way;
-- this policy is the server-side enforcement.
--
-- NOTE (9.20 amendment, user decision 2026-11-06 "Admin ပဲဖျက်ခွင့်ပေး"):
-- the older "Owner can delete own listing" policy (9.3.sql) is DROPPED
-- in this migration, and owner delete is removed from MySubmissions
-- (MySubmissionsPage.jsx handleDelete + Delete button deleted; routeAudit
-- MS5 now asserts the page has no owner delete). After this migration
-- ONLY the "Admin deletes listings" policy below permits listing
-- deletes — Admin only, any listing; owners can no longer delete even
-- their own submissions (they can still View / Edit them).
--
-- WHAT HAPPENS ON DELETE (no new triggers needed — 9.17 already has
-- them): the listing-delete trigger reverses the submitter's points
-- (-10 submit, -20 approval if approved) and total_listings -1; each
-- deleted review reverses its writer's +5 and total_reviews -1; the
-- bookmarks trigger removes saved bookmarks. The client also deletes the
-- listing's reports, edit_suggestions and reviews (deleteListing.js).
-- ============================================================

drop policy if exists "Admin deletes listings" on public.listings;
create policy "Admin deletes listings" on public.listings
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- 9.20 amendment: drop the owner-delete policy — only Admin may delete
-- listings (see §1 NOTE above). Idempotent: safe to re-run.
drop policy if exists "Owner can delete own listing" on public.listings;
