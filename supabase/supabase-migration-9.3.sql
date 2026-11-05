-- ============================================================
-- Cherry Directory — v9.3 migration
-- Run in: Supabase Dashboard → SQL Editor → paste & Run.
-- Run it AFTER deploying the v9.3 code.
-- Idempotent and safe to re-run: it runs cleanly twice in a
-- row, and it converges a live DB whether or not the v0.9.1
-- migration was ever applied (CREATE ... IF NOT EXISTS,
-- DROP ... IF EXISTS before CREATE, CREATE OR REPLACE for
-- functions, guarded DO blocks). Nothing in here touches
-- live data rows except adding columns with defaults and
-- replacing one unique constraint with a partial unique
-- index (see §8 — re-claiming after a rejection is the
-- point of that change).
--
-- EXPLICITLY NOT in this file (per the v9.3 spec):
--   * donations organizer-delete policy (code fix instead)
--   * leaderboard views security_invoker recreation
--     (live-check only — do NOT recreate blindly)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 0. ROLE HELPERS (convergence prerequisite — copied verbatim
--    from supabase-migration-v0.9.1.sql §0)
--    final.sql uses inline EXISTS checks and does NOT define
--    these helpers, so a DB where v0.9.1 was never applied
--    would fail every policy below that calls
--    public.is_admin_or_above(). Defining them here, before
--    §1–§17, makes this file self-contained either way.
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
-- 1. fuel_types.sort_order
--    fuel_types (final.sql: ~1018) has only (id, name,
--    name_mm, icon) — no sort_order. Admin ordering needs it.
-- ============================================================
alter table public.fuel_types add column if not exists sort_order int default 0;

-- ============================================================
-- 2. reviews — owner delete, admin delete, admin read/update
--    (E-20: usePendingReviews selects is_approved = false
--    rows and useApproveReview updates is_approved, so admins
--    need SELECT + UPDATE beyond the public policy.)
--    The existing public policy "Reviews are public"
--    (is_approved = true) is NOT touched — the admin policies
--    sit alongside it (permissive policies combine with OR).
-- ============================================================
drop policy if exists "Users can delete own review" on public.reviews;
create policy "Users can delete own review" on public.reviews
  for delete using (auth.uid() = user_id);

drop policy if exists "Admins can delete reviews" on public.reviews;
create policy "Admins can delete reviews" on public.reviews
  for delete using (public.is_admin_or_above());

drop policy if exists "Admins can view all reviews" on public.reviews;
create policy "Admins can view all reviews" on public.reviews
  for select using (public.is_admin_or_above());

drop policy if exists "Admins can update reviews" on public.reviews;
create policy "Admins can update reviews" on public.reviews
  for update using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ============================================================
-- 3. jobs — owner delete; poster can see own non-active jobs
--    Old select policy "Jobs are public" (final.sql:1128-1129)
--    was: using (status = 'active'). Dropped and recreated
--    with the wider condition so a poster sees their own
--    filled/expired jobs too.
-- ============================================================
drop policy if exists "Poster can delete own job" on public.jobs;
create policy "Poster can delete own job" on public.jobs
  for delete using (auth.uid() = poster_id);

drop policy if exists "Jobs are public" on public.jobs;
create policy "Jobs are public" on public.jobs
  for select using (status = 'active' or auth.uid() = poster_id);

-- ============================================================
-- 4. chat_messages — owner delete
--    ("Admin deletes chat" from final.sql:1642-1643 stays.)
-- ============================================================
drop policy if exists "Users can delete own message" on public.chat_messages;
create policy "Users can delete own message" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 5. health_services — owner FOR ALL
--    Owner column verified: poster_id (final.sql health_services
--    table, "poster_id uuid references profiles(id)").
--    ("Admin manages health" FOR ALL stays for admins.)
-- ============================================================
drop policy if exists "Owners manage own health services" on public.health_services;
create policy "Owners manage own health services" on public.health_services
  for all using (auth.uid() = poster_id)
  with check (auth.uid() = poster_id);

