-- ============================================================
-- Cherry Directory — v9.6 migration (schema fields for the
-- 9.6 tracks: chat room type, bus operator phone, health
-- opening hours + specialty)
-- Run in: Supabase Dashboard → SQL Editor → paste & Run.
-- Run it AFTER deploying the v9.6 code.
-- Idempotent and safe to re-run: every statement uses
-- ADD COLUMN IF NOT EXISTS, so running it twice adds
-- nothing the second time. Nothing in here touches live
-- data rows except backfilling the new chat_rooms.type
-- column with its default ('group') on existing rooms.
--
-- What this migration does:
--   * §1 — chat_rooms.type: 'group' | 'private'
--          (Chat track: room-type choice on create)
--   * §2 — bus_routes.operator_phone: operator's phone
--          (Bus track: shown with tel: link; guest masking
--          still applies. Arrival time is NOT a column —
--          bus_routes.duration_hours already exists and the
--          bus track computes arrival from it.)
--   * §3 — health_services.opening_hours + specialty
--          (Health track: shown on the service card/detail)
--
-- RLS — NO policy change in this file (verified 2026-11-04
-- against supabase-schema-final.sql + supabase-migration-
-- 9.3.sql): RLS policies are row-level, never column-level,
-- so new columns are read under their table's existing
-- policies. chat_rooms and bus_routes have RLS disabled
-- entirely (no policies on either table), and
-- health_services already has its SELECT policy ("Health
-- services public", status = 'active') plus the owner/admin
-- FOR ALL policies, which cover the new columns as-is.
--
-- EXPLICITLY NOT in this file:
--   * No bus_departures.arrival_time column —
--     bus_routes.duration_hours (numeric) already exists
--     and arrival is computed from it in code.
--   * No change to any RLS policy (see above).
-- ============================================================

-- ============================================================
-- §1. chat_rooms.type — Group vs Private room
--    NOT NULL with default 'group': existing rooms become
--    group rooms, and new rooms get 'group' unless the
--    creator picks 'private'. CHECK keeps the column to
--    the two values the UI offers.
-- ============================================================
alter table public.chat_rooms
  add column if not exists type text not null default 'group'
  check (type in ('group', 'private'));

-- ============================================================
-- §2. bus_routes.operator_phone — operator's phone number
--    Nullable, no default: existing routes simply have no
--    phone until an admin/moderator adds one. Displayed
--    with the same guest masking as other phone numbers.
-- ============================================================
alter table public.bus_routes
  add column if not exists operator_phone text;

-- ============================================================
-- §3. health_services.opening_hours + specialty
--    Both nullable text, no defaults: existing services
--    show nothing for these fields until filled in.
-- ============================================================
alter table public.health_services
  add column if not exists opening_hours text;

alter table public.health_services
  add column if not exists specialty text;
