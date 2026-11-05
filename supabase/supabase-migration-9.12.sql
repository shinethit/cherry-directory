-- Cherry Directory v9.12 — visitor stats (site_visits + get_visit_stats)
-- RUN AFTER DEPLOY in Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Counts start at ZERO when this runs — there is no backfill (no visits were
-- recorded before 9.12). Idempotent: safe to run twice.
-- Privacy: rows hold NO IP, NO user-agent, NO identifiers, NO names — only
-- timestamp, device type, country code/name, and entry page. Reads go
-- through the SECURITY DEFINER RPC below, never a SELECT policy.

CREATE TABLE IF NOT EXISTS public.site_visits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visited_at timestamptz NOT NULL DEFAULT now(),
  device_type text NOT NULL CHECK (device_type IN ('phone', 'tablet', 'desktop')),
  country_code text NULL,
  country_name text NULL,
  page text NOT NULL DEFAULT '/'
);

CREATE INDEX IF NOT EXISTS site_visits_visited_at_idx
  ON public.site_visits (visited_at);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visits_insert_public" ON public.site_visits;
CREATE POLICY "site_visits_insert_public" ON public.site_visits
  FOR INSERT WITH CHECK (true);

-- No SELECT policy on purpose: the client reads ONLY through get_visit_stats()
-- below (SECURITY DEFINER), so raw visit rows are never exposed.

CREATE OR REPLACE FUNCTION public.get_visit_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH yangon AS (
    SELECT visited_at AT TIME ZONE 'Asia/Yangon' AS local_ts
    FROM public.site_visits
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM yangon) AS total,
      (SELECT count(*) FROM yangon
        WHERE local_ts::date = (now() AT TIME ZONE 'Asia/Yangon')::date) AS today,
      (SELECT count(*) FROM yangon
        WHERE local_ts >= (now() AT TIME ZONE 'Asia/Yangon')::date - INTERVAL '6 days') AS week,
      (SELECT count(*) FROM yangon
        WHERE local_ts >= (now() AT TIME ZONE 'Asia/Yangon')::date - INTERVAL '29 days') AS month
  ),
  devices AS (
    SELECT device_type, count(*) AS c FROM public.site_visits GROUP BY device_type
  ),
  countries AS (
    SELECT country_code, country_name, count(*) AS c
    FROM public.site_visits
    WHERE country_code IS NOT NULL
    GROUP BY country_code, country_name
    ORDER BY c DESC
    LIMIT 5
  ),
  hours AS (
    SELECT EXTRACT(HOUR FROM local_ts)::int AS h, count(*) AS c FROM yangon GROUP BY h
  ),
  daily AS (
    SELECT local_ts::date AS d, count(*) AS c FROM yangon
    WHERE local_ts >= (now() AT TIME ZONE 'Asia/Yangon')::date - INTERVAL '13 days'
    GROUP BY d ORDER BY d ASC
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM totals),
    'today', (SELECT today FROM totals),
    'week', (SELECT week FROM totals),
    'month', (SELECT month FROM totals),
    'by_device', COALESCE((SELECT jsonb_object_agg(device_type, c) FROM devices), '{}'::jsonb),
    'by_country', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', country_code, 'name', country_name, 'count', c)) FROM countries), '[]'::jsonb),
    'by_hour', COALESCE((SELECT jsonb_object_agg(h::text, c) FROM hours), '{}'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d::text, 'count', c)) FROM daily), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_visit_stats() TO anon, authenticated;