-- ============================================================
-- 6. tour_packages — admin/mod FOR ALL
--    No admin policy existed (final.sql:1372-1373 has only the
--    public "Packages public" select). Admin check is
--    public.is_admin_or_above() — the helper defined in §0 /
--    v0.9.1 §0 (roles admin, moderator, super_admin).
-- ============================================================
drop policy if exists "Admins manage tour packages" on public.tour_packages;
create policy "Admins manage tour packages" on public.tour_packages
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ============================================================
-- 7. bus_departures — moderator/admin delete
--    (Guest INSERT policy "Anyone report departure" is
--    intentionally untouched.)
-- ============================================================
drop policy if exists "Admins can delete departures" on public.bus_departures;
create policy "Admins can delete departures" on public.bus_departures
  for delete using (public.is_admin_or_above());

-- ============================================================
-- 8. listing_claims — partial unique index replaces the
--    blanket unique(listing_id, user_id)
--    Old behaviour: a rejected claim blocked the same user
--    from ever re-claiming the same listing (unique violation
--    on insert). New behaviour: uniqueness holds only while a
--    claim is pending or approved; a rejected claim frees the
--    pair for a fresh claim. (Code side: Track 4 updates
--    rejected → pending handling to match.)
--    The old unique was declared inline in final.sql
--    (unique(listing_id, user_id)), so Postgres auto-named the
--    constraint listing_claims_listing_id_user_id_key — but the
--    DO block below looks it up by definition instead of by
--    name, so it also works if a hand-run DB named it
--    differently, and it drops a standalone unique index too.
-- ============================================================
do $$
declare
  r record;
begin
  -- 8a. Drop the legacy full unique CONSTRAINT on
  --     (listing_id, user_id), whatever its name is.
  for r in
    select conname from pg_constraint
    where conrelid = 'public.listing_claims'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(listing_id, user_id)%'
      and pg_get_constraintdef(oid) not ilike '%where%'
  loop
    execute format('alter table public.listing_claims drop constraint %I', r.conname);
    raise notice '9.3 §8: dropped legacy unique constraint % on listing_claims', r.conname;
  end loop;
  -- 8b. Drop a legacy standalone full unique INDEX on
  --     (listing_id, user_id), if one exists instead of (or
  --     in addition to) the constraint.
  for r in
    select indexrelid::regclass::text as idxname from pg_index
    where indrelid = 'public.listing_claims'::regclass
      and indisunique and indpred is null
      and pg_get_indexdef(indexrelid) ilike '%(listing_id, user_id)%'
  loop
    execute format('drop index if exists %s', r.idxname);
    raise notice '9.3 §8: dropped legacy unique index % on listing_claims', r.idxname;
  end loop;
end $$;

-- 8c. Partial unique index: at most one pending/approved claim
--     per (listing, user). Guarded: if live data already has
--     two active claims for the same pair, the index cannot be
--     built — the NOTICE names the cleanup query instead of
--     aborting the whole migration (re-run after cleanup).
do $$
begin
  create unique index if not exists listing_claims_active_unique
    on public.listing_claims (listing_id, user_id)
    where status in ('pending', 'approved');
exception when unique_violation then
  raise notice '9.3 §8: listing_claims_active_unique NOT created — live data has duplicate pending/approved claims for the same (listing_id, user_id). Find them with: select listing_id, user_id, count(*) from listing_claims where status in (''pending'',''approved'') group by 1,2 having count(*) > 1; clean up, then re-run this migration.';
end $$;

