-- Cherry Directory v9.43 — SQL migration (Disk IO fix).
-- RUN THIS FILE ONLY, AFTER DEPLOY, in Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- The app works WITHOUT this file (the code falls back to
-- per-category counts and per-page counts), but the Disk IO
-- savings — one scan instead of ~20 per category load, indexed
-- counts and substring search — only take effect AFTER this
-- migration runs.
--
-- WHY: the project is depleting its daily Disk IO Budget
-- (Supabase free tier). The data is small (2,186 approved
-- listings) — the cause is query patterns: every listings page
-- fetch ran a full count scan, and every Home / Directory load
-- ran one head-count per top-level category (~20 parallel
-- scans). This file adds the indexes those queries need and
-- one aggregated count function so the app can count all
-- categories in a single scan.
--
-- WHAT IT CHANGES:
--   §1. One composite index on the listings hot path
--       (status, category_id, city) — serves every listings
--       list/count, which always filters status='approved' +
--       category_id IN (...) (+ optional city).
--   §2. Four trigram indexes for the ilike substring search
--       (name, name_mm, description, description_mm). The
--       search ORs across all four fields, and a bitmap-OR
--       needs an index arm for EVERY branch or Postgres falls
--       back to a sequential scan. Single-character searches
--       still scan (too few trigrams) — accepted.
--   §3. get_category_listing_counts() — one-scan per-category
--       counts (replaces ~20 per-category head counts).
--       SECURITY INVOKER (the default): approved listings are
--       already public via RLS ("Approved listings are public"),
--       so no DEFINER bypass is needed. Returns only categories
--       with >=1 approved listing; callers treat a missing row
--       as 0. Same grant pattern as get_visit_stats (9.12).
--   Then ANALYZE so the planner sees the new indexes.
-- Every statement is idempotent (CREATE EXTENSION IF NOT
-- EXISTS / CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE
-- FUNCTION) — safe to run twice.
--
-- WHAT IT DOES NOT TOUCH: no data changes, no policies, no
-- triggers, no other tables. No CONCURRENTLY (it cannot run
-- in the SQL Editor's transaction context; the table is tiny,
-- the lock lasts milliseconds — run before festival week,
-- not during).
--
-- IF THE EXTENSION LINE ERRORS: enable pg_trgm in
-- Dashboard -> Database -> Extensions first, then re-run
-- this file from §1 (the extension line is safe to skip on
-- the second run).
--
-- VERIFY AFTER RUNNING:
--   SELECT indexname FROM pg_indexes WHERE tablename = 'listings';
--   -- expect the 5 new indexes below + the 9.19 one
--   -- (leaderboard_listings_submitter_approved_idx).
--   SELECT * FROM public.get_category_listing_counts()
--   ORDER BY listing_count DESC LIMIT 5;

-- pg_trgm for substring search. Supabase installs extensions
-- into the `extensions` schema; pin it so the opclass reference
-- below resolves.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================
-- §1. Hot-path composite index: every listings list/count
--     filters status='approved' + category_id IN (...)
--     (+ optional city). Serves DirectoryPage lists,
--     fetchCategories / loadSubcategories / checkDirectListings
--     counts, Home countsQ (status prefix), and the Admin
--     listings status counts. ORDER BY cannot be served: the
--     query has IN (...) on category_id and 3 sort variants
--     (rating/newest/name).
-- ============================================================
CREATE INDEX IF NOT EXISTS listings_status_category_city_idx
  ON public.listings (status, category_id, city);

-- ============================================================
-- §2. Trigram indexes for the ilike substring search.
-- ============================================================
CREATE INDEX IF NOT EXISTS listings_name_trgm_idx
  ON public.listings USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_name_mm_trgm_idx
  ON public.listings USING gin (name_mm extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_description_trgm_idx
  ON public.listings USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_description_mm_trgm_idx
  ON public.listings USING gin (description_mm extensions.gin_trgm_ops);

-- ============================================================
-- §3. One-scan category counts (replaces ~20 per-category
--     head counts).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_category_listing_counts()
RETURNS TABLE(category_id uuid, listing_count bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT category_id, count(*)::bigint
  FROM public.listings
  WHERE status = 'approved' AND category_id IS NOT NULL
  GROUP BY category_id
$$;
GRANT EXECUTE ON FUNCTION public.get_category_listing_counts() TO anon, authenticated;

ANALYZE public.listings;
