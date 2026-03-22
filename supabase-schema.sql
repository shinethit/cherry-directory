-- ============================================================
-- Cherry Directory v2 — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  role text default 'member' check (role in ('member', 'moderator', 'admin')),
  bio text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_mm text,
  icon text,
  color text default '#7c00b0',
  type text default 'directory' check (type in ('directory', 'news', 'event')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- DIRECTORY LISTINGS
-- ============================================================
create table listings (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_mm text,
  description text,
  description_mm text,
  category_id uuid references categories(id),
  business_type text,
  city text default 'Taunggyi',
  township text,
  ward text,
  address text,
  address_mm text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone_1 text,
  phone_2 text,
  viber text,
  telegram text,
  facebook text,
  website text,
  logo_url text,
  cover_url text,
  images text[] default '{}',
  hours jsonb,
  rating_avg numeric(3,2) default 0,
  rating_count int default 0,
  view_count int default 0,
  is_verified boolean default false,
  is_featured boolean default false,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  owner_id uuid references profiles(id),
  submitted_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- REVIEWS
-- ============================================================
create table reviews (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  is_approved boolean default true,
  created_at timestamptz default now(),
  unique(listing_id, user_id)
);

-- Auto-update listing rating
create or replace function update_listing_rating()
returns trigger as $$
begin
  update listings set
    rating_avg = (select avg(rating) from reviews where listing_id = coalesce(new.listing_id, old.listing_id) and is_approved = true),
    rating_count = (select count(*) from reviews where listing_id = coalesce(new.listing_id, old.listing_id) and is_approved = true)
  where id = coalesce(new.listing_id, old.listing_id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_change
  after insert or update or delete on reviews
  for each row execute procedure update_listing_rating();

-- ============================================================
-- NEWS & EVENTS
-- ============================================================
create table posts (
  id uuid default uuid_generate_v4() primary key,
  type text default 'news' check (type in ('news', 'event', 'announcement')),
  title text not null,
  title_mm text,
  slug text unique,
  content text,
  content_mm text,
  excerpt text,
  category_id uuid references categories(id),
  cover_url text,
  images text[] default '{}',
  event_start timestamptz,
  event_end timestamptz,
  event_location text,
  author_id uuid references profiles(id),
  view_count int default 0,
  reaction_count int default 0,
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  is_pinned boolean default false,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- REACTIONS (for posts + chat messages)
-- ============================================================
create table reactions (
  id uuid default uuid_generate_v4() primary key,
  target_type text check (target_type in ('post', 'chat_message', 'listing')),
  target_id uuid not null,
  user_id uuid references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(target_type, target_id, user_id, emoji)
);

-- ============================================================
-- PUBLIC CHAT
-- ============================================================
create table chat_rooms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  icon text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references chat_rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  guest_name text,
  content text not null,
  image_url text,
  reply_to uuid references chat_messages(id) on delete set null,
  is_pinned boolean default false,
  is_deleted boolean default false,
  created_at timestamptz default now()
);

-- Insert default chat room
insert into chat_rooms (name, description, icon) values
  ('ထောင်ကြီး 💬', 'တောင်ကြီးမြို့ ပြောရေးဆိုရေးနေရာ', '💬'),
  ('သတင်းနှင့် ဖြစ်ရပ်များ 📢', 'သတင်းနှင့် ဖြစ်ရပ်များ ဝေမျှနေရာ', '📢');

-- ============================================================
-- BOOKMARKS
-- ============================================================
create table bookmarks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  target_type text check (target_type in ('listing', 'post')),
  target_id uuid not null,
  created_at timestamptz default now(),
  unique(user_id, target_type, target_id)
);

-- ============================================================
-- SEED CATEGORIES
-- ============================================================
insert into categories (name, name_mm, icon, type, sort_order) values
  -- ── လုပ်ငန်းများ (Businesses) ──────────────────────────────
  ('Restaurant & Food',     'စားသောက်ဆိုင်',          '🍜', 'directory',  1),
  ('Hotel & Accommodation', 'တည်းခိုရေး',              '🏨', 'directory',  2),
  ('Hospital & Clinic',     'ဆေးရုံ/ကလင်းနစ်',         '🏥', 'directory',  3),
  ('Education & School',    'ကျောင်း/ပညာရေး',           '🎓', 'directory',  4),
  ('Shopping & Retail',     'ဈေးဝယ်/လက်လီရောင်းချ',    '🛍️', 'directory',  5),
  ('Finance & Banking',     'ဘဏ်/ငွေကြေး',             '🏦', 'directory',  6),
  ('Entertainment',         'ဖျော်ဖြေရေး',              '🎭', 'directory',  7),
  ('Beauty & Salon',        'အလှပြင်ဆိုင်',             '💄', 'directory',  8),
  ('Other Business',        'အခြား လုပ်ငန်းများ',       '🏢', 'directory',  9),

  -- ── ဝန်ဆောင်မှုများ (Services) ──────────────────────────────
  ('Tutor & Private Teacher','ကိုယ်ပိုင်ဆရာ/မ (Tutor)', '📚', 'directory', 20),
  ('Cleaning Service',       'သန့်ရှင်းရေး/အိမ်ရှင်း',  '🧹', 'directory', 21),
  ('Laundry Service',        'အဝတ်လျှော်ဝန်ဆောင်မှု',   '👕', 'directory', 22),
  ('Plumbing & Electric',    'ရေပိုက်/မီးပြင်ဝန်ဆောင်မှု','🔧', 'directory', 23),
  ('Construction & Repair',  'ဆောက်လုပ်ရေး/ပြုပြင်',    '🏗️', 'directory', 24),
  ('Delivery Service',       'ပို့ဆောင်ရေး Delivery',    '📦', 'directory', 25),
  ('Taxi & Transport',       'Taxi/ယာဉ်ငှားရမ်း',        '🚕', 'directory', 26),
  ('Other Service',          'အခြား ဝန်ဆောင်မှု',       '⚙️', 'directory', 29),

  -- ── ရောင်းဝယ်ရေး / Classifieds ──────────────────────────────
  ('Property Rent & Sale',   'အိမ်ငှား/အိမ်ရောင်း',     '🏠', 'directory', 30),
  ('Vehicle Sale',           'ကား/ဆိုင်ကယ် ရောင်းချ',   '🚗', 'directory', 31),
  ('Second Hand Items',      'ပစ္စည်းအသုံးအဆောင် ရောင်းဝယ်', '🔄', 'directory', 32),

  -- ── News/Events ──────────────────────────────────────────────
  ('City News',       'မြို့သတင်း',  '📰', 'news',  1),
  ('Event',           'ဖြစ်ရပ်',    '🎉', 'event', 1),
  ('Announcement',    'ကြေညာချက်', '📢', 'news',  2);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table reviews enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table chat_messages enable row level security;
alter table bookmarks enable row level security;

-- Profiles: public read, self write
create policy "Public profiles are viewable" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Listings: approved public, owner/admin can edit
create policy "Approved listings are public" on listings for select using (status = 'approved' or auth.uid() = submitted_by or auth.uid() = owner_id);
create policy "Authenticated can submit" on listings for insert with check (auth.uid() is not null);
create policy "Owner can update" on listings for update using (auth.uid() = submitted_by or auth.uid() = owner_id);

-- Posts: published public
create policy "Published posts are public" on posts for select using (status = 'published');
create policy "Admins can manage posts" on posts for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);

-- Reviews: public read, auth write
create policy "Reviews are public" on reviews for select using (is_approved = true);
create policy "Auth users can review" on reviews for insert with check (auth.uid() = user_id);
create policy "Users can edit own review" on reviews for update using (auth.uid() = user_id);

-- Chat: public read, auth write (with guest name fallback handled app-side)
create policy "Chat messages are public" on chat_messages for select using (is_deleted = false);
create policy "Anyone can chat" on chat_messages for insert with check (true);

-- Reactions: public read, insert for auth
create policy "Reactions are public" on reactions for select using (true);
create policy "Auth users can react" on reactions for insert with check (auth.uid() = user_id);
create policy "Users delete own reaction" on reactions for delete using (auth.uid() = user_id);

-- Bookmarks: self only
create policy "Users see own bookmarks" on bookmarks for select using (auth.uid() = user_id);
create policy "Users manage own bookmarks" on bookmarks for all using (auth.uid() = user_id);

-- ============================================================
-- LISTING CLAIMS (Business Claim feature)
-- ============================================================
create table listing_claims (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  contact_phone text,
  note text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(listing_id, user_id)
);

alter table listing_claims enable row level security;
create policy "Users see own claims" on listing_claims for select using (auth.uid() = user_id);
create policy "Auth users can claim" on listing_claims for insert with check (auth.uid() = user_id);
create policy "Admins see all claims" on listing_claims for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);