-- ============================================================
-- 9. NOTIFICATION TRIGGERS
--    (a) Review notification type 'review' → 'new_review'.
--        NotificationsPage TYPE_CFG only knows 'new_review'
--        (plus 'review_approved'); the old 'review' type fell
--        through to the system_alert fallback icon and missed
--        the new_review navigation branch. Body copied verbatim
--        from v0.9.1 §12 handle_review_notification — only the
--        type string changed.
--    (b) NEW claim notification: notify the claimant when a
--        claim is approved or rejected. Types used are
--        'listing_approved' / 'listing_rejected' — both already
--        in NotificationsPage TYPE_CFG with navigation to
--        /directory/:id via data.listing_id. Title/message in
--        Myanmar, matching the existing notification style
--        (title = listing name, message = plain sentence).
--    NOTE: the notifications table itself is created in §13
--    (v0.9.1 convergence). That is safe here: CREATE OR
--    REPLACE FUNCTION does not validate the plpgsql body
--    against the table, and CREATE TRIGGER only needs the
--    trigger table (listing_claims / reviews) to exist.
-- ============================================================
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
    'new_review',
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

create or replace function public.handle_claim_notification()
returns trigger as $$
declare
  v_listing record;
begin
  if NEW.user_id is null then
    return NEW;
  end if;
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    select name, name_mm into v_listing
      from public.listings where id = NEW.listing_id;
    insert into public.notifications (user_id, type, title, message, data, listing_id)
    values (
      NEW.user_id,
      'listing_approved',
      coalesce(v_listing.name_mm, v_listing.name, 'လုပ်ငန်း'),
      'သင့်လုပ်ငန်း တောင်းဆိုမှုကို အတည်ပြုပြီးပါပြီ',
      jsonb_build_object(
        'listing_id', NEW.listing_id,
        'listing_name', coalesce(v_listing.name_mm, v_listing.name),
        'claim_id', NEW.id
      ),
      NEW.listing_id
    );
  elsif NEW.status = 'rejected' and OLD.status is distinct from 'rejected' then
    select name, name_mm into v_listing
      from public.listings where id = NEW.listing_id;
    insert into public.notifications (user_id, type, title, message, data, listing_id)
    values (
      NEW.user_id,
      'listing_rejected',
      coalesce(v_listing.name_mm, v_listing.name, 'လုပ်ငန်း'),
      'သင့်လုပ်ငန်း တောင်းဆိုမှုကို ပယ်ချလိုက်ပါပြီ',
      jsonb_build_object(
        'listing_id', NEW.listing_id,
        'listing_name', coalesce(v_listing.name_mm, v_listing.name),
        'claim_id', NEW.id
      ),
      NEW.listing_id
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_claim_notify on public.listing_claims;
create trigger on_claim_notify
  after update on public.listing_claims
  for each row execute procedure public.handle_claim_notification();

-- ============================================================
-- 10. user_points — forgery fix (C-3) + chat RPC + delete
--     reversals (H-25)
--     (a) DROP both client INSERT policies: the base one
--         "Anyone insert points" (final.sql:558-559,
--         WITH CHECK (true)) and the v0.9.1 narrowed one
--         "Users insert own points" (v0.9.1 §7). After this
--         there is NO client INSERT policy left on user_points,
--         so a client can no longer mint points for itself.
--         The SECURITY DEFINER award triggers (§13 + final.sql)
--         and the RPC in (c) bypass RLS and keep working.
--         NOTE for Track 4: the only client-side insert was
--         usePoints.award({ action: 'chat_message' }) from
--         ChatPage — it must now call award_chat_point()
--         instead; all other awards already come from triggers.
--     (b) CHECK constraining (action, points) to the legitimate
--         pairs ONLY. Verified pairs — action names and values
--         from the award triggers (final.sql handle_review_
--         created / handle_listing_submitted, v0.9.1
--         handle_rsvp_created / handle_claim_points) and from
--         src/hooks/usePoints.js POINTS, which all agree:
--           write_review     +5   (NOT +10 — the spec draft
--                                   said review +10; the code
--                                   and final.sql both say +5)
--           submit_listing   +10
--           listing_approved +20
--           rsvp_going       +2   (comment in final.sql says
--                                   'rsvp'; the trigger and
--                                   usePoints.js say 'rsvp_going')
--           chat_message     +1   (NOT 'chat' — the spec draft
--                                   shorthand; the real action
--                                   name everywhere is
--                                   'chat_message')
--           claim_approved   +30
--         Negative counterparts are included ONLY for the five
--         actions the delete-reversal triggers in (d) write
--         (-5 / -10 / -20 / -2 / -30). NOT included:
--         'helpful_review' +3 (mentioned only as a future idea
--         in a final.sql comment — nothing awards it) and
--         'rsvp' (comment-only name). Guarded: if live rows
--         contain any other pair, the CHECK is skipped with a
--         NOTICE naming the audit query instead of aborting
--         the migration.
--     (c) award_chat_point() SECURITY DEFINER RPC: inserts ONE
--         ('chat_message', 1) row for auth.uid(), only if the
--         user has fewer than 10 chat_message rows today on
--         the Myanmar calendar day. "Today" uses the
--         Asia/Rangoon date boundary — the existing triggers
--         never compute "today"; the client cap in usePoints.js
--         uses the device's local midnight converted to UTC,
--         which for a Myanmar user is the same calendar day,
--         so Rangoon is the matching server-side boundary.
--         Returns true when a point was awarded, false when
--         not logged in or the daily cap is reached.
--         EXECUTE is granted to authenticated only (revoked
--         from public first — anon must NOT be able to call
--         it; guests earn no points).
--     (d) AFTER DELETE points-reversal triggers (H-25): when a
--         review / listing / RSVP is deleted, write a negative
--         ledger row cancelling the points its creation
--         awarded, keyed on (user_id, action, ref_table,
--         ref_id) — the same ref_table/ref_id conventions the
--         award triggers use ('reviews' / 'listings' /
--         'event_rsvps'). A reversal is written only if the
--         matching positive row exists AND no reversal exists
--         yet, so totals can never go below the earned amount
--         for that item. The profile-exists guard matters:
--         deleting a user cascades to their reviews/points, and
--         a reversal insert for a just-deleted profile would
--         violate the user_points → profiles FK and abort the
--         user delete — so reversals are skipped when the
--         profile is already gone. sync_user_points() (AFTER
--         INSERT OR UPDATE OR DELETE on user_points) keeps
--         profiles.points in sync for both directions.
--         GAP (documented): chat_message points are NOT
--         reversed when a chat message is deleted — there is
--         no per-message ref_id stored by award_chat_point()
--         (it takes no message id) and no award trigger on
--         chat_messages to mirror, so a delete cannot be
--         matched to its +1 row.
-- ============================================================
drop policy if exists "Anyone insert points" on public.user_points;
drop policy if exists "Users insert own points" on public.user_points;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_points_action_points_check'
      and conrelid = 'public.user_points'::regclass
  ) then
    alter table public.user_points
      add constraint user_points_action_points_check check (
        (action = 'write_review'     and points =  5) or
        (action = 'write_review'     and points = -5) or
        (action = 'submit_listing'   and points =  10) or
        (action = 'submit_listing'   and points = -10) or
        (action = 'listing_approved' and points =  20) or
        (action = 'listing_approved' and points = -20) or
        (action = 'rsvp_going'       and points =  2) or
        (action = 'rsvp_going'       and points = -2) or
        (action = 'chat_message'     and points =  1) or
        (action = 'claim_approved'   and points =  30) or
        (action = 'claim_approved'   and points = -30)
      );
  end if;
