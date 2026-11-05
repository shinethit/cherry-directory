-- Cherry Directory v9.19 — SQL migration (leaderboard performance rewrite).
-- RUN THIS FILE ONLY, AFTER DEPLOY, in Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- NEVER RE-RUN supabase-migration-9.17.sql — it is broken as written
-- (42P16, CREATE OR REPLACE VIEW cannot rename a column).
-- The 9.18 migration ALREADY RAN ("Success. No rows returned") — no
-- need to re-run it. This file only fixes what 9.18 left slow.
--
-- WHY: the 9.18 views (and the original schema-final:698-760 shape)
-- compute period figures with a 3-way LEFT JOIN (profiles x
-- user_points x reviews x listings) + GROUP BY. Per user the join
-- materializes the Cartesian product: every user_points row is
-- duplicated by (#reviews x #listings). The admin (bulk import stamped
-- submitted_by = admin on all 1,157 listings; ~2,300+ ledger rows from
-- +10 submit / +20 approval per listing) explodes to tens of millions
-- of joined rows, and Postgres cancels it at the role statement
-- timeout (Supabase defaults: anon 3s, authenticated 8s) — PostgREST
-- 500, error 57014 "canceling statement due to statement timeout".
-- The 500 and the "statement timeout" detail are ONE failure.
-- It is ALSO a correctness bug: sum(up.points) is inflated by R x L
-- (count(distinct) saved the review/listing counts, not the points
-- sum) — the admin's period points were astronomically wrong, not
-- just slow.
--
-- WHAT IT CHANGES:
--   §1. The three leaderboard views are rebuilt (DROP + CREATE, same
--      columns, same Yangon period boundaries, same approved_at
--      semantics, NO GROUP BY): each period figure is a scalar
--      correlated subquery per profile — period_points sums only the
--      user's own ledger rows, period_reviews / period_listings count
--      only the user's own rows. SELECT re-granted to anon +
--      authenticated (DROP destroys grants). No security_invoker
--      change (views stay security_invoker=false, the default, as
--      before).
--   §2. Three supporting indexes + ANALYZE, so each subquery is an
--      indexed range lookup.
-- Every statement is idempotent (DROP VIEW IF EXISTS / CREATE INDEX
-- IF NOT EXISTS / ANALYZE) — safe to run twice.
--
-- WHY IT IS FAST: profiles is ~9-50 rows; each row does 3 indexed
-- range lookups (a few thousand rows max for the admin) -> the whole
-- view resolves in milliseconds, inside even the 3s anon budget. The
-- rank-beyond count query and fetchMonthlyPoints (eq id) become
-- indexed single-profile lookups too.
--
-- WHAT IT DOES NOT TOUCH: no ledger rows, no counters, no policies,
-- no triggers, no other tables. The 9.18 §2-§10 change set is
-- untouched (already live).

-- ============================================================
-- §1. Leaderboard views — REBUILT (9.19): scalar correlated
--     subqueries instead of the 3-way JOIN + GROUP BY.
--     Same columns, same Yangon period boundaries, same
--     approved_at counting as 9.18 intended — only the shape
--     changes, so no code change is needed to read them.
-- ============================================================
drop view if exists leaderboard_month;
create view leaderboard_month as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  p.points as all_time_points,
  (select coalesce(sum(points), 0)::int from public.user_points
    where user_id = p.id
      and created_at >= (date_trunc('month', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ) as period_points,
  (select count(*)::int from public.reviews
    where user_id = p.id
      and created_at >= (date_trunc('month', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ) as period_reviews,
  (select count(*)::int from public.listings
    where submitted_by = p.id
      and approved_at >= (date_trunc('month', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
      and status = 'approved'
  ) as period_listings
from public.profiles p;

drop view if exists leaderboard_6month;
create view leaderboard_6month as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  p.points as all_time_points,
  (select coalesce(sum(points), 0)::int from public.user_points
    where user_id = p.id
      and created_at >= now() - interval '6 months'
  ) as period_points,
  (select count(*)::int from public.reviews
    where user_id = p.id
      and created_at >= now() - interval '6 months'
  ) as period_reviews,
  (select count(*)::int from public.listings
    where submitted_by = p.id
      and approved_at >= now() - interval '6 months'
      and status = 'approved'
  ) as period_listings
from public.profiles p;

drop view if exists leaderboard_year;
create view leaderboard_year as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  p.points as all_time_points,
  (select coalesce(sum(points), 0)::int from public.user_points
    where user_id = p.id
      and created_at >= (date_trunc('year', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ) as period_points,
  (select count(*)::int from public.reviews
    where user_id = p.id
      and created_at >= (date_trunc('year', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
  ) as period_reviews,
  (select count(*)::int from public.listings
    where submitted_by = p.id
      and approved_at >= (date_trunc('year', now() at time zone 'Asia/Rangoon') at time zone 'Asia/Rangoon')
      and status = 'approved'
  ) as period_listings
from public.profiles p;

grant select on leaderboard_month, leaderboard_6month, leaderboard_year to anon, authenticated;

-- ============================================================
-- §2. Indexes for the correlated subqueries + ANALYZE.
--     Without these each subquery would seq-scan its table per
--     profile; with them each is an indexed range lookup.
-- ============================================================
create index if not exists leaderboard_up_user_time_idx
  on public.user_points (user_id, created_at);
create index if not exists leaderboard_reviews_user_time_idx
  on public.reviews (user_id, created_at);
create index if not exists leaderboard_listings_submitter_approved_idx
  on public.listings (submitted_by, approved_at);

analyze public.user_points;
analyze public.reviews;
analyze public.listings;
