-- ============================================================
-- Cherry Directory v9.27 — 2 missing + 13 new categories +
-- 27 category name translations
-- MANUAL STEP — run AFTER deploy, in the Supabase SQL Editor
-- (Dashboard > SQL Editor > New query, paste, Run).
-- This file is WRITTEN by the fix script but NEVER run by it.
--
-- What it does, in two parts:
--   PART 1 — creates the 2 sm3 Category 23 categories the 9.26
--     migration was MEANT to create but could not, because its
--     parents do not exist live: 'Taxi & Transport' and
--     'Finance & Banking' are ABSENT from the live categories
--     table (not renamed — absent), so the 9.26 guarded INSERTs
--     for these two rows correctly inserted NOTHING.
--       * 'Insurance' (အာမခံ) → sub-category of live 'Bank'
--         (the closest live parent; there is no Finance & Banking).
--       * 'Car Rental Service' (ကားငှားဝန်ဆောင်မှု) → TOP-LEVEL
--         (parent_id NULL). No transport parent exists live:
--         Delivery Service is parcels, and Station / Charging
--         Station / Driving School do not fit. The user can move
--         it under another category in Category Manager later.
--     The OTHER 7 categories from the 9.26 migration ARE live
--     (Advertising Agency, Custom Clearance, Employment Services,
--     Local / Oversea / Seaman & Shipping Employment Service,
--     Real Estate) — they are NOT re-created here. This file
--     creates ONLY the 2 missing ones.
--     PLUS 13 NEW top-level categories (PART 1b, user decision
--     2026-11-07 "ရတဲ့နားကဟာတွေ အကုန်ထည့်"): web research found
--     hotels / schools / hospitals / pharmacies / emergency /
--     government / food-drink / bus / flight entries in 6 towns
--     needing listing categories that do NOT exist live yet, plus
--     an audit confirmed 5 more event categories. All 13 are
--     TOP-LEVEL (parent_id NULL) — e.g. 'Bus Terminal' is NOT
--     made a child of live 'Station', whose meaning is uncertain
--     (see the 'Station' → 'ဘူတာ' note below); the user can move
--     any of them under another category in Category Manager later.
--     None of the 13 names collides with any live category name.
--   PART 2 — translates 27 live category names so the rule
--     "live `name` is English, `name_mm` is Myanmar" holds:
--     21 rows have Myanmar in BOTH columns → set English `name`
--     (keep `name_mm` as-is); 5 rows have English in BOTH columns
--     → set Myanmar `name_mm` (keep `name` as-is); 1 dedup fix —
--     'Government' and 'Government Office' BOTH have name_mm
--     'အစိုးရရုံး', so 'Government' becomes 'အစိုးရ'.
--     'Station' → 'ဘူတာ' is a JUDGMENT CALL: nothing in the repo
--     says what 'Station' means here (no bus/train/railway
--     reference anywhere; fuel stations live in the separate
--     fuel_stations table, NOT in categories; 'Charging Station'
--     is its own live category). If it turns out to be a bus
--     terminal / petrol station, change name_mm to 'ကားဂိတ်' /
--     'ဆီဆိုင်' in Category Manager — one field, no migration.
--
-- IDEMPOTENT — safe to run twice: every INSERT is guarded by
-- WHERE NOT EXISTS on (name, type), and every UPDATE is guarded
-- by its CURRENT (old) name value, so a re-run matches 0 rows
-- and changes nothing. There is NO unique constraint on
-- categories.name, so ON CONFLICT DO NOTHING cannot be used here.
-- A re-run must still show the same 15 + 27 rows in the
-- verification SELECTs at the bottom.
--
-- After running, the verification SELECTs at the bottom must show
-- (a) 15 rows — the new categories with their parent (2 + 13), then
-- (b) 27 rows — the translated names — and (c) 0 rows — no old
-- name left behind. Then import
-- cherry-directory-bulk-import-sm3dir-874.csv (Bulk Import page).
-- ============================================================

-- ── PART 1 — the 2 missing categories ────────────────────────
-- Insurance — sub-category of live 'Bank'.
insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Insurance', 'အာမခံ', '🛡️', 'directory', 1, true,
  (select id from categories where name = 'Bank' and type = 'directory' limit 1),
  'အာမခံ အေဂျင်စီ — sm3 Category 23 (v9.27)'