exception
  when check_violation then
    raise notice '9.3 §10: user_points CHECK NOT added — live rows contain (action, points) pairs outside the legitimate list. Audit with: select action, points, count(*) from public.user_points group by 1, 2 order by 1, 2; clean up, then re-run this migration.';
  when duplicate_object then
    raise notice '9.3 §10: user_points CHECK already exists.';
end $$;

create or replace function public.award_chat_point()
returns boolean as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return false;
  end if;
  select count(*) into v_count
  from public.user_points
  where user_id = v_uid
    and action = 'chat_message'
    and (created_at at time zone 'Asia/Rangoon')::date
      = (now() at time zone 'Asia/Rangoon')::date;
  if v_count >= 10 then
    return false;
  end if;
  insert into public.user_points(user_id, action, points, ref_table, ref_id)
  values (v_uid, 'chat_message', 1, 'chat_messages', null);
  return true;
end;
$$ language plpgsql security definer;

revoke execute on function public.award_chat_point() from public;
grant execute on function public.award_chat_point() to authenticated;

-- (d) delete-reversal triggers
create or replace function public.handle_review_deleted_points()
returns trigger as $$
begin
  if exists (select 1 from public.profiles where id = OLD.user_id)
    and exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'write_review' and points = 5
        and ref_table = 'reviews' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'write_review' and points = -5
        and ref_table = 'reviews' and ref_id = OLD.id
    ) then
    insert into public.user_points(user_id, action, points, ref_table, ref_id)
    values (OLD.user_id, 'write_review', -5, 'reviews', OLD.id);
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_deleted_points on public.reviews;
create trigger on_review_deleted_points
  after delete on public.reviews
  for each row execute procedure public.handle_review_deleted_points();

