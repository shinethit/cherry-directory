-- Cherry Directory v9.18 — SQL migration (CORRECTED, COMPLETE).
-- RUN THIS FILE ONLY, AFTER DEPLOY, in Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- NEVER RE-RUN supabase-migration-9.17.sql — it is broken as written:
-- its §1 used CREATE OR REPLACE VIEW to rename the view column
-- period_points to all_time_points, which Postgres forbids
-- (ERROR 42P16). The user ran it and it failed at §1, line 265.
--
-- What actually applied from 9.17 (file order: §6a, §2, §4, §5, §3,
-- §1, §7, §8 — the failure is in §1, so §6a–§3 DID run and §1/§7/§8
-- did NOT): this file contains the COMPLETE 9.17 change set, with §1
-- corrected. Every statement is idempotent (CREATE OR REPLACE /
-- DROP IF EXISTS / ADD COLUMN IF NOT EXISTS / IF EXISTS-guarded), so
-- it is safe whether or not parts of 9.17 already applied — running
-- it twice is safe too.
--
-- What it changes (same as 9.17, plus the two 9.18 fixes):
--   §6a. listings.approved_at column + BEFORE UPDATE trigger that
--      stamps it on the approve transition + backfill from updated_at.
--   §2. Delete-reversal triggers also decrement
--      profiles.total_reviews / total_listings, plus a one-off live
--      recount that repairs already-stale counters.
--   §3. prevent_profile_privilege_change: also blocks direct (depth-1)
--      changes to total_reviews / total_listings, and blocks
--      can_manage_donations changes unless the caller is admin-only.
--   §4. New RSVP update trigger: leaving going/interested writes -2
--      (only if a +2 exists and no -2 yet); entering writes +2 (only
--      if no +2 row exists yet).
--   §5. Lost & found owner delete policy: owners can delete their own
--      lost_found rows (guests have poster_id NULL, so still cannot).
--   §1. Leaderboard views — CORRECTED (9.18): DROP VIEW + CREATE VIEW
--      instead of CREATE OR REPLACE (the 42P16 fix), SELECT re-granted
--      to anon + authenticated (DROP destroys grants, and the repo has
--      no other GRANTs — without this the board 500s for everyone),
--      GROUP BY lists every profile column so the view does not depend
--      on profiles.id being a PK. Same columns, same Yangon period
--      boundaries, same approved_at counting as 9.17 intended.
--   §7. rentals / tutoring expires_at (+30 days) with backfill —
--      guarded by IF EXISTS because those two tables were created
--      live and are not in the repo schema.
--   §8. Orphaned bookmarks cleanup triggers + one-off DELETEs.
--   §9. (9.18) notifications GRANT — the unread-count query 403d
--      because the SELECT/INSERT/UPDATE/DELETE policies exist (9.3
--      §13g) but the privilege was never granted. Same bug class as
--      9.14 (site_visits). RLS policy alone does not confer the
--      privilege (42501 -> HTTP 403).
--   §10. (9.18) listings phone_3/4/5 columns — Submit/Edit pages
--      write all five phone columns, but the repo schema only ever
--      created phone_1/phone_2. Converges the live DB with the code.
--      Search does NOT query phone_3-5 (9.18 code drops them), so the
--      search fix works with or without this section.
--
-- What it does NOT touch: the user_points ledger rows are never
-- rewritten — bulk import keeps earning points exactly as before
-- (submitted_by: profile.id).
--
-- NOTE on ordering: the one-off recount in §2 runs BEFORE the privilege
-- trigger replacement in §3 — a direct UPDATE is depth-1, so it must
-- run while the old trigger (points/role only) is still in place.
-- §6a runs first because the §1 views reference approved_at.

-- ============================================================
-- §6a. listings.approved_at — approval timestamp (must exist
--     before the view rewrites in §1 reference it).
-- ============================================================
alter table public.listings add column if not exists approved_at timestamptz;

-- handle_listing_submitted is an AFTER trigger, so it cannot set
-- NEW.approved_at (AFTER-trigger writes to NEW are discarded). A
-- small BEFORE UPDATE trigger stamps it on the approve transition.
create or replace function public.set_listing_approved_at()
returns trigger as $$
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    NEW.approved_at = now();
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists set_listing_approved_at on public.listings;
create trigger set_listing_approved_at
  before update on public.listings
  for each row execute procedure public.set_listing_approved_at();