-- ============================================================
-- PUSH SUBSCRIPTIONS (Web Push notifications)
-- ============================================================
create table push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "Users manage own subscriptions" on push_subscriptions for all using (auth.uid() = user_id);

-- ============================================================
-- Add whatsapp column to listings
-- ============================================================
alter table listings add column if not exists whatsapp text;

-- ============================================================
-- Add lat/lng to listings (for map embed)
-- ============================================================
-- Already included above: latitude, longitude columns

-- ============================================================
-- AUTO-VERIFY trigger: when a claim is approved via DB update,
-- automatically set listing.is_verified = true and owner_id
-- ============================================================
create or replace function handle_claim_approved()
returns trigger as $$
begin
  if NEW.status = 'approved' and OLD.status != 'approved' then
    update listings
    set
      is_verified = true,
      owner_id    = NEW.user_id,
      updated_at  = now()
    where id = NEW.listing_id;
  end if;

  -- If claim is rejected/revoked after being approved, remove badge
  if NEW.status = 'rejected' and OLD.status = 'approved' then
    -- Only remove if no other approved claim exists
    if not exists (
      select 1 from listing_claims
      where listing_id = NEW.listing_id
        and status = 'approved'
        and id != NEW.id
    ) then
      update listings
      set is_verified = false, owner_id = null, updated_at = now()
      where id = NEW.listing_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_claim_status_change
  after update on listing_claims
  for each row execute procedure handle_claim_approved();

-- ============================================================
-- RLS: allow owners to update their own verified listing info
-- ============================================================
create policy "Verified owner can update their listing"
  on listings for update
  using (auth.uid() = owner_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete set null,
  action text not null,           -- 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'bulk_import'
  target_table text not null,     -- 'listings' | 'posts' | 'profiles' | 'listing_claims'
  target_id uuid,
  target_name text,               -- human-readable label
  changes jsonb,                  -- { field: { before, after } }
  meta jsonb,                     -- extra context (ip, batch_id, row_count, etc.)
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;
create policy "Admins can view audit logs" on audit_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);
create policy "Anyone can insert audit log" on audit_logs for insert with check (true);

create index audit_logs_target_idx on audit_logs(target_table, target_id);
create index audit_logs_user_idx   on audit_logs(user_id);
create index audit_logs_time_idx   on audit_logs(created_at desc);