where not exists (
  select 1 from categories where name = 'Insurance' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Bank' and type = 'directory'
);

-- Car Rental Service — TOP-LEVEL (no transport parent exists live).
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Car Rental Service', 'ကားငှားဝန်ဆောင်မှု', '🚗', 'directory', 1, true,
  'ကားငှားဝန်ဆောင်မှု — sm3 Category 23 (v9.27)'
where not exists (
  select 1 from categories where name = 'Car Rental Service' and type = 'directory'
);

-- ── PART 1b — 13 NEW top-level categories ────────────────────
-- (User decision 2026-11-07 "ရတဲ့နားကဟာတွေ အကုန်ထည့်": web
-- research + event-category audit. All TOP-LEVEL, parent_id NULL,
-- same guarded pattern as above; 'Hall Rental' is NOT added here
-- — it already exists live. Each INSERT matches 0 rows on a re-run.)
-- Event Organizer — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Event Organizer', 'ပွဲစီစဉ်သူ', '🎉', 'directory', 1, true,
  'ပွဲစီစဉ်သူ — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Event Organizer' and type = 'directory'
);

-- Hall Decoration — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Hall Decoration', 'ခန်းမအလှဆင်ခြင်း', '🎀', 'directory', 1, true,
  'ခန်းမအလှဆင်ခြင်း — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Hall Decoration' and type = 'directory'
);

-- Beauty & Salon — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Beauty & Salon', 'အလှပြင်ဆိုင်', '💇', 'directory', 1, true,
  'အလှပြင်ဆိုင် — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Beauty & Salon' and type = 'directory'
);

-- Florist — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Florist', 'ပန်းဆိုင်', '🌸', 'directory', 1, true,
  'ပန်းဆိုင် — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Florist' and type = 'directory'
);

-- Gift Shop — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Gift Shop', 'လက်ဆောင်ပစ္စည်းဆိုင်', '🎁', 'directory', 1, true,
  'လက်ဆောင်ပစ္စည်းဆိုင် — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Gift Shop' and type = 'directory'
);

-- Pharmacy — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Pharmacy', 'ဆေးဆိုင်', '💊', 'directory', 1, true,
  'ဆေးဆိုင် — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Pharmacy' and type = 'directory'
);

-- Hospital — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Hospital', 'ဆေးရုံ', '🏥', 'directory', 1, true,
  'ဆေးရုံ — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Hospital' and type = 'directory'
);

-- Bar — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Bar', 'ဘား', '🍷', 'directory', 1, true,
  'ဘား — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Bar' and type = 'directory'
);

-- KTV — TOP-LEVEL (name_mm is 'KTV' — no Myanmar word exists).
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'KTV', 'KTV', '🎤', 'directory', 1, true,
  'KTV — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'KTV' and type = 'directory'
);

-- Bus Terminal — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Bus Terminal', 'အဝေးပြေးကားဂိတ်', '🚌', 'directory', 1, true,
  'အဝေးပြေးကားဂိတ် — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Bus Terminal' and type = 'directory'
);

-- Flight Ticket Office — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Flight Ticket Office', 'လေယာဉ်လက်မှတ်ရုံး', '✈️', 'directory', 1, true,
  'လေယာဉ်လက်မှတ်ရုံး — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Flight Ticket Office' and type = 'directory'
);

-- Police Station — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Police Station', 'ရဲစခန်း', '🚓', 'directory', 1, true,
  'ရဲစခန်း — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Police Station' and type = 'directory'
);

-- Fire Station — TOP-LEVEL.
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Fire Station', 'မီးသတ်စခန်း', '🚒', 'directory', 1, true,
  'မီးသတ်စခန်း — category အသစ် (v9.27)'
where not exists (
  select 1 from categories where name = 'Fire Station' and type = 'directory'
);

-- ── PART 2a — Myanmar in both columns → English `name` ──────
-- (21 rows; `name_mm` is kept exactly as-is. Each UPDATE is
-- guarded by the OLD name in BOTH columns, so it can only ever
-- touch its own row and matches 0 rows on a re-run.)
update categories set name = 'Health'
  where name = 'ကျန်းမာရေး' and name_mm = 'ကျန်းမာရေး' and type = 'directory';