create or replace function public.handle_listing_deleted_points()
returns trigger as $$
begin
  -- submitted_by earned +10 on submit and +20 on approval;
  -- reverse each leg only if it was actually awarded.
  if OLD.submitted_by is not null
    and exists (select 1 from public.profiles where id = OLD.submitted_by) then
    if exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'submit_listing' and points = 10
        and ref_table = 'listings' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'submit_listing' and points = -10
        and ref_table = 'listings' and ref_id = OLD.id
    ) then
      insert into public.user_points(user_id, action, points, ref_table, ref_id)
      values (OLD.submitted_by, 'submit_listing', -10, 'listings', OLD.id);
    end if;
    if exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'listing_approved' and points = 20
        and ref_table = 'listings' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.submitted_by and action = 'listing_approved' and points = -20
        and ref_table = 'listings' and ref_id = OLD.id
    ) then
      insert into public.user_points(user_id, action, points, ref_table, ref_id)
      values (OLD.submitted_by, 'listing_approved', -20, 'listings', OLD.id);
    end if;
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists on_listing_deleted_points on public.listings;
create trigger on_listing_deleted_points
  after delete on public.listings
  for each row execute procedure public.handle_listing_deleted_points();

create or replace function public.handle_rsvp_deleted_points()
returns trigger as $$
begin
  if exists (select 1 from public.profiles where id = OLD.user_id)
    and exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'rsvp_going' and points = 2
        and ref_table = 'event_rsvps' and ref_id = OLD.id
    )
    and not exists (
      select 1 from public.user_points
      where user_id = OLD.user_id and action = 'rsvp_going' and points = -2
        and ref_table = 'event_rsvps' and ref_id = OLD.id
    ) then
    insert into public.user_points(user_id, action, points, ref_table, ref_id)
    values (OLD.user_id, 'rsvp_going', -2, 'event_rsvps', OLD.id);
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists on_rsvp_deleted_points on public.event_rsvps;
create trigger on_rsvp_deleted_points
  after delete on public.event_rsvps
  for each row execute procedure public.handle_rsvp_deleted_points();

-- ============================================================
-- 11. audit_logs — insert restricted to the actor's own rows
--     Drops BOTH insert policies: "Anyone can insert audit
--     log" (final.sql:431-432, WITH CHECK (true)) AND the
--     v0.9.1 §14 policy "Admins can insert audit logs" —
--     dropping only the first would leave the admin policy in
--     place, and permissive policies combine with OR, so an
--     admin could still insert rows for other users and the
--     restriction would be illusory. The single replacement
--     policy requires user_id = auth.uid().
--     Verified against the code: src/hooks/useAuditLog.js
--     always inserts user_id = the logged-in actor's own id,
--     so legitimate audit writes still pass. Guests (no
--     auth.uid()) can no longer insert audit rows — user_id
--     NULL does not satisfy auth.uid() = user_id. (No viewer
--     is built here — deferred per spec. The admin SELECT
--     policy "Admins can view audit logs" is untouched.)
-- ============================================================
drop policy if exists "Anyone can insert audit log" on public.audit_logs;
drop policy if exists "Admins can insert audit logs" on public.audit_logs;
create policy "Users insert own audit logs" on public.audit_logs
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- 12. listing_votes trigger (E-12 correction)
--     handle_listing_vote() + on_listing_vote exist in
--     final.sql:1780-1813 (auto-sets verify_type='community'
--     + is_verified=true at >= 10 votes) but were ABSENT from
--     the v0.9.1 migration, so a DB converged from v0.9.1
--     alone never got the 10-vote badge. Function body copied
--     VERBATIM from final.sql (only the function name is
--     schema-qualified as public.handle_listing_vote() so the
--     trigger below can never miss it if search_path differs);
--     only the trigger creation is wrapped in a DO block so
--     the migration does not abort on a DB whose listing_votes
--     table predates that final.sql section; the function
--     itself is safe to create regardless). Defensive column
--     guards for the two listings columns the function writes
--     are included.
-- ============================================================
alter table public.listings
  add column if not exists verify_type text
  check (verify_type in ('owner', 'community', 'cherry', 'none')) default 'none';