-- Backfill already-approved rows (approximate: updated_at is the last
-- edit time, not the approval time — close enough for period counts).
update public.listings
  set approved_at = updated_at
  where status = 'approved' and approved_at is null;

-- ============================================================
-- §2. Delete-reversal triggers also decrement the counters,
--     plus a one-off live recount of already-stale counters.
-- ============================================================
create or replace function public.handle_review_deleted_points()
returns trigger as $$
begin
  if exists (select 1 from public.profiles where id = OLD.user_id)
    and exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'write_review' and points = 5
        and ref_table = 'reviews' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'write_review' and points = -5
        and ref_table = 'reviews' and ref_id = OLD.id
    ) then
    insert into public.user_points(user_id, action, points, ref_table, ref_id)
    values (OLD.user_id, 'write_review', -5, 'reviews', OLD.id);
    -- Counter decrement, guarded by the same reversal-row checks above.
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

create or replace function public.handle_listing_deleted_points()
returns trigger as $$
begin
  -- submitted_by earned +10 on submit and +20 on approval;
  -- reverse each leg only if it was actually awarded.
  if OLD.submitted_by is not null
    and exists (select 1 from public.profiles where id = OLD.submitted_by) then
    if exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'submit_listing' and points = 10
        and ref_table = 'listings' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'submit_listing' and points = -10
        and ref_table = 'listings' and ref_id = OLD.id
    ) then
      insert into public.user_points(user_id, action, points, ref_table, ref_id)
      values (OLD.submitted_by, 'submit_listing', -10, 'listings', OLD.id);
    end if;
    if exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'listing_approved' and points = 20
        and ref_table = 'listings' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'listing_approved' and points = -20
        and ref_table = 'listings' and ref_id = OLD.id
    ) then
      insert into public.user_points(user_id, action, points, ref_table, ref_id)
      values (OLD.submitted_by, 'listing_approved', -20, 'listings', OLD.id);
    end if;
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

-- One-off recount: repairs counters that went stale before the
-- triggers above existed. Basis matches the increment triggers:
-- all reviews by the user, all listings submitted by the user
-- (any status — same as /my-submissions).
update public.profiles p
  set total_reviews = (select count(*) from public.reviews where user_id = p.id),
      total_listings = (select count(*) from public.listings where submitted_by = p.id);

-- ============================================================
-- §4. RSVP update trigger — mirror the delete-reversal style.
--     (The INSERT trigger handle_rsvp_created only fires on
--     INSERT, so changing going -> not_going never reversed +2.)
-- ============================================================
create or replace function public.handle_rsvp_updated_points()
returns trigger as $$
begin
  -- Leaving going/interested: write -2 only if a +2 exists and no -2 yet.
  if OLD.status in ('going', 'interested')
    and (NEW.status is null or NEW.status not in ('going', 'interested')) then
    if exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'rsvp_going' and points = 2
        and ref_table = 'event_rsvps' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'rsvp_going' and points = -2
        and ref_table = 'event_rsvps' and ref_id = OLD.id
    ) then
      insert into public.user_points(user_id, action, points, ref_table, ref_id)
      values (OLD.user_id, 'rsvp_going', -2, 'event_rsvps', OLD.id);
    end if;
  end if;
  -- Entering going/interested: write +2 only if no +2 row exists yet.
  if NEW.status in ('going', 'interested')
    and (OLD.status is null or OLD.status not in ('going', 'interested')) then
    if not exists (
      select 1 from public.user_points
      where user_id = NEW.user_id and action = 'rsvp_going' and points = 2
        and ref_table = 'event_rsvps' and ref_id = NEW.id
    ) then
      insert into public.user_points(user_id, action, points, ref_table, ref_id)
      values (NEW.user_id, 'rsvp_going', 2, 'event_rsvps', NEW.id);
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_rsvp_updated_points on public.event_rsvps;
create trigger on_rsvp_updated_points
  after update on public.event_rsvps
  for each row execute procedure public.handle_rsvp_updated_points();

