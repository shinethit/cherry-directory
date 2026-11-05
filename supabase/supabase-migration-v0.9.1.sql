-- ============================================================
-- Cherry Directory — v0.9.1 migration
-- Run in: Supabase Dashboard → SQL Editor → paste & Run.
-- Idempotent and safe to re-run. It converges a hand-patched
-- live DB toward the repo schema (CREATE ... IF NOT EXISTS,
-- DROP POLICY IF EXISTS before CREATE POLICY, guarded DO
-- blocks). Run it AFTER deploying the v0.9.1 code.
-- NOTE: reports.status uses 'reviewed' (not 'resolved') —
-- AdminReportsPage was updated to match this CHECK.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 0. ROLE HELPERS (SECURITY DEFINER — bypasses RLS, so no
--    policy recursion: policies may call these freely, even
--    policies on profiles itself)
-- ============================================================
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function public.is_admin_or_above()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'moderator', 'super_admin')
  );
$$ language sql stable security definer;

create or replace function public.is_admin_only()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql stable security definer;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql stable security definer;

-- ============================================================
-- 1. PROFILES — role escalation guard (CRITICAL)
--    Only a super_admin may change anyone's role. A BEFORE
--    UPDATE trigger enforces it; the policy below lets
--    admin/mod/super_admin update OTHER users' profiles
--    (non-role fields, e.g. AdminPage role UI for super_admins).
--    The trigger cannot block a legitimate super_admin change
--    (is_super_admin() is true for the actor) and never fires
--    on INSERT (handle_new_user) or on non-role updates.
-- ============================================================
create or replace function public.prevent_role_escalation()
returns trigger as $$
begin
  if NEW.role is distinct from OLD.role and not public.is_super_admin() then
    raise exception 'Role ကို Super Admin သာ ပြောင်းနိုင်သည်';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- Keep self-update, but the trigger above now blocks role changes
-- inside it for everyone except super_admin.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can update other profiles" on public.profiles;
create policy "Admins can update other profiles" on public.profiles
  for update using (public.is_admin_or_above() and auth.uid() <> id)
  with check (public.is_admin_or_above() and auth.uid() <> id);