update categories set name = 'Private High School'
  where name = 'ကိုယ်ပိုင် အထက်တန်းကျောင်း' and name_mm = 'ကိုယ်ပိုင် အထက်တန်းကျောင်း' and type = 'directory';
update categories set name = 'Store'
  where name = 'စတိုးဆိုင်' and name_mm = 'စတိုးဆိုင်' and type = 'directory';
update categories set name = 'Sticker, V9 & Signboard'
  where name = 'စတေကာ ၊ V9 ၊ ဆိုင်းဘုတ်' and name_mm = 'စတေကာ ၊ V9 ၊ ဆိုင်းဘုတ်' and type = 'directory';
update categories set name = 'Sticker & Signboard'
  where name = 'စတေကာ ၊ ဆိုင်းဘုတ်' and name_mm = 'စတေကာ ၊ ဆိုင်းဘုတ်' and type = 'directory';
update categories set name = 'Market'
  where name = 'စျေး' and name_mm = 'စျေး' and type = 'directory';
update categories set name = 'Shopping Centre'
  where name = 'စျေးဝယ်စင်တာ' and name_mm = 'စျေးဝယ်စင်တာ' and type = 'directory';
update categories set name = 'Restaurant'
  where name = 'စားသောက်ဆိုင်' and name_mm = 'စားသောက်ဆိုင်' and type = 'directory';
update categories set name = 'Construction'
  where name = 'ဆောက်လုပ်ရေး' and name_mm = 'ဆောက်လုပ်ရေး' and type = 'directory';
update categories set name = 'Construction Company'
  where name = 'ဆောက်လုပ်ရေး ကုမ္ပဏီ' and name_mm = 'ဆောက်လုပ်ရေး ကုမ္ပဏီ' and type = 'directory';
update categories set name = 'Education'
  where name = 'ပညာရေး' and name_mm = 'ပညာရေး' and type = 'directory';
update categories set name = 'Mala Restaurant'
  where name = 'မာလာဟင်းဆိုင်' and name_mm = 'မာလာဟင်းဆိုင်' and type = 'directory';
update categories set name = 'Driving School'
  where name = 'ယာဉ်မောင်း သင်တန်းကျောင်း' and name_mm = 'ယာဉ်မောင်း သင်တန်းကျောင်း' and type = 'directory';
update categories set name = 'Tea Shop'
  where name = 'လဖက်ရည်ဆိုင်' and name_mm = 'လဖက်ရည်ဆိုင်' and type = 'directory';
update categories set name = 'BBQ Restaurant'
  where name = 'အကင်ဆိုင်' and name_mm = 'အကင်ဆိုင်' and type = 'directory';
update categories set name = 'Food'
  where name = 'အစားအသောက်' and name_mm = 'အစားအသောက်' and type = 'directory';
-- 'အဆာပြေ (Snack)': English name becomes 'Snack' AND the
-- '(Snack)' is dropped from the Myanmar column → 'အဆာပြေ'.
update categories set name = 'Snack', name_mm = 'အဆာပြေ'
  where name = 'အဆာပြေ (Snack)' and name_mm = 'အဆာပြေ (Snack)' and type = 'directory';
update categories set name = 'General'
  where name = 'အထွေထွေ' and name_mm = 'အထွေထွေ' and type = 'directory';
update categories set name = 'General Clinic'
  where name = 'အထွေထွေ ရောဂါကု' and name_mm = 'အထွေထွေ ရောဂါကု' and type = 'directory';
update categories set name = 'Salad Shop'
  where name = 'အထောင်းဆိုင်' and name_mm = 'အထောင်းဆိုင်' and type = 'directory';
update categories set name = 'Skin Clinic'
  where name = 'အရေပြားဆေးခန်း' and name_mm = 'အရေပြားဆေးခန်း' and type = 'directory';

-- ── PART 2b — English in both columns → Myanmar `name_mm` ───
-- (5 rows; `name` is kept exactly as-is.)
update categories set name_mm = 'အားသွင်းစခန်း'
  where name = 'Charging Station' and name_mm = 'Charging Station' and type = 'directory';