-- ============================================================
-- MENU ITEMS (for listings with menus / price lists)
-- ============================================================
create table menu_categories (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  name text not null,
  name_mm text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  name_mm text,
  description text,
  price numeric(10,0),            -- price in MMK
  price_max numeric(10,0),        -- for ranges
  image_url text,
  is_available boolean default true,
  is_featured boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table menu_categories enable row level security;
alter table menu_items enable row level security;

-- Public read
create policy "Menu categories are public" on menu_categories for select using (true);
create policy "Menu items are public" on menu_items for select using (true);

-- Owner / admin can manage
create policy "Owner can manage menu categories" on menu_categories for all using (
  exists (select 1 from listings where id = listing_id and (owner_id = auth.uid() or submitted_by = auth.uid()))
  or exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Owner can manage menu items" on menu_items for all using (
  exists (select 1 from listings where id = listing_id and (owner_id = auth.uid() or submitted_by = auth.uid()))
  or exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- BULK IMPORT LOG
-- ============================================================
create table bulk_imports (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id),
  file_name text,
  row_total int default 0,
  row_success int default 0,
  row_failed int default 0,
  errors jsonb default '[]',
  status text default 'processing' check (status in ('processing','done','failed')),
  created_at timestamptz default now()
);

alter table bulk_imports enable row level security;
create policy "Admins view bulk imports" on bulk_imports for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- EVENT RSVP
-- ============================================================
create table event_rsvps (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text default 'going' check (status in ('going', 'interested', 'not_going')),
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table event_rsvps enable row level security;
create policy "RSVPs are public" on event_rsvps for select using (true);
create policy "Auth users can RSVP" on event_rsvps for all using (auth.uid() = user_id);

-- Index for calendar queries (filter by month)
create index posts_event_start_idx on posts(event_start) where type = 'event' and status = 'published';

-- ============================================================
-- USER ACTIVITY & POINTS
-- ============================================================
alter table profiles add column if not exists nickname text unique;
alter table profiles add column if not exists points int default 0;
alter table profiles add column if not exists last_seen timestamptz default now();
alter table profiles add column if not exists is_online boolean default false;
alter table profiles add column if not exists total_reviews int default 0;
alter table profiles add column if not exists total_listings int default 0;
alter table profiles add column if not exists total_rsvps int default 0;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists joined_at timestamptz default now();

-- Points ledger (audit trail for points)
create table user_points (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  action text not null,       -- 'write_review' | 'submit_listing' | 'chat_message' | 'rsvp' | 'claim_approved' | 'listing_approved'
  points int not null,        -- positive = earned, negative = deducted
  ref_table text,             -- 'reviews' | 'listings' | 'chat_messages'
  ref_id uuid,
  note text,
  created_at timestamptz default now()
);

alter table user_points enable row level security;
create policy "Users see own points" on user_points for select using (auth.uid() = user_id);
create policy "Anyone insert points" on user_points for insert with check (true);

create index user_points_user_idx on user_points(user_id);
create index user_points_time_idx on user_points(created_at desc);

-- Point values reference (informational)
-- write_review       = +5
-- submit_listing     = +10
-- listing_approved   = +20
-- rsvp_going         = +2
-- chat_message       = +1  (max 10/day to prevent spam)
-- claim_approved     = +30
-- helpful_review     = +3  (future: upvote)

-- Auto-update profile points total from ledger
create or replace function sync_user_points()
returns trigger as $$
begin
  update profiles
  set points = (select coalesce(sum(points), 0) from user_points where user_id = coalesce(NEW.user_id, OLD.user_id))
  where id = coalesce(NEW.user_id, OLD.user_id);
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_points_change
  after insert or update or delete on user_points
  for each row execute procedure sync_user_points();

-- Auto-bump review counter on profile
create or replace function handle_review_created()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set total_reviews = total_reviews + 1 where id = NEW.user_id;
    insert into user_points(user_id, action, points, ref_table, ref_id)
    values (NEW.user_id, 'write_review', 5, 'reviews', NEW.id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on reviews
  for each row execute procedure handle_review_created();

-- Auto-bump listing counter
create or replace function handle_listing_submitted()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.submitted_by is not null then
    update profiles set total_listings = total_listings + 1 where id = NEW.submitted_by;
    insert into user_points(user_id, action, points, ref_table, ref_id)
    values (NEW.submitted_by, 'submit_listing', 10, 'listings', NEW.id);
  end if;
  -- Bonus when listing gets approved
  if TG_OP = 'UPDATE' and NEW.status = 'approved' and OLD.status != 'approved' and NEW.submitted_by is not null then
    insert into user_points(user_id, action, points, ref_table, ref_id)
    values (NEW.submitted_by, 'listing_approved', 20, 'listings', NEW.id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_listing_change
  after insert or update on listings
  for each row execute procedure handle_listing_submitted();

-- ============================================================
-- USER SESSIONS / LAST SEEN
-- ============================================================
create table user_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  device text,
  ip_country text,
  started_at timestamptz default now(),
  last_ping timestamptz default now(),
  ended_at timestamptz
);

alter table user_sessions enable row level security;
create policy "Users see own sessions" on user_sessions for select using (auth.uid() = user_id);
create policy "Admins see all sessions" on user_sessions for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);
create policy "Anyone insert session" on user_sessions for insert with check (auth.uid() = user_id);
create policy "Users update own session" on user_sessions for update using (auth.uid() = user_id);

-- ============================================================
-- MONTHLY LEADERBOARD VIEW
-- Returns current-month points per user (recalculated live)
-- ============================================================
create or replace view monthly_leaderboard as
select
  p.id,
  p.full_name,
  p.nickname,
  p.avatar_url,
  p.role,
  p.last_seen,
  p.is_online,
  p.total_reviews,
  p.total_listings,
  coalesce(sum(up.points) filter (
    where date_trunc('month', up.created_at) = date_trunc('month', now())
  ), 0)::int as month_points,
  coalesce(count(r.id) filter (
    where date_trunc('month', r.created_at) = date_trunc('month', now())
  ), 0)::int as month_reviews,
  coalesce(count(l.id) filter (
    where date_trunc('month', l.created_at) = date_trunc('month', now())
      and l.status = 'approved'
  ), 0)::int as month_listings
from profiles p
left join user_points up  on up.user_id  = p.id
left join reviews r       on r.user_id   = p.id
left join listings l      on l.submitted_by = p.id
group by p.id;

-- No RLS needed on views — they inherit from underlying tables

-- ============================================================
-- LEADERBOARD VIEWS — 4 periods
-- ============================================================

-- Drop old view first
drop view if exists monthly_leaderboard;

-- Helper: aggregate points/reviews/listings for any interval
-- Used by all period views below

create or replace view leaderboard_month as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  coalesce(sum(up.points) filter (
    where up.created_at >= date_trunc('month', now())
  ), 0)::int as period_points,
  coalesce(count(distinct r.id) filter (
    where r.created_at >= date_trunc('month', now())
  ), 0)::int as period_reviews,
  coalesce(count(distinct l.id) filter (
    where l.created_at >= date_trunc('month', now())
      and l.status = 'approved'
  ), 0)::int as period_listings
from profiles p
left join user_points up on up.user_id = p.id
left join reviews r      on r.user_id  = p.id
left join listings l     on l.submitted_by = p.id
group by p.id;

create or replace view leaderboard_6month as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  coalesce(sum(up.points) filter (
    where up.created_at >= now() - interval '6 months'
  ), 0)::int as period_points,
  coalesce(count(distinct r.id) filter (
    where r.created_at >= now() - interval '6 months'
  ), 0)::int as period_reviews,
  coalesce(count(distinct l.id) filter (
    where l.created_at >= now() - interval '6 months'
      and l.status = 'approved'
  ), 0)::int as period_listings
from profiles p
left join user_points up on up.user_id = p.id
left join reviews r      on r.user_id  = p.id
left join listings l     on l.submitted_by = p.id
group by p.id;

create or replace view leaderboard_year as
select
  p.id, p.full_name, p.nickname, p.avatar_url,
  p.role, p.last_seen, p.is_online,
  p.total_reviews, p.total_listings,
  coalesce(sum(up.points) filter (
    where up.created_at >= date_trunc('year', now())
  ), 0)::int as period_points,
  coalesce(count(distinct r.id) filter (
    where r.created_at >= date_trunc('year', now())
  ), 0)::int as period_reviews,
  coalesce(count(distinct l.id) filter (
    where l.created_at >= date_trunc('year', now())
      and l.status = 'approved'
  ), 0)::int as period_listings
from profiles p
left join user_points up on up.user_id = p.id
left join reviews r      on r.user_id  = p.id
left join listings l     on l.submitted_by = p.id
group by p.id;

-- ============================================================
-- MARKET PRICES (Community-reported)
-- ============================================================
create table price_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_en text,
  category text not null,       -- 'grain' | 'oil' | 'vegetable' | 'meat' | 'fish' | 'fruit' | 'fuel' | 'other'
  subcategory text,             -- e.g. 'ဆန်' | 'ပဲ' | 'အုန်း' | 'ကြက်' | 'ဝက်' | 'ငါး'
  unit text not null,
  unit_en text,
  icon text default '🛒',
  sort_order int default 0,
  is_active boolean default true
);

insert into price_items (name, name_en, category, subcategory, unit, unit_en, icon, sort_order) values
  -- ဆန် / စီရသီ
  ('ဆန် (ဆောင်းကောင်းရင်း)',  'Rice (Hsaung Kaung)',  'grain', 'ဆန်', 'တင်း', 'tin',      '🌾', 1),
  ('ဆန် (ဧည့်မိတ္တူ)',         'Rice (Guest)',         'grain', 'ဆန်', 'တင်း', 'tin',      '🌾', 2),
  ('ဆန် (ထမင်း)',              'Rice (regular)',       'grain', 'ဆန်', 'တင်း', 'tin',      '🌾', 3),
  ('ဆန် (ရွှေဘို)',            'Rice (Shwebo)',        'grain', 'ဆန်', 'တင်း', 'tin',      '🌾', 4),
  -- ပဲ / စီရသီ
  ('ပဲ (မြေပဲ)',               'Groundnut',           'grain', 'ပဲ',  'ပိဿာ','viss',     '🥜', 5),
  ('ပဲ (ပဲတီစိမ်း)',           'Mung bean',           'grain', 'ပဲ',  'ပိဿာ','viss',     '🫘', 6),
  -- ဆီ
  ('ဆီ (အုန်းဆီ)',             'Coconut oil',         'oil',   'အုန်းဆီ', 'ဘူး', 'can',   '🫙', 7),
  ('ဆီ (ပဲဆီ)',                'Soy oil',             'oil',   'ပဲဆီ',   'ဘူး', 'can',   '🫙', 8),
  ('ဆီ (နှမ်းဆီ)',             'Sesame oil',          'oil',   'နှမ်းဆီ','ပုလင်း','bottle','🫙', 9),
  -- ကြက်သွန် / ဟင်းသီးဟင်းရွက်
  ('ကြက်သွန်နီ',              'Onion',               'vegetable','ကြက်သွန်','ပိဿာ','viss','🧅', 10),
  ('ကြက်သွန်ဖြူ',             'Garlic',              'vegetable','ကြက်သွန်','ပိဿာ','viss','🧄', 11),
  ('ငရုတ်သီး (စိမ်း)',        'Green chili',         'vegetable','ငရုတ်',  'ပိဿာ','viss','🌶️',12),
  ('ငရုတ်ကောင်း',             'Black pepper',        'vegetable','ငရုတ်',  'ပိဿာ','viss','🫙', 13),
  -- အသား
  ('ကြက်သား',                 'Chicken',             'meat',  'ကြက်',  'ပိဿာ', 'viss',  '🍗', 14),
  ('ဝက်သား',                  'Pork',                'meat',  'ဝက်',   'ပိဿာ', 'viss',  '🥩', 15),
  ('အမဲသား',                  'Beef',                'meat',  'အမဲ',   'ပိဿာ', 'viss',  '🥩', 16),
  -- ငါး
  ('ငါး (ကျောင်းငါး)',        'Ngakyaung fish',      'fish',  'ငါး',   'ပိဿာ', 'viss',  '🐟', 17),
  ('ငါး (ရေချိုငါး)',         'Freshwater fish',     'fish',  'ငါး',   'ပိဿာ', 'viss',  '🐟', 18),
  ('ပုဇွန်',                  'Shrimp',              'fish',  'ပုဇွန်','ပိဿာ', 'viss',  '🦐', 19),
  -- ဓာတ်ဆီ
  ('ဓာတ်ဆီ (92)',             'Petrol 92',           'fuel',  'ဓာတ်ဆီ','လီတာ', 'liter', '⛽', 20),
  ('ဒီဇယ်',                   'Diesel',              'fuel',  'ဒီဇယ်', 'လီတာ', 'liter', '🚛', 21),
  ('LPG ဂတ်',                 'LPG Gas',             'fuel',  'LPG',   'ဘူး',  'cylinder','🔥',22);

create table price_reports (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references price_items(id) on delete cascade,
  price numeric(10,0) not null,       -- MMK
  market text,                         -- 'ပြည်သူ့ဈေး' | 'ပင်လုံဈေး' | etc
  reporter_id uuid references profiles(id) on delete set null,
  reporter_ip text,                    -- for guest rate limiting
  guest_name text,
  notes text,
  is_verified boolean default true,    -- false if outlier (auto-detected)
  reported_at timestamptz default now()
);

-- View: latest median price per item (last 48h reports, exclude outliers)
create or replace view current_prices as
with recent as (
  select
    item_id,
    market,
    price,
    reported_at,
    row_number() over (partition by item_id order by reported_at desc) as rn
  from price_reports
  where is_verified = true
    and reported_at > now() - interval '48 hours'
),
stats as (
  select
    item_id,
    percentile_cont(0.5) within group (order by price)::numeric(10,0) as median_price,
    round(avg(price))::numeric(10,0)                                   as avg_price,
    min(price)                                                         as min_price,
    max(price)                                                         as max_price,
    count(*)                                                           as report_count,
    max(reported_at)                                                   as last_reported
  from recent
  group by item_id
)
select
  pi.id, pi.name, pi.name_en, pi.category, pi.subcategory, pi.unit, pi.unit_en, pi.icon, pi.sort_order,
  s.median_price, s.avg_price, s.min_price, s.max_price,
  s.report_count, s.last_reported
from price_items pi
left join stats s on s.item_id = pi.id
where pi.is_active = true
order by pi.sort_order;

-- View: price trend (last 7 days, daily median)
create or replace view price_trend_7d as
select
  item_id,
  date_trunc('day', reported_at)::date as day,
  percentile_cont(0.5) within group (order by price)::numeric(10,0) as median_price,
  count(*) as reports
from price_reports
where is_verified = true
  and reported_at > now() - interval '7 days'
group by item_id, date_trunc('day', reported_at)::date
order by item_id, day;

-- ============================================================
-- POWER CUT REPORTS (Community-reported)
-- ============================================================
create table power_areas (
  id uuid default uuid_generate_v4() primary key,
  name text not null,           -- 'ဗိုလ်ချုပ်ရပ်ကွက်'
  township text,                -- 'Taunggyi'
  sort_order int default 0
);

insert into power_areas (name, township, sort_order) values
  ('ဗိုလ်ချုပ်ရပ်ကွက်',       'Taunggyi', 1),
  ('ကန်တော်ကြီးရပ်ကွက်',      'Taunggyi', 2),
  ('မင်းဘူးရပ်ကွက်',           'Taunggyi', 3),
  ('ဆောင်းပါဝါရပ်ကွက်',       'Taunggyi', 4),
  ('မြို့သစ်ရပ်ကွက်',          'Taunggyi', 5),
  ('ပင်လုံလမ်းမကြီး',          'Taunggyi', 6),
  ('ကလော',                     'Kalaw',    7),
  ('ပင်တရားကြီး',              'Kalaw',    8),
  ('ပင်းတယ',                   'Pindaya',  9),
  ('ဉ္ပင်းဦး',                  'Nyaungshwe', 10);

create table power_cut_reports (
  id uuid default uuid_generate_v4() primary key,
  area_id uuid references power_areas(id) on delete cascade,
  status text not null check (status in ('cut', 'restored')),
  reporter_id uuid references profiles(id) on delete set null,
  reporter_ip text,
  guest_name text,
  notes text,
  reported_at timestamptz default now()
);

-- View: current power status per area (based on latest report)
create or replace view current_power_status as
with latest as (
  select distinct on (area_id)
    area_id, status, reporter_id, guest_name, notes, reported_at,
    row_number() over (partition by area_id order by reported_at desc) as rn
  from power_cut_reports
  where reported_at > now() - interval '12 hours'
  order by area_id, reported_at desc
),
confirmations as (
  select
    area_id,
    count(*) filter (where status = 'cut')      as cut_count,
    count(*) filter (where status = 'restored') as restored_count,
    max(reported_at)                             as last_report
  from power_cut_reports
  where reported_at > now() - interval '4 hours'
  group by area_id
)
select
  pa.id, pa.name, pa.township, pa.sort_order,
  coalesce(l.status, 'unknown')            as current_status,
  coalesce(c.cut_count, 0)                 as cut_confirmations,
  coalesce(c.restored_count, 0)            as restored_confirmations,
  l.reported_at                            as last_reported,
  l.notes
from power_areas pa
left join latest       l on l.area_id = pa.id
left join confirmations c on c.area_id = pa.id
order by pa.sort_order;

-- View: power cut history (last 7 days per area)
create or replace view power_cut_history as
select
  area_id,
  status,
  reported_at,
  notes
from power_cut_reports
where reported_at > now() - interval '7 days'
order by area_id, reported_at desc;

-- RLS
alter table price_reports enable row level security;
alter table power_cut_reports enable row level security;

-- Anyone can read (including guest, via view)
create policy "Price reports readable" on price_reports for select using (true);
create policy "Anyone can submit price" on price_reports for insert with check (true);

create policy "Power reports readable" on power_cut_reports for select using (true);
create policy "Anyone can report power" on power_cut_reports for insert with check (true);

-- Admin can update/delete reports (for moderation)
create policy "Admin manages price reports" on price_reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin manages power reports" on power_cut_reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- Indexes for performance
create index price_reports_item_time_idx on price_reports(item_id, reported_at desc);
create index power_reports_area_time_idx on power_cut_reports(area_id, reported_at desc);
create index price_reports_ip_idx        on price_reports(reporter_ip, reported_at desc);
create index power_reports_ip_idx        on power_cut_reports(reporter_ip, reported_at desc);

-- ============================================================
-- FUEL AVAILABILITY (Gas Station status)
-- ============================================================
create table fuel_stations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_mm text,
  address text,
  township text default 'Taunggyi',
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone text,
  sort_order int default 0,
  is_active boolean default true
);

