-- Cherry Directory v9.14 — GRANT INSERT on site_visits (visitor counting fix)
-- RUN AFTER DEPLOY in Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Fixes visitor counts stuck at 0: the 9.12 migration created the table, the
-- INSERT policy, and the get_visit_stats() RPC, but never granted the INSERT
-- privilege itself. An RLS policy alone does not confer the privilege, so
-- anon INSERT failed with 42501 and no visits were ever recorded.
-- Idempotent: GRANT is safe to run twice.

GRANT INSERT ON public.site_visits TO anon, authenticated;