-- ============================================================
-- §5. Lost & found — owner can delete their own row.
--     Guests have poster_id NULL, so auth.uid() = NULL is never
--     true and they still cannot delete.
-- ============================================================
drop policy if exists "Owner deletes own lost_found" on public.lost_found;
create policy "Owner deletes own lost_found" on public.lost_found
  for delete using (auth.uid() = poster_id);

-- ============================================================
-- §3. prevent_profile_privilege_change — extend the 9.3 trigger.
--     total_reviews / total_listings: block depth-1 changes like
--     the existing points guard, so the legitimate server triggers
--     (depth >= 2) still pass. can_manage_donations: block unless
--     the caller is admin-only — is_admin_only() is what the
--     admin-only RPC set_donation_permission (9.5) checks, so the
--     RPC still passes (it verifies admin before updating).
--     (is_admin_or_above() would ALSO let moderators through,
--     which would defeat the admin-only RPC.)
-- ============================================================
create or replace function public.prevent_profile_privilege_change()
returns trigger as $$
begin
  if NEW.points is distinct from OLD.points and pg_trigger_depth() = 1 then
    raise exception 'points ကို တိုက်ရိုက် ပြောင်းလို့မရပါ';
  end if;
  if NEW.total_reviews is distinct from OLD.total_reviews and pg_trigger_depth() = 1 then
    raise exception 'total_reviews ကို တိုက်ရိုက် ပြောင်းလို့မရပါ';
  end if;
  if NEW.total_listings is distinct from OLD.total_listings and pg_trigger_depth() = 1 then
    raise exception 'total_listings ကို တိုက်ရိုက် ပြောင်းလို့မရပါ';
  end if;
  if NEW.can_manage_donations is distinct from OLD.can_manage_donations and not public.is_admin_only() then
    raise exception 'Donation permission ကို Admin သာ ပြောင်းနိုင်သည်';
  end if;
  if NEW.role is distinct from OLD.role and not public.is_super_admin() then
    raise exception 'Role ကို Super Admin သာ ပြောင်းနိုင်သည်';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_profile_privilege_change on public.profiles;
create trigger prevent_profile_privilege_change
  before update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_change();