alter table public.listings
  add column if not exists community_votes int default 0;

create or replace function public.handle_listing_vote()
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

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'listing_votes' and c.relkind = 'r'
  ) then
    drop trigger if exists on_listing_vote on public.listing_votes;
    create trigger on_listing_vote
      after insert or delete on public.listing_votes
      for each row execute procedure public.handle_listing_vote();
  else
    raise notice '9.3 §12: listing_votes table not found — on_listing_vote trigger NOT created; create the table (final.sql) and re-run this migration.';
  end if;
end $$;

-- ============================================================
-- 13. v0.9.1 CONVERGENCE — every item below is copied from
--     supabase-migration-v0.9.1.sql, guarded so it is a no-op
--     if that migration was already applied. A live DB where
--     v0.9.1 was never run gets all of these; a DB where it
--     was run gets none of them twice.
--     DELIBERATELY NOT re-copied from v0.9.1:
--       * §7 "Users insert own points" — §10 above removes
--         ALL client INSERT policies on user_points on purpose.
--       * §14 "Admins can insert audit logs" — §11 above
--         replaces it with the own-row-only policy on purpose.
-- ============================================================

-- 13a. prevent_role_escalation (v0.9.1 §1, verbatim) + the two
--      profiles UPDATE policies from the same section.
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

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can update other profiles" on public.profiles;
create policy "Admins can update other profiles" on public.profiles
  for update using (public.is_admin_or_above() and auth.uid() <> id)
  with check (public.is_admin_or_above() and auth.uid() <> id);

-- 13b. saved_places table (v0.9.1 §2, verbatim) + RLS.
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

create index if not exists saved_places_user_idx on public.saved_places(user_id);

alter table public.saved_places enable row level security;

drop policy if exists "Users see own saved places" on public.saved_places;
create policy "Users see own saved places" on public.saved_places
  for select using (auth.uid() = user_id);
drop policy if exists "Users manage own saved places" on public.saved_places;
create policy "Users manage own saved places" on public.saved_places
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 13c. chat_rooms.sort_order (v0.9.1 §5, verbatim).
alter table public.chat_rooms add column if not exists sort_order int default 0;

-- 13d. Owner listing-delete policy (v0.9.1 §6, verbatim).
--      NOTE: the policy name in v0.9.1 is "Owner can delete own
--      listing" (singular "Owner") — the v9.3 spec paraphrased
--      it as "Owners can delete own listing"; the v0.9.1
--      spelling is used here so DROP IF EXISTS converges.
drop policy if exists "Owner can delete own listing" on public.listings;
create policy "Owner can delete own listing" on public.listings
  for delete using (auth.uid() = submitted_by or auth.uid() = owner_id);

-- 13e. reports table + listing_reports view (v0.9.1 §9, verbatim
--      including the 42809 table-backup-rename guard).
--      The reports table is included because the view selects
--      from it — on a never-migrated DB the view alone would
--      fail to create. Status uses 'reviewed' (not 'resolved').
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

-- 13f. Points triggers (v0.9.1 §11, verbatim).
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