insert into fuel_stations (name, name_mm, address, township, sort_order) values
  ('ဆိုင်မြောင်းဓာတ်ဆီဆိုင်',    null, 'ပင်လုံလမ်း', 'Taunggyi', 1),
  ('မြို့မဓာတ်ဆီဆိုင်',           null, 'ဗိုလ်ချုပ်လမ်း', 'Taunggyi', 2),
  ('Asia ဓာတ်ဆီဆိုင်',           null, 'မင်းဘူးလမ်း', 'Taunggyi', 3),
  ('Grand ဓာတ်ဆီဆိုင်',          null, 'ကလောလမ်း', 'Taunggyi', 4),
  ('ကလော ဓာတ်ဆီဆိုင်',          null, 'ကလောမြို့မ', 'Kalaw', 5);

create table fuel_types (
  id text primary key,   -- 'petrol92' | 'petrol95' | 'diesel' | 'lpg'
  name text not null,
  name_mm text,
  icon text
);
insert into fuel_types values
  ('petrol92', 'Petrol 92',   'ဓာတ်ဆီ (92)',   '⛽'),
  ('petrol95', 'Petrol 95',   'ဓာတ်ဆီ (95)',   '⛽'),
  ('diesel',   'Diesel',      'ဒီဇယ်',          '🚛'),
  ('lpg',      'LPG Gas',     'LPG ဂတ်',        '🔥');