-- ============================================================
-- 2. MISSING TABLES — rentals / tutoring / history / saved_places
--    Columns derived from the UI pages (RentPage, TutoringPage,
--    HistoryPage, SavedPlacesPage/SavedPage). No CHECK on the
--    free-text enum columns (property_type, subject, grade_level,
--    post_type, category) — the UI owns those value lists.
-- ============================================================
create table if not exists public.rentals (
  id uuid default uuid_generate_v4() primary key,
  title text,
  title_mm text,
  description_mm text,
  location_mm text,
  property_type text default 'room',
  post_type text default 'owner',
  price_monthly numeric(12, 0),
  price_deposit numeric(12, 0),
  phone text,
  contact_name text,
  images text[] default '{}',
  user_id uuid references public.profiles(id) on delete set null,
  poster_name text,
  is_urgent boolean default false,
  status text default 'available',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tutoring (
  id uuid default uuid_generate_v4() primary key,
  title text,
  title_mm text,
  description_mm text,
  location_mm text,
  subject text default 'math',
  grade_level text default 'high',
  post_type text default 'tutor',
  price_hourly numeric(12, 0),
  price_monthly numeric(12, 0),
  phone text,
  contact_name text,
  availability_schedule text,
  images text[] default '{}',
  user_id uuid references public.profiles(id) on delete set null,
  poster_name text,
  is_urgent boolean default false,
  status text default 'available',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.history (
  id uuid default uuid_generate_v4() primary key,
  title text,
  title_mm text,
  excerpt_mm text,
  content_mm text,
  category text default 'history',
  location_mm text,
  event_date date,
  author_name text,
  author_bio text,
  cover_url text,
  images text[] default '{}',
  author_id uuid references public.profiles(id) on delete set null,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.saved_places (
  id uuid default uuid_generate_v4() primary key,
  name text,
  name_mm text,
  category text default 'other',
  address_mm text,
  note text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists rentals_created_idx   on public.rentals(created_at desc);
create index if not exists rentals_user_idx     on public.rentals(user_id);
create index if not exists tutoring_created_idx on public.tutoring(created_at desc);
create index if not exists tutoring_user_idx    on public.tutoring(user_id);
create index if not exists history_created_idx  on public.history(created_at desc);
create index if not exists history_cat_idx      on public.history(category, status);
create index if not exists saved_places_user_idx on public.saved_places(user_id);

-- RLS + policies for the new tables
alter table public.rentals enable row level security;
alter table public.tutoring enable row level security;
alter table public.history enable row level security;
alter table public.saved_places enable row level security;

-- Rentals: public read (UI lists all, user filters by status),
-- owner insert/update/delete, admin/mod/super_admin full access.
drop policy if exists "Rentals are public" on public.rentals;
create policy "Rentals are public" on public.rentals for select using (true);
drop policy if exists "Auth users can post rentals" on public.rentals;
create policy "Auth users can post rentals" on public.rentals
  for insert with check (auth.uid() = user_id);
drop policy if exists "Owners manage own rentals" on public.rentals;
create policy "Owners manage own rentals" on public.rentals
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Owners delete own rentals" on public.rentals;
create policy "Owners delete own rentals" on public.rentals
  for delete using (auth.uid() = user_id);
drop policy if exists "Admins manage rentals" on public.rentals;
create policy "Admins manage rentals" on public.rentals
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- Tutoring: same shape as rentals.
drop policy if exists "Tutoring is public" on public.tutoring;
create policy "Tutoring is public" on public.tutoring for select using (true);
drop policy if exists "Auth users can post tutoring" on public.tutoring;
create policy "Auth users can post tutoring" on public.tutoring
  for insert with check (auth.uid() = user_id);
drop policy if exists "Owners manage own tutoring" on public.tutoring;
create policy "Owners manage own tutoring" on public.tutoring
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Owners delete own tutoring" on public.tutoring;
create policy "Owners delete own tutoring" on public.tutoring
  for delete using (auth.uid() = user_id);
drop policy if exists "Admins manage tutoring" on public.tutoring;
create policy "Admins manage tutoring" on public.tutoring
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- History: only published rows are public; authors + admins see all.
-- Only moderators/admins may write (HistoryForm is moderator-only).
drop policy if exists "Published history is public" on public.history;
create policy "Published history is public" on public.history
  for select using (
    status = 'published'
    or auth.uid() = author_id
    or public.is_admin_or_above()
  );
drop policy if exists "Moderators can post history" on public.history;
create policy "Moderators can post history" on public.history
  for insert with check (public.is_admin_or_above());
drop policy if exists "Authors and admins manage history" on public.history;
create policy "Authors and admins manage history" on public.history
  for update using (auth.uid() = author_id or public.is_admin_or_above())
  with check (auth.uid() = author_id or public.is_admin_or_above());
drop policy if exists "Authors and admins delete history" on public.history;
create policy "Authors and admins delete history" on public.history
  for delete using (auth.uid() = author_id or public.is_admin_or_above());

-- Saved places: private per user (UI always filters by user_id).
drop policy if exists "Users see own saved places" on public.saved_places;
create policy "Users see own saved places" on public.saved_places
  for select using (auth.uid() = user_id);
drop policy if exists "Users manage own saved places" on public.saved_places;
create policy "Users manage own saved places" on public.saved_places
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 3. RLS ON THE 6 UNPROTECTED TABLES
--    Public read; writes admin/mod/super_admin only. No guest
--    inserts exist for these tables in the UI (guest reporting
--    goes through fuel_reports / price_reports, whose permissive
--    guest INSERT policies are intentionally left untouched).
-- ============================================================
alter table public.fuel_stations enable row level security;
alter table public.price_items   enable row level security;
alter table public.power_areas   enable row level security;
alter table public.bus_routes    enable row level security;
alter table public.chat_rooms    enable row level security;
alter table public.fuel_types    enable row level security;

drop policy if exists "Fuel stations are public" on public.fuel_stations;
create policy "Fuel stations are public" on public.fuel_stations for select using (true);
drop policy if exists "Admins manage fuel stations" on public.fuel_stations;
create policy "Admins manage fuel stations" on public.fuel_stations
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

drop policy if exists "Price items are public" on public.price_items;
create policy "Price items are public" on public.price_items for select using (true);
drop policy if exists "Admins manage price items" on public.price_items;
create policy "Admins manage price items" on public.price_items
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

drop policy if exists "Power areas are public" on public.power_areas;
create policy "Power areas are public" on public.power_areas for select using (true);
drop policy if exists "Admins manage power areas" on public.power_areas;
create policy "Admins manage power areas" on public.power_areas
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

drop policy if exists "Bus routes are public" on public.bus_routes;
create policy "Bus routes are public" on public.bus_routes
  for select using (is_active = true or public.is_admin_or_above());
drop policy if exists "Admins manage bus routes" on public.bus_routes;
create policy "Admins manage bus routes" on public.bus_routes
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

drop policy if exists "Chat rooms are public" on public.chat_rooms;
create policy "Chat rooms are public" on public.chat_rooms
  for select using (is_active = true or public.is_admin_or_above());
drop policy if exists "Admins manage chat rooms" on public.chat_rooms;
create policy "Admins manage chat rooms" on public.chat_rooms
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

drop policy if exists "Fuel types are public" on public.fuel_types;
create policy "Fuel types are public" on public.fuel_types for select using (true);
drop policy if exists "Admins manage fuel types" on public.fuel_types;
create policy "Admins manage fuel types" on public.fuel_types
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ============================================================
-- 4. app_config + quick_links (columns from AppSettingsPage /
--    AppConfigContext / AdminPage). Public read; writes
--    admin/super_admin only (AppSettingsPage is isAdmin-gated).
-- ============================================================
create table if not exists public.app_config (
  key text primary key,
  value text not null default '',
  label text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quick_links (
  id uuid default uuid_generate_v4() primary key,
  title text,
  title_mm text,
  subtitle text,
  icon text default '🔗',
  url text not null,
  css_classes text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.app_config enable row level security;
alter table public.quick_links enable row level security;

drop policy if exists "App config is public" on public.app_config;
create policy "App config is public" on public.app_config for select using (true);
drop policy if exists "Admins manage app config" on public.app_config;
create policy "Admins manage app config" on public.app_config
  for all using (public.is_admin_only())
  with check (public.is_admin_only());

drop policy if exists "Quick links are public" on public.quick_links;
create policy "Quick links are public" on public.quick_links
  for select using (is_active = true or public.is_admin_or_above());
drop policy if exists "Admins manage quick links" on public.quick_links;
create policy "Admins manage quick links" on public.quick_links
  for all using (public.is_admin_only())
  with check (public.is_admin_only());

-- ============================================================
-- 5. chat_rooms.sort_order (ChatPage orders + updates it)
-- ============================================================
alter table public.chat_rooms add column if not exists sort_order int default 0;

-- ============================================================
-- 6. LISTINGS — guest submit, admin visibility, owner delete,
--    protected-field guard, missing columns
-- ============================================================
alter table public.listings add column if not exists report_count int default 0;
alter table public.listings add column if not exists menu_items jsonb default '[]'::jsonb;

-- INSERT: guests (anon) ONLY with status='pending' and no
-- submitted_by; signed-in users ONLY with status='pending'
-- (never 'approved' on insert) and submitted_by = self.
drop policy if exists "Authenticated can submit" on public.listings;
drop policy if exists "Guests can submit pending listings" on public.listings;
create policy "Guests can submit pending listings" on public.listings
  for insert with check (
    auth.uid() is null and status = 'pending'
    and submitted_by is null and owner_id is null
  );
drop policy if exists "Auth users can submit pending listings" on public.listings;
create policy "Auth users can submit pending listings" on public.listings
  for insert with check (
    auth.uid() is not null and status = 'pending' and owner_id is null
    and (submitted_by is null or submitted_by = auth.uid())
  );

-- SELECT: admin/mod/super_admin can see pending listings too
-- (the approve queue was empty for them before this).
drop policy if exists "Admins can view all listings" on public.listings;
create policy "Admins can view all listings" on public.listings
  for select using (public.is_admin_or_above());

-- DELETE: owner (submitter or verified owner) + admin/mod/super_admin.
drop policy if exists "Owner can delete own listing" on public.listings;
create policy "Owner can delete own listing" on public.listings
  for delete using (auth.uid() = submitted_by or auth.uid() = owner_id);
drop policy if exists "Admins can delete listings" on public.listings;
create policy "Admins can delete listings" on public.listings
  for delete using (public.is_admin_or_above());

-- UPDATE guard: non-admins may not change status / is_verified /
-- rating_avg / verify_type (RLS cannot restrict columns).
-- pg_trigger_depth() carve-out: system triggers that update
-- listings from inside another trigger (review rating recompute,
-- claim verification) run at depth >= 2 and must not be blocked.
create or replace function public.prevent_listing_field_escalation()
returns trigger as $$
begin
  if pg_trigger_depth() = 1 and not public.is_admin_or_above() then
    if NEW.status is distinct from OLD.status
      or NEW.is_verified is distinct from OLD.is_verified
      or NEW.rating_avg is distinct from OLD.rating_avg
      or NEW.verify_type is distinct from OLD.verify_type then
      raise exception 'status / is_verified / rating_avg ကို Admin သာ ပြောင်းနိုင်သည်';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_listing_field_escalation on public.listings;
create trigger prevent_listing_field_escalation
  before update on public.listings
  for each row execute procedure public.prevent_listing_field_escalation();

-- INSERT guard (defense in depth): even if an old permissive INSERT
-- policy with an unknown name survives on the live DB, a non-admin
-- can never insert an already-approved / already-verified listing.
-- Admins are exempt (bulk import inserts pending anyway).
create or replace function public.prevent_listing_insert_escalation()
returns trigger as $$
begin
  if not public.is_admin_or_above() then
    if NEW.status is distinct from 'pending'
      or NEW.is_verified is true then
      raise exception 'လုပ်ငန်းအသစ် အတည်ပြုပြီးသား အဖြစ် တင်လို့မရပါ — Admin စစ်ဆေးပြီးမှ ပေါ်မည်';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_listing_insert_escalation on public.listings;
create trigger prevent_listing_insert_escalation
  before insert on public.listings
  for each row execute procedure public.prevent_listing_insert_escalation();

-- ============================================================
-- 7. user_points — no forging other users' points
--    (SECURITY DEFINER point triggers bypass RLS, so they keep
--    working; only direct client inserts are restricted.)
-- ============================================================
drop policy if exists "Anyone insert points" on public.user_points;
create policy "Users insert own points" on public.user_points
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- 8. NOTICES — non-moderators may insert ONLY as 'pending'
-- ============================================================
drop policy if exists "Anyone can submit notice" on public.notices;
create policy "Anyone can submit notice" on public.notices
  for insert with check (
    status = 'pending' or public.is_admin_or_above()
  );

-- ============================================================
-- 9. REPORTS table + listing_reports view
--    NOTE: status is 'reviewed' (not 'resolved') — matches the
--    CHECK below and AdminReportsPage. Community code inserts
--    with target_type 'listing' | 'lost_found' | 'job' |
--    'rental' | 'tutoring' | 'post'; 'note' is the optional
--    free-text detail AdminReportsPage renders.
-- ============================================================
create table if not exists public.reports (
  id uuid default uuid_generate_v4() primary key,
  target_type text not null,
  target_id uuid,
  reason text,
  note text,
  reporter_id uuid references public.profiles(id) on delete set null,
  status text default 'pending'
    check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index if not exists reports_target_idx on public.reports(target_type, target_id);
create index if not exists reports_status_idx on public.reports(status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Anyone can report" on public.reports;
create policy "Anyone can report" on public.reports
  for insert with check (reporter_id is null or reporter_id = auth.uid());
drop policy if exists "Admins manage reports" on public.reports;
create policy "Admins manage reports" on public.reports
  for select using (public.is_admin_or_above());
drop policy if exists "Admins update reports" on public.reports;
create policy "Admins update reports" on public.reports
  for update using (public.is_admin_or_above())
  with check (public.is_admin_or_above());
drop policy if exists "Admins delete reports" on public.reports;
create policy "Admins delete reports" on public.reports
  for delete using (public.is_admin_or_above());

-- AdminPage counts this view per listing (listing_id alias is
-- what the page filters on). A view has no RLS of its own —
-- the underlying reports policies apply.
--
-- LIVE-DB GOTCHA (2026-11-03): the live database already had a
-- TABLE named listing_reports (created by an earlier hand-run SQL
-- file), and CREATE OR REPLACE VIEW fails on a table with
-- ERROR 42809 "listing_reports is not a view". So first rename
-- any such table aside (its rows are preserved under the backup
-- name — nothing in v0.9.0 ever wrote to it, the code only reads
-- this name), then create the view. Idempotent on re-run: once
-- the view exists, the rename block does nothing.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'listing_reports' and c.relkind = 'r'
  ) then
    alter table public.listing_reports rename to listing_reports_table_backup;
  end if;
end $$;

drop view if exists public.listing_reports;
create view public.listing_reports as
  select *, target_id as listing_id
  from public.reports
  where target_type = 'listing';

-- ============================================================
-- 10. jobs.post_type ('offer' | 'seeker', JobBoardPage)
-- ============================================================
alter table public.jobs add column if not exists post_type text default 'offer';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_post_type_check' and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_post_type_check
      check (post_type in ('offer', 'seeker'));
  end if;
end $$;

-- ============================================================
-- 11. POINTS TRIGGERS (mirror handle_review_created /
--     handle_listing_submitted style)
--     - listing approved +20 ALREADY EXISTS in
--       handle_listing_submitted (final.sql) — NOT duplicated.
--     - claim approved +30: handle_claim_approved EXISTS
--       (final.sql:359) but only verifies ownership — it does
--       NOT award points, so a separate points trigger is added.
--     - RSVP +2: new (fires on INSERT only, so an upsert
--       conflict update can never double-award).
-- ============================================================
create or replace function public.handle_rsvp_created()
returns trigger as $$
begin
  if NEW.status in ('going', 'interested') then
    insert into public.user_points(user_id, action, points, ref_table, ref_id)
    values (NEW.user_id, 'rsvp_going', 2, 'event_rsvps', NEW.id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_rsvp_created on public.event_rsvps;
create trigger on_rsvp_created
  after insert on public.event_rsvps
  for each row execute procedure public.handle_rsvp_created();

create or replace function public.handle_claim_points()
returns trigger as $$
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    insert into public.user_points(user_id, action, points, ref_table, ref_id)
    values (NEW.user_id, 'claim_approved', 30, 'listing_claims', NEW.id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_claim_points on public.listing_claims;
create trigger on_claim_points
  after update on public.listing_claims
  for each row execute procedure public.handle_claim_points();

-- ============================================================
-- 12. NOTIFICATIONS TABLE + TRIGGERS
--     (mirrors supabase-schema-fix.sql; adds listing_id column.
--     NotificationsPage navigates on data.listing_id, so the
--     triggers put listing_id inside data jsonb AND in the
--     column. INSERT is restricted to the user's own rows —
--     no client code inserts notifications for others (the
--     triggers are SECURITY DEFINER and bypass RLS).
-- ============================================================
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  data jsonb default '{}',
  is_read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.notifications
  add column if not exists listing_id uuid references public.listings(id) on delete cascade;

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "System can insert notifications" on public.notifications;
create policy "Users insert own notifications" on public.notifications
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- Review on a listing → notify the listing owner.
create or replace function public.handle_review_notification()
returns trigger as $$
declare
  v_listing record;
  v_owner uuid;
begin
  select name, name_mm, owner_id, submitted_by
    into v_listing
    from public.listings where id = NEW.listing_id;
  if not found then
    return NEW;
  end if;
  v_owner := coalesce(v_listing.owner_id, v_listing.submitted_by);
  if v_owner is null or v_owner = NEW.user_id then
    return NEW;
  end if;
  insert into public.notifications (user_id, type, title, message, data, listing_id)
  values (
    v_owner,
    'review',
    coalesce(v_listing.name_mm, v_listing.name, 'လုပ်ငန်း'),
    'သင့်လုပ်ငန်းတွင် review အသစ် ရေးထားသည်',
    jsonb_build_object(
      'listing_id', NEW.listing_id,
      'listing_name', coalesce(v_listing.name_mm, v_listing.name),
      'review_id', NEW.id
    ),
    NEW.listing_id
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_notify on public.reviews;
create trigger on_review_notify
  after insert on public.reviews
  for each row execute procedure public.handle_review_notification();

-- Listing pending → approved → notify the submitter.
create or replace function public.handle_listing_approved_notification()
returns trigger as $$
begin
  if OLD.status = 'pending' and NEW.status = 'approved' and NEW.submitted_by is not null then
    insert into public.notifications (user_id, type, title, message, data, listing_id)
    values (
      NEW.submitted_by,
      'listing_approved',
      coalesce(NEW.name_mm, NEW.name, 'လုပ်ငန်း'),
      'သင့်လုပ်ငန်းကို အတည်ပြုပြီးပါပြီ',
      jsonb_build_object(
        'listing_id', NEW.id,
        'listing_name', coalesce(NEW.name_mm, NEW.name)
      ),
      NEW.id
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_listing_approved_notify on public.listings;
create trigger on_listing_approved_notify
  after update on public.listings
  for each row execute procedure public.handle_listing_approved_notification();

-- ============================================================
-- 13. REALTIME — add chat_messages + lost_found only if not
--     already members of the supabase_realtime publication
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'lost_found'
  ) then
    alter publication supabase_realtime add table public.lost_found;
  end if;
end $$;

-- ============================================================
-- 14. audit_logs — only admin/mod/super_admin may insert
--     (replaces the old WITH CHECK (true) policy)
-- ============================================================
drop policy if exists "Anyone can insert audit log" on public.audit_logs;
create policy "Admins can insert audit logs" on public.audit_logs
  for insert with check (public.is_admin_or_above());

-- ============================================================
-- 15. INTENTIONALLY UNCHANGED — guest reporting must keep working
--     fuel_reports / price_reports / power_cut_reports /
--     bus_departures keep their WITH CHECK (true) guest INSERT
--     policies (final.sql). This migration does not touch them.
-- ============================================================