-- 13g. notifications table + listing-approved notification
--      trigger (v0.9.1 §12, verbatim).
--      NOTE: v0.9.1 contains NO listing_rejected notification
--      trigger (verified by grep — the string
--      'listing_rejected' appears nowhere in v0.9.1 or
--      supabase-schema-fix.sql). The 'listing_rejected' type
--      is used by the NEW claim trigger in §9b above instead.
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
drop policy if exists "Users insert own notifications" on public.notifications;
create policy "Users insert own notifications" on public.notifications
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

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
-- 14. increment_listing_views(id) SECURITY DEFINER RPC (E-11)
--     Guests must be able to call it (view counts come from
--     anonymous browsing too), so EXECUTE is granted to anon
--     AND authenticated. The function does exactly one thing:
--     view_count + 1 for one listing — no RLS bypass beyond
--     that single increment. Returns the new count, or NULL
--     when no listing with that id exists.
-- ============================================================
alter table public.listings add column if not exists view_count int default 0;

create or replace function public.increment_listing_views(p_listing_id uuid)
returns int as $$
declare
  v_count int;
begin
  update public.listings
  set view_count = coalesce(view_count, 0) + 1
  where id = p_listing_id
  returning view_count into v_count;
  return v_count;
end;
$$ language plpgsql security definer;

revoke execute on function public.increment_listing_views(uuid) from public;
grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

-- ============================================================
-- 15. H-M6: handle_claim_approved sets verify_type='owner'
--     Copied from final.sql handle_claim_approved() (the
--     function spans ~:367-400; the spec's ":367-375" covers
--     only its approve branch) with ONE addition:
--     verify_type = 'owner' alongside the existing
--     is_verified = true + owner_id assignment in the approve
--     branch. The reject/revoke branch is byte-identical to
--     final.sql. This is consistent with handle_listing_vote()
--     (§12), which keeps verify_type='owner' once set.
-- ============================================================
create or replace function public.handle_claim_approved()
returns trigger as $$
begin
  if NEW.status = 'approved' and OLD.status != 'approved' then
    update listings
    set
      is_verified = true,
      verify_type = 'owner',
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

drop trigger if exists on_claim_status_change on listing_claims;
create trigger on_claim_status_change
  after update on public.listing_claims
  for each row execute procedure public.handle_claim_approved();

-- ============================================================
-- 16. C-14 defence-in-depth: profiles role/points cannot be
--     changed by a direct client UPDATE
--     APPROACH USED: BEFORE UPDATE trigger (not a policy
--     WITH CHECK). A Postgres RLS policy cannot express this:
--     in a policy, USING sees the OLD row and WITH CHECK sees
--     the NEW row, and there are no OLD/NEW qualifiers to
--     compare the two — so "NEW.role = OLD.role" is not valid
--     in a WITH CHECK clause. The trigger below is the valid,
--     idempotent form.
--       * points: blocked on any direct (depth-1) UPDATE.
--         The ONLY legitimate writer is sync_user_points(),
--         which runs inside the user_points trigger — its
--         UPDATE on profiles fires this trigger at depth >= 2,
--         so the pg_trigger_depth() carve-out lets it through
--         (same pattern as final.sql's
--         prevent_listing_field_escalation). No code in src/
--         updates profiles.points directly (verified by grep).
--       * role: blocked for everyone except super_admin,
--         mirroring prevent_role_escalation (§13a) so a future
--         policy change can never reopen the hole.
-- ============================================================
alter table public.profiles add column if not exists points int default 0;

create or replace function public.prevent_profile_privilege_change()
returns trigger as $$
begin
  if NEW.points is distinct from OLD.points and pg_trigger_depth() = 1 then
    raise exception 'points ကို တိုက်ရိုက် ပြောင်းလို့မရပါ';
  end if;
  if NEW.role is distinct from OLD.role and not public.is_super_admin() then
    raise exception 'Role ကို Super Admin သာ ပြောင်းနိုင်သည်';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_profile_privilege_change on public.profiles;