create table fuel_reports (
  id uuid default uuid_generate_v4() primary key,
  station_id uuid references fuel_stations(id) on delete cascade,
  fuel_type text references fuel_types(id),
  status text not null check (status in ('available', 'unavailable', 'limited')),
  queue_level text check (queue_level in ('none','short','long','very_long')),
  price numeric(8,0),              -- current price at this station
  reporter_id uuid references profiles(id) on delete set null,
  reporter_ip text,
  notes text,
  reported_at timestamptz default now()
);

create or replace view current_fuel_status as
with latest as (
  select distinct on (station_id, fuel_type)
    station_id, fuel_type, status, queue_level, price, notes, reported_at
  from fuel_reports
  where reported_at > now() - interval '6 hours'
  order by station_id, fuel_type, reported_at desc
)
select
  fs.id as station_id, fs.name, fs.name_mm, fs.township, fs.address,
  ft.id as fuel_id, ft.name as fuel_name, ft.name_mm as fuel_name_mm, ft.icon,
  coalesce(l.status, 'unknown') as status,
  l.queue_level, l.price, l.notes, l.reported_at
from fuel_stations fs
cross join fuel_types ft
left join latest l on l.station_id = fs.id and l.fuel_type = ft.id
where fs.is_active = true
order by fs.sort_order, ft.id;

alter table fuel_reports enable row level security;
create policy "Fuel reports public" on fuel_reports for select using (true);
create policy "Anyone can report fuel" on fuel_reports for insert with check (true);

-- ============================================================
-- LOST & FOUND
-- ============================================================
create table lost_found (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('lost','found')),   -- 'lost' | 'found'
  category text not null check (category in ('person','child','animal','item')),
  title text not null,
  title_mm text,
  description text,
  description_mm text,
  location text,
  location_mm text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  contact_phone text,
  contact_name text,
  images text[] default '{}',
  reward text,                  -- reward description if any
  status text default 'active' check (status in ('active','resolved','expired')),
  poster_id uuid references profiles(id) on delete set null,
  poster_name text,             -- for guest posts
  is_urgent boolean default false,
  reported_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
);

