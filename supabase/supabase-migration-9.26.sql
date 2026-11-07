-- ============================================================
-- Cherry Directory v9.26 — sm3 Category 23 categories
-- MANUAL STEP — run AFTER deploy, in the Supabase SQL Editor
-- (Dashboard > SQL Editor > New query, paste, Run).
-- This file is WRITTEN by the fix script but NEVER run by it.
--
-- What it does: creates the 9 Directory categories the 874 sm3dir
-- Category 23 (General Services) shops need, so they are NOT all
-- dumped in အထွေထွေ:
--   Top-level (3): Real Estate, Advertising Agency, Employment Services
--   Sub-categories (6): Car Rental Service (under Taxi & Transport),
--     Insurance (under Finance & Banking), Custom Clearance (under
--     Delivery Service), Oversea / Local / Seaman & Shipping Employment
--     Service (under Employment Services).
--   "General Services" (26 rows) genuinely belongs in the existing
--   အထွေထွေ category — no row is created for it here.
--
-- IDEMPOTENT — safe to run twice: every INSERT is guarded by
-- WHERE NOT EXISTS on (name, type), and parent lookups resolve by
-- name at run time (live category ids are uuids the repo does not
-- know). A sub-category is inserted ONLY if its parent exists; if a
-- parent was renamed live, that row is skipped instead of silently
-- becoming top-level — check the verification query at the end.
-- There is NO unique constraint on categories.name, so
-- ON CONFLICT DO NOTHING cannot be used here.
--
-- After running, the verification SELECT at the bottom must show
-- 9 rows. Then import
-- cherry-directory-bulk-import-sm3dir-874.csv (Bulk Import page).
-- ============================================================

-- ── Top-level categories ─────────────────────────────────────
insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Real Estate', 'အိမ်ခြံမြေ', '🏡', 'directory', 33, true,
  'အိမ်ခြံမြေ အေဂျင်စီ / အကျိုးဆောင် — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Real Estate' and type = 'directory'
);

insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Advertising Agency', 'ကြော်ငြာအေဂျင်စီ', '📣', 'directory', 34, true,
  'ကြော်ငြာ အေဂျင်စီ — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Advertising Agency' and type = 'directory'
);

insert into categories (name, name_mm, icon, type, sort_order, is_active, description_mm)
select 'Employment Services', 'အလုပ်အကိုင်ဝန်ဆောင်မှု', '💼', 'directory', 35, true,
  'အလုပ်အကိုင် ဝန်ဆောင်မှု (ပြည်တွင်း / ပြည်ပ / သင်္ဘောသား) — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Employment Services' and type = 'directory'
);

-- ── Sub-categories under EXISTING parents ────────────────────
insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Car Rental Service', 'ကားငှားဝန်ဆောင်မှု', '🚗', 'directory', 1, true,
  (select id from categories where name = 'Taxi & Transport' and type = 'directory' limit 1),
  'ကားငှားဝန်ဆောင်မှု — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Car Rental Service' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Taxi & Transport' and type = 'directory'
);

insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Insurance', 'အာမခံ', '🛡️', 'directory', 1, true,
  (select id from categories where name = 'Finance & Banking' and type = 'directory' limit 1),
  'အာမခံ အေဂျင်စီ — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Insurance' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Finance & Banking' and type = 'directory'
);

insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Custom Clearance', 'အကောက်ခွန်ရှင်းလင်းရေး', '📋', 'directory', 1, true,
  (select id from categories where name = 'Delivery Service' and type = 'directory' limit 1),
  'အကောက်ခွန်ရှင်းလင်းရေး အေဂျင်စီ — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Custom Clearance' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Delivery Service' and type = 'directory'
);

-- ── Sub-categories under the NEW Employment Services parent ──
insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Oversea Employment Service', 'ပြည်ပအလုပ်အကိုင်', '✈️', 'directory', 1, true,
  (select id from categories where name = 'Employment Services' and type = 'directory' limit 1),
  'ပြည်ပ အလုပ်အကိုင် ဝန်ဆောင်မှု — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Oversea Employment Service' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Employment Services' and type = 'directory'
);

insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Local Employment Service', 'ပြည်တွင်းအလုပ်အကိုင်', '👷', 'directory', 2, true,
  (select id from categories where name = 'Employment Services' and type = 'directory' limit 1),
  'ပြည်တွင်း အလုပ်အကိုင် ဝန်ဆောင်မှု — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Local Employment Service' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Employment Services' and type = 'directory'
);

insert into categories (name, name_mm, icon, type, sort_order, is_active, parent_id, description_mm)
select 'Seaman & Shipping Employment Service', 'သင်္ဘောသားအလုပ်အကိုင်', '⚓', 'directory', 3, true,
  (select id from categories where name = 'Employment Services' and type = 'directory' limit 1),
  'သင်္ဘောသား အလုပ်အကိုင် ဝန်ဆောင်မှု — sm3 Category 23 (v9.26)'
where not exists (
  select 1 from categories where name = 'Seaman & Shipping Employment Service' and type = 'directory'
)
and exists (
  select 1 from categories where name = 'Employment Services' and type = 'directory'
);

-- ── Verification — must show 9 rows ──────────────────────────
-- (If fewer than 9, a parent name did not match live — check the
-- missing row's parent in the live categories table and re-run.)
select
  c.name,
  c.name_mm,
  p.name as parent_name,
  c.sort_order
from categories c
left join categories p on p.id = c.parent_id
where c.name in (
  'Real Estate', 'Advertising Agency', 'Employment Services',
  'Car Rental Service', 'Insurance', 'Custom Clearance',
  'Oversea Employment Service', 'Local Employment Service',
  'Seaman & Shipping Employment Service'
)
and c.type = 'directory'
order by c.sort_order, c.name;