create trigger prevent_profile_privilege_change
  before update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_change();

-- ============================================================
-- 17. .gitignore — NOT SQL. The one-line exception
--     !supabase-migration-9.3.sql is added to .gitignore next
--     to the existing !supabase-migration-v0.9.1.sql line (the
--     repo ignores supabase-*.sql). It is a separate file edit,
--     not part of this SQL file.
-- ============================================================
-- ============================================================
-- 18. listing_claims — claimant re-submit UPDATE policy (C-10,
--     verification catch). The 9.3 code re-opens a rejected claim
--     by UPDATEing the same row to pending, but listing_claims had
--     only select-own / insert-own / admin-for-all policies — the
--     UPDATE was refused by RLS. This policy lets a claimant
--     re-submit ONLY their own rejected row, and ONLY back to
--     pending (USING checks the old row, WITH CHECK the new row).
-- ============================================================
drop policy if exists "Claimants can re-submit own rejected claim" on public.listing_claims;
create policy "Claimants can re-submit own rejected claim" on public.listing_claims
  for update
  using (auth.uid() = user_id and status = 'rejected')
  with check (auth.uid() = user_id and status = 'pending');

-- ============================================================
-- 19. bulk_imports — widen the status CHECK (H-M3/H-L2,
--     verification catch). The 9.3 code writes 'partial' (some
--     rows failed) and 'cancelled' (user cancelled mid-run), but
--     the original inline CHECK only allows
--     ('processing','done','failed'), so those writes were refused
--     and the row stayed stuck on 'processing'. The inline CHECK
--     has an auto-generated name, so find it by its definition,
--     drop it, and re-add it with the two new values. Idempotent:
--     on re-run the definition already contains 'partial', so
--     nothing is dropped.
-- ============================================================
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.bulk_imports'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%processing%'
    and pg_get_constraintdef(oid) not like '%partial%';
  if v_conname is not null then
    execute 'alter table public.bulk_imports drop constraint ' || quote_ident(v_conname);
    alter table public.bulk_imports
      add constraint bulk_imports_status_check
      check (status in ('processing','done','failed','partial','cancelled'));
  end if;
exception
  when check_violation then
    raise notice '9.3 §19: bulk_imports status CHECK NOT widened — live rows contain a status outside the new list. Audit with: select status, count(*) from public.bulk_imports group by 1; clean up, then re-run this migration.';
end $$;

-- ============================================================
-- 20. menu_items — guest submit can attach menu items (C-9,
--     verification catch). The "Owner can manage menu items"
--     policy requires owner_id/submitted_by = auth.uid(), so a
--     guest submission (submitted_by NULL, no session) could never
--     insert its menu items. This policy allows inserts only on
--     a PENDING guest listing (submitted_by IS NULL) — the items
--     only become visible when an admin approves the listing, the
--     same trust model as the guest listing submit itself.
-- ============================================================
drop policy if exists "Guests can add menu items to pending guest listings" on public.menu_items;
create policy "Guests can add menu items to pending guest listings" on public.menu_items
  for insert
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.status = 'pending'
        and l.submitted_by is null
    )
  );

-- ============================================================
-- 21. reports — keep listings.report_count in sync (C-7,
--     verification catch). The 9.3 code increments report_count
--     from the client, but guests cannot UPDATE listings under
--     RLS, so the count never moved for guest reports. A
--     SECURITY DEFINER trigger does it server-side on every
--     report insert. The column itself is added idempotently
--     first (v0.9.1 migration §:361 added it, but the 9.3
--     migration must not assume that migration was applied live).
-- ============================================================
alter table public.listings add column if not exists report_count int default 0;

create or replace function public.handle_report_created()
returns trigger as $$
begin
  if NEW.target_type = 'listing' and NEW.target_id is not null then
    update public.listings
    set report_count = coalesce(report_count, 0) + 1
    where id = NEW.target_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_report_created on public.reports;
create trigger on_report_created
  after insert on public.reports
  for each row execute procedure public.handle_report_created();

-- End of Cherry Directory v9.3 migration.