update categories set name_mm = 'ကော်ဖီနှင့် အဆာပြေ'
  where name = 'Coffee & Snack' and name_mm = 'Coffee & Snack' and type = 'directory';
update categories set name_mm = 'ခန်းမငှားရမ်းခြင်း'
  where name = 'Hall Rental' and name_mm = 'Hall Rental' and type = 'directory';
update categories set name_mm = 'လူမှုရေးပွဲများ'
  where name = 'Social Events' and name_mm = 'Social Events' and type = 'directory';
-- JUDGMENT CALL (see header): 'Station' → 'ဘူတာ'. If it is a bus
-- terminal or a petrol station, fix name_mm in Category Manager.
update categories set name_mm = 'ဘူတာ'
  where name = 'Station' and name_mm = 'Station' and type = 'directory';

-- ── PART 2c — dedup: 'Government' vs 'Government Office' ────
-- Both have name_mm 'အစိုးရရုံး'; 'Government' becomes 'အစိုးရ'
-- and 'Government Office' keeps 'အစိုးရရုံး'.
update categories set name_mm = 'အစိုးရ'
  where name = 'Government' and name_mm = 'အစိုးရရုံး' and type = 'directory';

-- ── Verification (a) — must show 15 rows ─────────────────────
-- (2 from PART 1 + 13 from PART 1b, each with parent 'TOP-LEVEL'
-- except 'Insurance' under 'Bank'. If fewer than 15, a parent
-- name did not match live — check the missing row's parent in
-- the live categories table and re-run.)
select
  c.name,
  c.name_mm,
  coalesce(p.name, 'TOP-LEVEL') as parent_name,
  c.sort_order
from categories c
left join categories p on p.id = c.parent_id
where c.name in (
  'Insurance', 'Car Rental Service',
  'Event Organizer', 'Hall Decoration', 'Beauty & Salon',
  'Florist', 'Gift Shop', 'Pharmacy', 'Hospital',
  'Bar', 'KTV', 'Bus Terminal', 'Flight Ticket Office',
  'Police Station', 'Fire Station'
)
and c.type = 'directory'
order by c.name;

-- ── Verification (b) — must show 27 rows ─────────────────────
select name, name_mm
from categories
where type = 'directory'
and name in (
  'Health', 'Private High School', 'Store',
  'Sticker, V9 & Signboard', 'Sticker & Signboard',
  'Market', 'Shopping Centre', 'Restaurant',
  'Construction', 'Construction Company', 'Education',
  'Mala Restaurant', 'Driving School', 'Tea Shop',
  'BBQ Restaurant', 'Food', 'Snack', 'General',
  'General Clinic', 'Salad Shop', 'Skin Clinic',
  'Charging Station', 'Coffee & Snack', 'Hall Rental',
  'Social Events', 'Station', 'Government'
)
order by name;

-- ── Verification (c) — must show 0 rows ──────────────────────
-- No old (pre-translation) name left behind. A row here means
-- that UPDATE matched nothing — check the live spelling of that
-- name (it may already have been renamed by hand) and fix it in
-- Category Manager instead of re-running.
select name, name_mm
from categories
where type = 'directory'
and name in (
  'ကျန်းမာရေး', 'ကိုယ်ပိုင် အထက်တန်းကျောင်း', 'စတိုးဆိုင်',
  'စတေကာ ၊ V9 ၊ ဆိုင်းဘုတ်', 'စတေကာ ၊ ဆိုင်းဘုတ်',
  'စျေး', 'စျေးဝယ်စင်တာ', 'စားသောက်ဆိုင်',
  'ဆောက်လုပ်ရေး', 'ဆောက်လုပ်ရေး ကုမ္ပဏီ', 'ပညာရေး',
  'မာလာဟင်းဆိုင်', 'ယာဉ်မောင်း သင်တန်းကျောင်း', 'လဖက်ရည်ဆိုင်',
  'အကင်ဆိုင်', 'အစားအသောက်', 'အဆာပြေ (Snack)',
  'အထွေထွေ', 'အထွေထွေ ရောဂါကု', 'အထောင်းဆိုင်', 'အရေပြားဆေးခန်း'
)
order by name;
