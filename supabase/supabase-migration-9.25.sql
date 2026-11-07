-- Cherry Directory v9.25 — SQL migration.
-- RUN THIS FILE ONLY, AFTER DEPLOY, in Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Every statement is idempotent (CREATE OR REPLACE / DROP TRIGGER IF
-- EXISTS), so running it twice is safe.
--
-- WHAT CHANGED (user decision 2026-11-06: deleting must NOT deduct
-- points):
--   §1. handle_listing_deleted_points — NO LONGER inserts the -10
--      (submit_listing) / -20 (listing_approved) reversal rows into
--      user_points. The submitter KEEPS the +10 (+20 if approved)
--      already earned. profiles.total_listings still drops by 1, once
--      per deleted listing, inside the existing guard
--      (OLD.submitted_by IS NOT NULL + the profile exists).
--   §2. handle_review_deleted_points — NO LONGER inserts the -5
--      (write_review) reversal row. Reviewers KEEP their earned +5.
--      This applies to BOTH standalone review deletes and reviews
--      cascade-deleted with their listing: the DB cannot distinguish
--      them (same trigger, same OLD row, no flag — a transaction-scoped
--      flag was considered and rejected as fragile). The counter fix is
--      unconditional now: profiles.total_reviews drops by 1 whenever
--      OLD.user_id is not null and the profile exists, whether or not a
--      +5 row ever existed — this also cures the latent stale-counter
--      bug where a review that never earned +5 left total_reviews
--      un-decremented (the old decrement sat INSIDE the +5 guard).
--
-- HISTORICAL DAMAGE IS NOT REPAIRED BY THIS FILE: reversal rows
-- already written by the 9.17/9.18 triggers (-10 submit_listing, -20
-- listing_approved, -5 write_review) stay in user_points until the
-- separate repair proposal is run (diagnostic SELECTs + a backed-up
-- DELETE, ONLY AFTER this trigger fix is live). This file writes no
-- repair and inserts no compensating rows.
--
-- WHAT IT DOES NOT TOUCH: the award triggers (submit +10, approve
-- +20, review +5 still fire as before), sync_user_points() (profiles.
-- points is still SUM(user_points)), the leaderboard views, the RSVP
-- -2 / claim triggers, and the user_points CHECK constraint — negative
-- pairs stay allowed because the RSVP -2 reversal still uses them.
-- KNOWN LOOSENING (accepted for 9.25): the award triggers have no
-- dedup, so a write→delete→rewrite cycle nets +5 per review / +10
-- (+20 if re-approved) per listing. Small amounts, visible in Points
-- History; no tombstone/marker mechanism in 9.25.

-- ============================================================
-- §1. Listing delete — keep the points, keep the counter decrement.
-- ============================================================
create or replace function public.handle_listing_deleted_points()
returns trigger as $$
begin
  -- No reversal rows any more (v9.25): the submitter keeps +10
  -- (submit) and +20 (approved) already earned.
  if OLD.submitted_by is not null
    and exists (select 1 from public.profiles where id = OLD.submitted_by) then
    -- Counter decrement (once per deleted listing, not per points leg).
    update public.profiles
      set total_listings = greatest(0, total_listings - 1)
      where id = OLD.submitted_by;
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists on_listing_deleted_points on public.listings;
create trigger on_listing_deleted_points
  after delete on public.listings
  for each row execute procedure public.handle_listing_deleted_points();

-- ============================================================
-- §2. Review delete — keep the +5, keep the counter decrement
--     (unconditional on a +5 row having existed).
-- ============================================================
create or replace function public.handle_review_deleted_points()
returns trigger as $$
begin
  -- No -5 reversal row any more (v9.25): the reviewer keeps +5,
  -- for standalone deletes and for cascade deletes alike.
  if OLD.user_id is not null
    and exists (select 1 from public.profiles where id = OLD.user_id) then
    update public.profiles
      set total_reviews = greatest(0, total_reviews - 1)
      where id = OLD.user_id;
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_deleted_points on public.reviews;
create trigger on_review_deleted_points
  after delete on public.reviews
  for each row execute procedure public.handle_review_deleted_points();