-- ============================================================
-- §1. Leaderboard views — REBUILT (9.18).
--     9.17 used CREATE OR REPLACE VIEW and failed with 42P16:
--     it inserts all_time_points mid-list, which Postgres
--     forbids. DROP + CREATE has no such restriction.
--     DROP destroys grants, so SELECT is re-granted to anon
--     AND authenticated (guests read the board too).
--     Views stay security_invoker=false (the default, as
--     before): they run as owner and are NOT filtered by the
--     user_points "own rows only" RLS policy.
--     GROUP BY lists every profile column (not just p.id) so
--     the view does not depend on profiles.id being a PK.
-- ============================================================
drop view if exists leaderboard_month;
create view leaderboard_month as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  p.points as all_time_points,
  coalesce(sum(up.points) filter (
    where up.created_at >= (date_trunc('month', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ), 0)::int as period_points,
  coalesce(count(distinct r.id) filter (
    where r.created_at >= (date_trunc('month', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ), 0)::int as period_reviews,
  coalesce(count(distinct l.id) filter (
    where l.approved_at >= (date_trunc('month', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
      and l.status = 'approved'
  ), 0)::int as period_listings
from profiles p
left join user_points up on up.user_id = p.id
left join reviews r      on r.user_id  = p.id
left join listings l     on l.submitted_by = p.id
group by p.id, p.full_name, p.nickname, p.avatar_url, p.role, p.last_seen, p.is_online, p.total_reviews, p.total_listings, p.points;

drop view if exists leaderboard_6month;
create view leaderboard_6month as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  p.points as all_time_points,
  coalesce(sum(up.points) filter (
    where up.created_at >= now() - interval '6 months'
  ), 0)::int as period_points,
  coalesce(count(distinct r.id) filter (
    where r.created_at >= now() - interval '6 months'
  ), 0)::int as period_reviews,
  coalesce(count(distinct l.id) filter (
    where l.approved_at >= now() - interval '6 months'
      and l.status = 'approved'
  ), 0)::int as period_listings
from profiles p
left join user_points up on up.user_id = p.id
left join reviews r      on r.user_id  = p.id
left join listings l     on l.submitted_by = p.id
group by p.id, p.full_name, p.nickname, p.avatar_url, p.role, p.last_seen, p.is_online, p.total_reviews, p.total_listings, p.points;

drop view if exists leaderboard_year;
create view leaderboard_year as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  p.points as all_time_points,
  coalesce(sum(up.points) filter (
    where up.created_at >= (date_trunc('year', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ), 0)::int as period_points,
  coalesce(count(distinct r.id) filter (
    where r.created_at >= (date_trunc('year', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ), 0)::int as period_reviews,
  coalesce(count(distinct l.id) filter (
    where l.approved_at >= (date_trunc('year', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
      and l.status = 'approved'
  ), 0)::int as period_listings
from profiles p
left join user_points up on up.user_id = p.id
left join reviews r      on r.user_id  = p.id
left join listings l     on l.submitted_by = p.id
group by p.id, p.full_name, p.nickname, p.avatar_url, p.role, p.last_seen, p.is_online, p.total_reviews, p.total_listings, p.points;

grant select on leaderboard_month, leaderboard_6month, leaderboard_year to anon, authenticated;

-- ============================================================
-- §7. Rent / tutoring expiry (+30 days, like jobs).
--     rentals / tutoring were created live and are NOT in the
--     repo schema, so this is IF EXISTS-guarded: it applies on
--     the live DB and no-ops anywhere the tables do not exist.
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rentals') then
    alter table public.rentals add column if not exists expires_at timestamptz default (now() + interval '30 days');
    update public.rentals set expires_at = created_at + interval '30 days' where expires_at is null;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tutoring') then
    alter table public.tutoring add column if not exists expires_at timestamptz default (now() + interval '30 days');
    update public.tutoring set expires_at = created_at + interval '30 days' where expires_at is null;
  end if;
end $$;

-- ============================================================
-- §8. Orphaned bookmarks cleanup.
--     bookmarks is polymorphic (target_type 'listing'/'post' +
--     target_id, no FK — schema-final:206-213), so deleting a
--     listing or post left bookmark rows pointing at nothing.
--     The triggers delete those rows on target delete; the two
--     one-off DELETEs repair already-orphaned rows.
-- ============================================================
create or replace function public.cleanup_bookmarks_on_target_delete()
returns trigger as $$
begin
  if TG_TABLE_NAME = 'listings' then
    delete from bookmarks where target_type = 'listing' and target_id = OLD.id;
  elsif TG_TABLE_NAME = 'posts' then
    delete from bookmarks where target_type = 'post' and target_id = OLD.id;
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cleanup_bookmarks_listing on public.listings;
create trigger trg_cleanup_bookmarks_listing
  after delete on public.listings
  for each row execute procedure public.cleanup_bookmarks_on_target_delete();

drop trigger if exists trg_cleanup_bookmarks_post on public.posts;
create trigger trg_cleanup_bookmarks_post
  after delete on public.posts
  for each row execute procedure public.cleanup_bookmarks_on_target_delete();

delete from bookmarks b
where target_type = 'listing'
  and not exists (select 1 from listings l where l.id = b.target_id);
delete from bookmarks b
where target_type = 'post'
  and not exists (select 1 from posts p where p.id = b.target_id);

-- ============================================================
-- §9. notifications GRANT (9.18) — fixes the 403 on the unread
--     count (and the list / mark-read / delete). The policies
--     exist, the privilege did not. authenticated only: anon
--     users have no rows (auth.uid() is null), so an anon grant
--     would be dead privilege.
-- ============================================================
grant select, insert, update, delete on public.notifications to authenticated;

-- ============================================================
-- §10. listings phone_3/4/5 (9.18) — schema convergence.
--      Submit/Edit pages write all five phone columns, but the
--      repo schema only ever created phone_1/phone_2. If the
--      live DB already has them (added by hand when the 5-phone
--      UI was built), these are no-ops.
-- ============================================================
alter table public.listings add column if not exists phone_3 text;
alter table public.listings add column if not exists phone_4 text;
alter table public.listings add column if not exists phone_5 text;