alter table lost_found enable row level security;
create policy "Lost found public" on lost_found for select using (status != 'expired');
create policy "Anyone can post" on lost_found for insert with check (true);
create policy "Poster can update" on lost_found for update using (
  auth.uid() = poster_id or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

create index lost_found_type_idx on lost_found(type, status, reported_at desc);
create index lost_found_cat_idx  on lost_found(category, status);

-- ============================================================
-- JOB BOARD
-- ============================================================
create table jobs (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  title_mm text,
  company text,
  company_mm text,
  description text,
  description_mm text,
  type text default 'fulltime' check (type in ('fulltime','parttime','freelance','temporary')),
  salary_min numeric(10,0),
  salary_max numeric(10,0),
  salary_unit text default 'month' check (salary_unit in ('day','week','month')),
  location text,
  location_mm text,
  contact_phone text,
  contact_name text,
  contact_fb text,
  requirements text,
  requirements_mm text,
  category text,              -- 'restaurant' | 'retail' | 'driver' | 'office' | 'construction' | 'other'
  poster_id uuid references profiles(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,  -- linked to business
  status text default 'active' check (status in ('active','filled','expired')),
  is_urgent boolean default false,
  view_count int default 0,
  posted_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
);

alter table jobs enable row level security;
create policy "Jobs are public" on jobs for select using (status = 'active');
create policy "Auth can post jobs" on jobs for insert with check (auth.uid() = poster_id);
create policy "Poster can manage" on jobs for update using (
  auth.uid() = poster_id or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

create index jobs_status_idx on jobs(status, posted_at desc);
create index jobs_cat_idx    on jobs(category, status);

-- ============================================================
-- COMMUNITY NOTICE BOARD
-- ============================================================
create table notices (
  id uuid default uuid_generate_v4() primary key,
  category text not null check (category in (
    'health','vaccination','cleanup','water','electricity','traffic','community','government','emergency','other'
  )),
  title text not null,
  title_mm text,
  content text,
  content_mm text,
  ward text,
  township text default 'Taunggyi',
  poster_id uuid references profiles(id) on delete set null,
  poster_name text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  is_pinned boolean default false,
  is_urgent boolean default false,
  view_count int default 0,
  posted_at timestamptz default now(),
  expires_at timestamptz default now() + interval '14 days'
);

alter table notices enable row level security;
create policy "Approved notices public" on notices for select using (status = 'approved');
create policy "Anyone can submit notice" on notices for insert with check (true);
create policy "Admin manages notices" on notices for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- BUS / TRANSPORT (community-reported departure times)
-- ============================================================
create table bus_routes (
  id uuid default uuid_generate_v4() primary key,
  from_city text not null,
  to_city text not null,
  operator text,           -- 'JJ Express' etc
  type text default 'bus' check (type in ('bus','van','taxi','train')),
  normal_fare numeric(8,0),
  duration_hours numeric(4,1),
  is_active boolean default true,
  sort_order int default 0
);

insert into bus_routes (from_city, to_city, operator, type, normal_fare, duration_hours, sort_order) values
  ('Taunggyi', 'Yangon',    'JJ Express',   'bus', 25000, 12,   1),
  ('Taunggyi', 'Yangon',    'Elite Express','bus', 22000, 12,   2),
  ('Taunggyi', 'Mandalay',  'JJ Express',   'bus', 15000, 8,    3),
  ('Taunggyi', 'Kalaw',     'Local Van',    'van', 3000,  1.5,  4),
  ('Taunggyi', 'Pindaya',   'Local Van',    'van', 4000,  2,    5),
  ('Taunggyi', 'Nyaungshwe','Local Van',    'van', 5000,  2.5,  6),
  ('Taunggyi', 'Lashio',    'Highway Bus',  'bus', 12000, 6,    7),
  ('Kalaw',    'Yangon',    'JJ Express',   'bus', 22000, 11,   8);

create table bus_departures (
  id uuid default uuid_generate_v4() primary key,
  route_id uuid references bus_routes(id) on delete cascade,
  departure_time time not null,
  departure_date date not null default current_date,
  seats_available text check (seats_available in ('many','few','full','unknown')) default 'unknown',
  actual_fare numeric(8,0),
  notes text,
  reporter_id uuid references profiles(id) on delete set null,
  reporter_ip text,
  reported_at timestamptz default now()
);

alter table bus_departures enable row level security;
create policy "Departures public" on bus_departures for select using (departure_date >= current_date - 1);
create policy "Anyone report departure" on bus_departures for insert with check (true);

create index bus_dep_route_date_idx on bus_departures(route_id, departure_date, departure_time);

-- ============================================================
-- WEATHER / FLOOD ALERTS
-- ============================================================
create table weather_alerts (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('rain','flood','landslide','drought','fog','storm','inle_level','road_block')),
  severity text default 'info' check (severity in ('info','warning','danger')),
  title text not null,
  title_mm text,
  content text,
  content_mm text,
  location text,
  inle_level_cm numeric(6,1),   -- for Inle Lake water level reports
  source text,                   -- 'admin' | 'community' | 'DMH'
  reporter_id uuid references profiles(id) on delete set null,
  status text default 'active' check (status in ('active','resolved','expired')),
  posted_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

alter table weather_alerts enable row level security;
create policy "Weather alerts public" on weather_alerts for select using (status = 'active');
create policy "Anyone can report weather" on weather_alerts for insert with check (true);
create policy "Admin manages alerts" on weather_alerts for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- DONATION / FUNDRAISING
-- ============================================================
create table donations (
  id uuid default uuid_generate_v4() primary key,
  category text not null check (category in ('school','monastery','health','disaster','community','animal','other')),
  title text not null,
  title_mm text,
  description text,
  description_mm text,
  target_amount numeric(12,0),
  collected_amount numeric(12,0) default 0,
  images text[] default '{}',
  contact_name text,
  contact_phone text,
  contact_fb text,
  bank_name text,
  bank_account text,
  bank_holder text,
  kbz_pay text,
  wave_pay text,
  organizer_id uuid references profiles(id) on delete set null,
  status text default 'active' check (status in ('active','completed','cancelled')),
  is_verified boolean default false,
  is_urgent boolean default false,
  posted_at timestamptz default now(),
  deadline timestamptz
);

alter table donations enable row level security;
create policy "Donations public" on donations for select using (status = 'active');
create policy "Auth can create donations" on donations for insert with check (auth.uid() = organizer_id);
create policy "Organizer can update" on donations for update using (
  auth.uid() = organizer_id or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- TOUR GUIDE / TREKKING
-- ============================================================
create table tour_guides (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_mm text,
  bio text,
  bio_mm text,
  languages text[] default '{"Myanmar","English"}',
  specialties text[] default '{}',   -- 'trekking' | 'inle' | 'kayaking' | 'cycling' | 'birding'
  base_location text default 'Kalaw',
  photo_url text,
  phone text,
  facebook text,
  email text,
  price_per_day numeric(10,0),
  price_per_person numeric(10,0),
  price_currency text default 'USD',
  min_people int default 1,
  max_people int default 10,
  rating_avg numeric(3,2) default 0,
  rating_count int default 0,
  is_licensed boolean default false,
  is_verified boolean default false,
  guide_id uuid references profiles(id) on delete set null,
  status text default 'active' check (status in ('active','inactive')),
  posted_at timestamptz default now()
);

create table tour_packages (
  id uuid default uuid_generate_v4() primary key,
  guide_id uuid references tour_guides(id) on delete cascade,
  name text not null,
  name_mm text,
  description text,
  description_mm text,
  duration_days int default 1,
  type text check (type in ('trekking','boat','cycling','cultural','day_trip','multi_day')),
  start_location text,
  end_location text,
  difficulty text check (difficulty in ('easy','moderate','hard')),
  includes text,    -- 'Meals, Transport, Guide'
  price_usd numeric(8,0),
  price_mmk numeric(10,0),
  images text[] default '{}',
  is_active boolean default true
);

create table tour_reviews (
  id uuid default uuid_generate_v4() primary key,
  guide_id uuid references tour_guides(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  rating int check (rating between 1 and 5),
  comment text,
  travel_date date,
  created_at timestamptz default now()
);

-- Auto-update guide rating
create or replace function update_guide_rating() returns trigger as $$
begin
  update tour_guides set
    rating_avg   = (select avg(rating) from tour_reviews where guide_id = coalesce(NEW.guide_id, OLD.guide_id)),
    rating_count = (select count(*) from tour_reviews where guide_id = coalesce(NEW.guide_id, OLD.guide_id))
  where id = coalesce(NEW.guide_id, OLD.guide_id);
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_tour_review
  after insert or update or delete on tour_reviews
  for each row execute procedure update_guide_rating();

alter table tour_guides  enable row level security;
alter table tour_packages enable row level security;
alter table tour_reviews enable row level security;

create policy "Guides public"   on tour_guides   for select using (status = 'active');
create policy "Packages public" on tour_packages  for select using (is_active = true);
create policy "Reviews public"  on tour_reviews   for select using (true);
create policy "Auth review"     on tour_reviews   for insert with check (auth.uid() = user_id);
create policy "Guide can manage" on tour_guides   for all using (auth.uid() = guide_id);
create policy "Admin all"       on tour_guides    for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- PRICE SYSTEM UPGRADES
-- ============================================================

-- Allow user-added custom price items
alter table price_items add column if not exists is_custom boolean default false;
alter table price_items add column if not exists added_by uuid references profiles(id) on delete set null;
alter table price_items add column if not exists approved boolean default true;
alter table price_items add column if not exists subcategory text; -- admin approves custom items

-- Verified price snapshots (permanent historical record)
-- Admin/Mod marks a community report as "verified" → saved here forever
create table if not exists verified_prices (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references price_items(id) on delete cascade,
  price numeric(10,0) not null,
  market text,
  verified_by uuid references profiles(id),
  source_report_id uuid references price_reports(id) on delete set null,
  note text,
  verified_at timestamptz default now()
);

alter table verified_prices enable row level security;
create policy "Verified prices public" on verified_prices for select using (true);
create policy "Admin verifies prices" on verified_prices for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- Drop and recreate current_prices view with:
-- 1. % change vs previous week verified price
-- 2. Grouping category
-- 3. Custom items support
drop view if exists current_prices;

create or replace view current_prices as
with recent_reports as (
  select
    item_id,
    price,
    market,
    reported_at
  from price_reports
  where is_verified = true
    and reported_at > now() - interval '48 hours'
),
current_stats as (
  select
    item_id,
    percentile_cont(0.5) within group (order by price)::numeric(10,0) as median_price,
    round(avg(price))::numeric(10,0)  as avg_price,
    min(price)                        as min_price,
    max(price)                        as max_price,
    count(*)                          as report_count,
    max(reported_at)                  as last_reported
  from recent_reports
  group by item_id
),
-- Last verified price for % change comparison
last_verified as (
  select distinct on (item_id)
    item_id,
    price as verified_price,
    verified_at
  from verified_prices
  order by item_id, verified_at desc
),
-- Week-ago community median for trend
week_ago as (
  select
    item_id,
    percentile_cont(0.5) within group (order by price)::numeric(10,0) as week_median
  from price_reports
  where is_verified = true
    and reported_at between now() - interval '8 days' and now() - interval '6 days'
  group by item_id
)
select
  pi.id,
  pi.name,
  pi.name_en,
  pi.category,
  pi.unit,
  pi.unit_en,
  pi.icon,
  pi.sort_order,
  pi.is_custom,
  cs.median_price,
  cs.avg_price,
  cs.min_price,
  cs.max_price,
  cs.report_count,
  cs.last_reported,
  lv.verified_price,
  lv.verified_at,
  -- % change vs week-ago community median
  case
    when wa.week_median > 0 and cs.median_price is not null
    then round(((cs.median_price - wa.week_median) / wa.week_median * 100)::numeric, 1)
    else null
  end as pct_change_week,
  -- % change vs last verified price
  case
    when lv.verified_price > 0 and cs.median_price is not null
    then round(((cs.median_price - lv.verified_price) / lv.verified_price * 100)::numeric, 1)
    else null
  end as pct_change_verified
from price_items pi
left join current_stats cs on cs.item_id = pi.id
left join last_verified  lv on lv.item_id = pi.id
left join week_ago       wa on wa.item_id = pi.id
where pi.is_active = true
  and (pi.is_custom = false or pi.approved = true)
order by pi.category, pi.sort_order, pi.name;

-- Price trend view (7-day daily median with % change)
drop view if exists price_trend_7d;
create or replace view price_trend_7d as
with daily as (
  select
    item_id,
    date_trunc('day', reported_at)::date as day,
    percentile_cont(0.5) within group (order by price)::numeric(10,0) as median_price,
    count(*) as reports
  from price_reports
  where is_verified = true
    and reported_at > now() - interval '8 days'
  group by item_id, date_trunc('day', reported_at)::date
)
select
  d.*,
  lag(d.median_price) over (partition by d.item_id order by d.day) as prev_day_price,
  case
    when lag(d.median_price) over (partition by d.item_id order by d.day) > 0
    then round(((d.median_price - lag(d.median_price) over (partition by d.item_id order by d.day))
         / lag(d.median_price) over (partition by d.item_id order by d.day) * 100)::numeric, 1)
    else null
  end as day_pct_change
from daily d
order by item_id, day;

-- ============================================================
-- AUTO-DELETE POLICIES (pg_cron — run in Supabase SQL editor)
-- ============================================================
-- NOTE: These require pg_cron extension. Enable in Supabase Dashboard > Database > Extensions
-- Then run these in SQL editor to schedule:
--
-- select cron.schedule('delete-old-chat', '0 3 * * *',
--   $$delete from chat_messages where created_at < now() - interval '6 months'$$
-- );
--
-- select cron.schedule('delete-old-price-reports', '0 4 * * *',
--   $$delete from price_reports where reported_at < now() - interval '6 months' and is_verified = false$$
-- );
--
-- Verified prices (verified_prices table) are NEVER auto-deleted.

-- ============================================================
-- NOTICE BOARD
-- ============================================================
-- (already defined above — adding admin delete policy)
create policy "Admin deletes notices" on notices for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- WEATHER & FLOOD ALERTS
-- ============================================================
-- (already defined above — no changes needed)

-- ============================================================
-- DONATIONS / FUNDRAISING
-- ============================================================
-- (already defined above — adding admin delete)
create policy "Admin deletes donations" on donations for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- FREE CLINIC & BLOOD DONATION
-- ============================================================
create table health_services (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('free_clinic','blood_drive','vaccination','dental','eye','other')),
  title text not null,
  title_mm text,
  organizer text,
  organizer_mm text,
  description text,
  description_mm text,
  location text,
  location_mm text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  contact_phone text,
  contact_name text,
  facebook text,
  -- For blood drives
  blood_types_needed text[] default '{}',  -- 'A+','B-','O+' etc
  -- Schedule
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  is_recurring boolean default false,
  recurring_day text,  -- 'monday','tuesday' etc (for weekly clinics)
  -- Images
  images text[] default '{}',
  -- Status
  status text default 'active' check (status in ('active','completed','cancelled')),
  is_verified boolean default false,  -- admin verified
  is_urgent boolean default false,
  poster_id uuid references profiles(id) on delete set null,
  posted_at timestamptz default now(),
  expires_at timestamptz
);

alter table health_services enable row level security;
create policy "Health services public" on health_services for select using (status = 'active');
create policy "Anyone can post health" on health_services for insert with check (true);
create policy "Admin manages health" on health_services for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

create index health_type_idx on health_services(type, status, start_date);

-- ============================================================
-- ADMIN MODERATION — Universal delete policies
-- ============================================================
-- Allow admin/mod to delete from all community tables
create policy "Admin deletes lost_found" on lost_found for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes jobs" on jobs for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes price_reports" on price_reports for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes power_reports" on power_cut_reports for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes fuel_reports" on fuel_reports for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes chat" on chat_messages for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes health" on health_services for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
create policy "Admin deletes weather" on weather_alerts for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- ============================================================
-- MARKET NAMES (customizable per city)
-- ============================================================
create table if not exists markets (
  id   uuid default uuid_generate_v4() primary key,
  name text not null unique,
  city text default 'Taunggyi',
  sort_order int default 0,
  is_active boolean default true
);

alter table markets enable row level security;
create policy "Markets public"       on markets for select using (true);
create policy "Admin manages markets" on markets for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);

-- Seed default Taunggyi markets
insert into markets (name, city, sort_order) values
  ('ပြည်သူ့ဈေး',       'Taunggyi', 1),
  ('ပင်လုံဈေး',         'Taunggyi', 2),
  ('မြို့သစ်ဈေး',       'Taunggyi', 3),
  ('အောင်မင်္ဂလာဈေး',  'Taunggyi', 4),
  ('ကလောဈေး',          'Kalaw',    5),
  ('နိုင်ဓနဈေး',        'Taunggyi', 6),
  ('အခြား',             'Taunggyi', 99)
on conflict (name) do nothing;

-- ============================================================
-- EMERGENCY CONTACTS
-- ============================================================
create table emergency_contacts (
  id           uuid default uuid_generate_v4() primary key,
  category     text not null check (category in (
                 'hospital','police','fire','ambulance',
                 'electricity','water','gas','rescue','other')),
  name         text not null,
  name_mm      text,
  phone_1      text not null,
  phone_2      text,
  phone_3      text,
  address      text,
  address_mm   text,
  township     text default 'Taunggyi',
  note         text,
  note_mm      text,
  is_24h       boolean default false,
  is_free      boolean default false,
  is_active    boolean default true,
  sort_order   int default 0,
  added_by     uuid references profiles(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table emergency_contacts enable row level security;
create policy "Emergency contacts public" on emergency_contacts
  for select using (is_active = true);
create policy "Admin manages emergency" on emergency_contacts
  for all using (
    exists (select 1 from profiles where id = auth.uid()
            and role in ('admin','moderator'))
  );

-- Seed: Taunggyi emergency contacts
insert into emergency_contacts
  (category, name, name_mm, phone_1, phone_2, township, is_24h, is_free, sort_order)
values
  ('hospital',   'Taunggyi General Hospital',   'တောင်ကြီး ပြည်သူ့ဆေးရုံကြီး',   '081-2121',  '081-2122',  'Taunggyi', true,  true,  1),
  ('hospital',   'Taunggyi Women & Children',   'မိခင်နှင့်ကလေး ဆေးရုံ',           '081-2200',  null,        'Taunggyi', true,  true,  2),
  ('ambulance',  'Ambulance (General Hospital)', 'ဆေးယာဉ် (ပြည်သူ့ဆေးရုံ)',        '081-2121',  '09-44800000','Taunggyi', true, true,  3),
  ('police',     'Taunggyi Police Station',      'တောင်ကြီး ရဲစခန်း',               '081-2055',  '199',        'Taunggyi', true,  false, 4),
  ('fire',       'Taunggyi Fire Station',         'တောင်ကြီး မီးသတ်ဌာန',            '081-2012',  '191',        'Taunggyi', true,  true,  5),
  ('electricity','Taunggyi Electricity',          'လျှပ်စစ် ဌာန',                   '081-2066',  null,         'Taunggyi', false, false, 6),
  ('water',      'Taunggyi Water Supply',         'ရေပေးဝေရေး ဌာန',                 '081-2040',  null,         'Taunggyi', false, false, 7),
  ('rescue',     'Red Cross Myanmar',             'မြန်မာနိုင်ငံ ကြက်ခြေနီ',        '09-43000000', null,       'Taunggyi', true,  true,  8);

-- ============================================================
-- SUPER ADMIN + 3-TYPE VERIFICATION
-- ============================================================

-- 1. Add super_admin role
alter table profiles
  drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('member','moderator','admin','super_admin'));

-- Make the very first registered user super_admin
-- (Run manually after first signup):
-- update profiles set role = 'super_admin'
-- where id = (select id from profiles order by created_at limit 1);

-- 2. Add verify_type to listings
alter table listings
  add column if not exists verify_type text
  check (verify_type in ('owner','community','cherry','none')) default 'none';

-- community_votes: how many members have confirmed this listing
alter table listings
  add column if not exists community_votes int default 0;

-- 3. Listing community votes table
create table if not exists listing_votes (
  id         uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  voted_at   timestamptz default now(),
  unique(listing_id, user_id)
);

alter table listing_votes enable row level security;
create policy "Votes public read"  on listing_votes for select using (true);
create policy "Members can vote"   on listing_votes for insert
  with check (auth.uid() = user_id);
create policy "Members delete vote" on listing_votes for delete
  using (auth.uid() = user_id);

-- Auto-update community_votes count + auto-verify if threshold met
create or replace function handle_listing_vote()
returns trigger as $$
declare
  vote_count int;
  min_votes  int := 10;   -- minimum 10 community votes
begin
  -- Recalculate vote count
  select count(*) into vote_count
  from listing_votes
  where listing_id = coalesce(NEW.listing_id, OLD.listing_id);

  update listings set
    community_votes = vote_count,
    -- Auto-upgrade verify_type to 'community' if threshold met
    verify_type = case
      when vote_count >= min_votes and verify_type = 'none' then 'community'
      when vote_count >= min_votes and verify_type = 'owner' then 'owner'  -- owner stays
      else verify_type
    end,
    is_verified = case
      when vote_count >= min_votes then true
      else is_verified
    end
  where id = coalesce(NEW.listing_id, OLD.listing_id);

  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger on_listing_vote
  after insert or delete on listing_votes
  for each row execute procedure handle_listing_vote();

-- 4. super_admin can do everything admin can + change any role
-- (Enforced in application layer — super_admin check in AdminPage)

-- Update RLS: super_admin = full access everywhere
create policy "Super admin full access listings" on listings
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
  );
create policy "Super admin full access profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
  );

-- ============================================================
-- CATEGORIES — ADD PARENT/SUBCATEGORY SUPPORT
-- ============================================================
alter table categories
  add column if not exists parent_id uuid references categories(id) on delete set null,
  add column if not exists is_active boolean default true,
  add column if not exists description_mm text,
  add column if not exists updated_at timestamptz default now();

-- RLS for categories — public read, admin write
alter table categories enable row level security;
create policy "Categories public read" on categories for select using (true);
create policy "Admin manages categories" on categories for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator','super_admin'))
);

-- Index for fast sub-category lookup
create index if not exists categories_parent_idx on categories(parent_id);
create index if not exists categories_type_idx   on categories(type, is_active, sort_order);
