-- ============================================================
-- Cherry Directory — v9.5 migration (Track E: donations)
-- Run in: Supabase Dashboard → SQL Editor → paste & Run.
-- Run it AFTER deploying the v9.5 code.
-- Idempotent and safe to re-run: it runs cleanly twice in a
-- row (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE for
-- functions, DROP TRIGGER IF EXISTS before CREATE). Nothing
-- in here touches live data rows except adding one column
-- with a default (false) to profiles.
--
-- What this migration does (user decision 2026-11-04):
--   ONLY an admin, or a moderator with EXPLICIT admin-granted
--   permission, may edit donations.collected_amount. NOT all
--   moderators, and NOT the campaign organizer (unless they
--   also hold that permission).
--   * §0 — is_admin_only() helper inlined (same as 9.3 §0;
--          self-contained: 9.5 runs on its own).
--   * §1 — profiles.can_manage_donations flag (default false)
--   * §2 — SECURITY DEFINER helper public.can_manage_donations()
--   * §3 — BEFORE UPDATE trigger on donations: the REAL
--          enforcement. RLS policies cannot restrict by column,
--          so the trigger raises when collected_amount changes
--          and the caller may not manage donations.
--   * §4 — SECURITY DEFINER RPC set_donation_permission(), admin
--          only, updates ONLY profiles.can_manage_donations
--          (the Admin UI calls this RPC).
--
-- EXPLICITLY NOT in this file (per the v9.5 spec):
--   * No change to the donations SELECT / INSERT / DELETE
--     policies, or to "Organizer can update" — the trigger
--     only guards the collected_amount column.
--   * No bus_routes.operator_phone, health_services.opening_hours
--     or health_services.specialty column — those are schema +
--     data decisions still open (see audit E2/E17/E18/E23).
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- §1. profiles.can_manage_donations flag
--    Default false: existing moderators gain NOTHING until an
--    admin explicitly grants it via the §4 RPC.
-- ============================================================
alter table public.profiles
  add column if not exists can_manage_donations boolean not null default false;

-- ============================================================
-- §2. Helper: may the caller manage donations?
--    True when the caller is admin/super_admin, OR a moderator
--    whose can_manage_donations flag is true. Reuses the §0
--    role helpers from supabase-migration-9.3.sql where they
--    fit; the moderator+flag case needs the flag read, so it
--    is spelled out here. SECURITY DEFINER so the trigger (§3)
--    and any RLS-adjacent caller can read the caller's own
--    profile row regardless of profiles SELECT policy.
-- ============================================================
create or replace function public.can_manage_donations()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role in ('admin', 'super_admin')
        or (role = 'moderator' and coalesce(can_manage_donations, false) = true)
      )
  );
$$ language sql stable security definer;

-- ============================================================
-- §3. Trigger: guard donations.collected_amount
--    BEFORE UPDATE on public.donations. Raises (and rolls the
--    update back) when collected_amount changes and the caller
--    may NOT manage donations. Every other column update is
--    untouched — organizers/admins/moderators keep exactly the
--    access the "Organizer can update" policy gives them.
--    (An update that does not touch collected_amount, e.g. an
--    organizer editing their own title, passes through.)
-- ============================================================
create or replace function public.enforce_donation_collected_amount()
returns trigger as $$
begin
  if new.collected_amount is distinct from old.collected_amount
     and not public.can_manage_donations() then
    raise exception 'Only an admin or a moderator with donation permission may edit collected_amount';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists donations_collected_amount_guard on public.donations;
create trigger donations_collected_amount_guard
  before update on public.donations
  for each row execute function public.enforce_donation_collected_amount();

-- ============================================================
-- §0. Helper inlined for self-containment: is_admin_only()
--    (same definition as supabase-migration-9.3.sql §0, which
--    is already applied live — CREATE OR REPLACE makes this
--    a harmless no-op when 9.3 is present, and makes 9.5
--    runnable on its own if 9.3 ever was not applied).
-- ============================================================
create or replace function public.is_admin_only()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql stable security definer;

-- ============================================================
-- §4. RPC: grant / revoke the donation permission
--    Admin ONLY (checked inside; anon/authenticated callers
--    without the admin role get an exception, never a silent
--    no-op). Updates ONLY profiles.can_manage_donations for
--    the given user — no other column, no other row. The Admin
--    UI (Track G) calls this RPC.
-- ============================================================
create or replace function public.set_donation_permission(p_user_id uuid, p_allowed boolean)
returns void as $$
begin
  if not public.is_admin_only() then
    raise exception 'Only an admin may grant donation permission';
  end if;
  update public.profiles
    set can_manage_donations = p_allowed
    where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$ language plpgsql security definer;

revoke execute on function public.set_donation_permission(uuid, boolean) from public;
grant execute on function public.set_donation_permission(uuid, boolean) to authenticated;
