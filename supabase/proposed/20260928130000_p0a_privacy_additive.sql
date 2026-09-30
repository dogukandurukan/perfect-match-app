-- P0-A privacy remediation — ADDITIVE, compatible with the current app.
-- PROPOSED, NOT APPLIED. Lives in supabase/proposed/ so no CLI command can
-- apply it by accident. Apply only per docs/tempa/P0_PRIVACY_REMEDIATION.md §5
-- (`supabase db query --linked -f <file>`, never `db push`), then
-- `NOTIFY pgrst, 'reload schema';`.
--
-- Revision 3 (2026-09-30): owner product decisions — hidden profiles only
-- stay visible to accepted (mutual) matches; blocking hides everything (the
-- unblock list gets first name only); chat needs mutual consent for everyone;
-- "Looking for" (intent) on the card; no district signal ("Nearby",
-- "near both of you", same-district filter).
-- Revision 2 (2026-09-29): verified against a replica built from the live
-- catalog (real function bodies, policies, grants) over real PostgREST HTTP
-- (supabase/proposed/tests/http_p0.test.mjs).
--
-- Closes immediately (no client change needed):
--   1. INSERT bypass of the column lockdown on profiles (server-owned fields
--      such as photo_verified / is_premium / waitlist_* / deleted_at could be
--      set by creating the row).
--   2. setup_completed=true without the core fields; selfie path outside the
--      caller's own folder.
--   3. Client-forged match state: a user could set status='accepted' /
--      chat_opened=true / invited_by on ANY of their own matches rows
--      (including rows they created themselves), which (a) opened a chat and
--      messaging with any discoverable user without consent and (b) made a
--      hidden profile readable through the "has a matches row" branch.
--   4. Receiver/sender rewriting message content, notification text, likes'
--      server fields, reports after the fact.
--   5. Anonymous and cross-user LISTING of the public `user-photos` bucket.
--   6. All anon write/TRUNCATE grants on public tables (no pre-login client
--      path uses them; RLS already blocked most of it).
-- Prepares (used by the R-P0 client update, enforced by P0-B):
--   7. public.can_view_profile() — the single visibility rule.
--   8. public.profile_cards — the only read path for OTHER users: public
--      columns, computed age, NO district / DOB / private or account fields.
--   9. get_discovery_cards / get_my_liker_cards / get_date_venue_suggestions.

begin;

-- ---------------------------------------------------------------------------
-- 0. Grants hygiene (no client uses these)
-- ---------------------------------------------------------------------------
-- TRUNCATE ignores RLS; TRIGGER/REFERENCES are never needed by clients.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
-- anon: nothing in the app reads or writes public tables before sign-in.
revoke insert, update, delete on all tables in schema public from anon;
revoke select on public.profiles, public.matches, public.messages, public.likes,
  public.notifications, public.onboarding_answers, public.blocks, public.reports
  from anon;
-- venues: read-only reference data.
revoke insert, update, delete on public.venues from authenticated;

-- ---------------------------------------------------------------------------
-- 1. profiles: INSERT allowlist = UPDATE allowlist
-- ---------------------------------------------------------------------------
revoke insert on public.profiles from authenticated;
grant insert (
  id,
  first_name, last_name, full_address, city, district, discovery_max_distance,
  lat, lng, gender, meeting_preferences, languages, date_of_birth, zodiac_sign,
  photos, phone_number, dial_code, country_code, instagram_handle,
  verification_selfie_path, current_step,
  morning_night, recharge_style, hobbies, drinking, smoking, education,
  education_detail, occupation, height_cm, pets,
  availability_days, availability_hours, meeting_environment, favorite_spots,
  preferred_locations, first_date_expectation, bio, setup_completed,
  favorite_music, favorite_movie, favorite_book, favorite_activity,
  core_value, impressed_by, dealbreaker,
  discovery_age_min, discovery_age_max, notify_new_match, notify_messages,
  notify_meeting_invite, is_hidden, hide_location, discovery_verified_only,
  discovery_nonsmokers_only, discovery_height_min, discovery_height_max,
  discovery_zodiac_signs, discovery_pets, discovery_education,
  discovery_active_today,
  expo_push_token, quick_icebreaker_answers, privacy_consent_at, last_active_at
) on public.profiles to authenticated;
-- Not insertable by clients: photo_verified, is_premium, waitlist_number,
-- waitlist_boost, daily_views_*, daily_invites_*, deleted_at, phone_verified,
-- setup1_completed, username, religion, discovery_religion, neighborhoods,
-- vibe, created_at, updated_at.

-- SECURITY INVOKER on purpose: current_user is the caller's role, so
-- service_role / postgres (reviewers, migrations, Edge Functions and the
-- existing SECURITY DEFINER functions) are exempt.
create or replace function public.guard_profile_client_writes()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if coalesce(new.setup_completed, false)
     and (tg_op = 'INSERT' or coalesce(old.setup_completed, false) = false) then
    if coalesce(btrim(new.first_name), '') = ''
       or new.date_of_birth is null
       or new.date_of_birth > (current_date - interval '18 years')
       or new.gender is null
       or coalesce(btrim(new.city), '') = ''
       or coalesce(array_length(new.meeting_preferences, 1), 0) = 0 then
      raise exception 'setup_incomplete' using errcode = '23514',
        hint = 'first name, 18+ date of birth, gender, city and interested-in are required';
    end if;
  end if;

  -- "Same district / neighbourhood" discovery would tell you where every
  -- card lives; it is no longer offered (owner decision 2026-09-30).
  if new.discovery_max_distance in ('same_district', 'same_neighborhood') then
    new.discovery_max_distance := 'whole_city';
  end if;

  if new.verification_selfie_path is not null
     and (tg_op = 'INSERT' or new.verification_selfie_path is distinct from old.verification_selfie_path)
     and split_part(new.verification_selfie_path, '/', 1) <> coalesce(auth.uid()::text, '') then
    raise exception 'invalid_selfie_path' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_client_writes on public.profiles;
create trigger profiles_guard_client_writes
  before insert or update on public.profiles
  for each row execute function public.guard_profile_client_writes();

-- ---------------------------------------------------------------------------
-- 2. The visibility rule (one place: view, RPCs and guards all use it)
-- ---------------------------------------------------------------------------
-- p_viewer may see p_target's PUBLIC card when:
--   - it is their own profile; or
--   - nobody blocked anybody in the pair (blocking wins over everything,
--     in both directions), the target is not deleted, and either
--       * the target is discoverable (setup completed, not hidden), or
--       * the pair has an ACCEPTED (mutual) match — invite accepted or
--         mutual like. A pending invite or a one-sided like grants nothing.
-- Blocked people are not visible even to the blocker; the unblock list uses
-- get_my_blocked_users() (first name only).
create or replace function public.can_view_profile(p_viewer uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_viewer is not null and p_target is not null and (
    p_viewer = p_target
    or (
      not exists (
        select 1 from blocks b
        where (b.blocker_id = p_viewer and b.blocked_id = p_target)
           or (b.blocker_id = p_target and b.blocked_id = p_viewer))
      and exists (
        select 1 from profiles t
        where t.id = p_target
          and t.deleted_at is null
          and (
            (coalesce(t.setup_completed, false) and coalesce(t.is_hidden, false) = false)
            or exists (
              select 1 from matches m
              where least(m.user_a_id::text, m.user_b_id::text) = least(p_viewer::text, p_target::text)
                and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(p_viewer::text, p_target::text)
                and m.status = 'accepted')
          )))
  );
$$;
revoke all on function public.can_view_profile(uuid, uuid) from public, anon, authenticated;

-- Functions referenced by a view are EXECUTE-checked as the CALLER (not the
-- view owner). Granting the 2-argument rule to clients would turn it into an
-- oracle ("can B see D?" ⇒ do B and D have a match/like?). Clients get only
-- this caller-bound form, which answers nothing profile_cards doesn't.
create or replace function public.can_view_profile_as_me(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.can_view_profile(auth.uid(), p_target) $$;
revoke all on function public.can_view_profile_as_me(uuid) from public, anon, authenticated;
grant execute on function public.can_view_profile_as_me(uuid) to authenticated;

-- Internal helpers called from the INVOKER guards below (so the caller role
-- needs EXECUTE). Each answers only about the caller's own relationships.
create or replace function public.can_like_internal(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and p_target <> auth.uid()
     and not exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_target)
     and public.can_view_profile(auth.uid(), p_target)
$$;

revoke all on function public.can_like_internal(uuid) from public, anon, authenticated;
grant execute on function public.can_like_internal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Write guards: matches / likes / messages / notifications / reports
-- ---------------------------------------------------------------------------
-- matches: clients keep the columns they write today, but transitions that
-- carry consent or server meaning are checked here. Server code (SECURITY
-- DEFINER triggers/RPCs run as postgres, service role, pg_cron) is exempt.
create or replace function public.guard_match_client_writes()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if v_me is null or v_me not in (new.user_a_id, new.user_b_id) then
    raise exception 'not_a_participant' using errcode = '42501';
  end if;
  v_other := case when new.user_a_id = v_me then new.user_b_id else new.user_a_id end;

  if tg_op = 'INSERT' then
    -- Only a fresh candidate row, and only towards someone the caller could
    -- actually discover (not hidden / deleted / incomplete / blocked).
    if new.status <> 'pending' or new.chat_opened is true or new.invited_by is not null
       or new.source <> 'algo_invite' or new.user_a_accepted or new.user_b_accepted
       or new.meeting_at is not null or new.meetup_proposed_by is not null
       or new.meetup_confirmed is not null or new.checkin_a is not null
       or new.checkin_b is not null or coalesce(new.checkin_confirmed, false)
       or new.date_rating_a is not null or new.date_rating_b is not null
       or new.expires_at > now() + interval '48 hours' then
      raise exception 'invalid_new_match' using errcode = '42501';
    end if;
    if not public.can_like_internal(v_other) then
      raise exception 'target_not_visible' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  if new.id <> old.id or new.user_a_id <> old.user_a_id or new.user_b_id <> old.user_b_id
     or new.source is distinct from old.source
     or new.user_a_accepted is distinct from old.user_a_accepted
     or new.user_b_accepted is distinct from old.user_b_accepted then
    raise exception 'immutable_match_field' using errcode = '42501';
  end if;

  -- Revive of an EXPIRED row as a fresh candidate (upsert_match's ON
  -- CONFLICT branch): normalise it so a stale invite / chat / meetup cannot
  -- come back to life on the revived row.
  if old.status = 'expired' and new.status = 'pending' then
    if new.expires_at > now() + interval '48 hours' then
      raise exception 'expires_at_too_far' using errcode = '42501';
    end if;
    new.invited_by := null;
    new.chat_opened := false;
    new.user_a_intro_answers := null;
    new.user_b_intro_answers := null;
    new.meeting_at := null;
    new.confirmed_place := null;
    new.confirmed_slot := null;
    new.meetup_proposed_by := null;
    new.meetup_confirmed := null;
    return new;
  end if;

  -- Candidate-stage fields (score / TTL / revive timestamp) only before any invite.
  if new.match_score is distinct from old.match_score
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    if old.invited_by is not null then
      raise exception 'match_already_invited' using errcode = '42501';
    end if;
    if new.expires_at > now() + interval '48 hours' then
      raise exception 'expires_at_too_far' using errcode = '42501';
    end if;
  end if;

  -- invited_by: set once, to the caller, on a live pending candidate.
  if new.invited_by is distinct from old.invited_by then
    if old.invited_by is not null or new.invited_by is distinct from v_me
       or old.status <> 'pending' or old.chat_opened is true then
      raise exception 'invalid_invite' using errcode = '42501';
    end if;
  end if;

  -- Mutual consent (owner decision 2026-09-30): accepting an invite IS the
  -- second consent, so it opens the chat; nothing else does. An invite write
  -- that also asks to open the chat (the old "woman opens at once" client
  -- rule) is not an error for old builds — the chat simply stays closed.
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.chat_opened := true;
  end if;
  if new.invited_by is distinct from old.invited_by and new.chat_opened is true
     and old.chat_opened is not true and new.status is distinct from 'accepted' then
    new.chat_opened := false;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      if old.invited_by is null or old.invited_by = v_me or old.status <> 'pending' then
        raise exception 'only_invitee_can_accept' using errcode = '42501';
      end if;
    elsif new.status = 'passed' then
      null; -- either side may pass
    else
      raise exception 'invalid_status_transition' using errcode = '42501';
    end if;
  end if;

  -- chat_opened changes only together with an accepted match (set above);
  -- never closed again by a client.
  if new.chat_opened is distinct from old.chat_opened then
    if new.chat_opened is not true then
      if not (new.chat_opened is false and old.chat_opened is null) then
        raise exception 'cannot_close_chat' using errcode = '42501';
      end if;
    elsif new.status is distinct from 'accepted' then
      raise exception 'chat_needs_mutual_consent' using errcode = '42501';
    end if;
  end if;

  -- Only your own side's intro / check-in / rating.
  if (new.user_a_intro_answers is distinct from old.user_a_intro_answers and v_me <> new.user_a_id)
     or (new.user_b_intro_answers is distinct from old.user_b_intro_answers and v_me <> new.user_b_id)
     or ((new.checkin_a is distinct from old.checkin_a or new.date_rating_a is distinct from old.date_rating_a)
         and v_me <> new.user_a_id)
     or ((new.checkin_b is distinct from old.checkin_b or new.date_rating_b is distinct from old.date_rating_b)
         and v_me <> new.user_b_id) then
    raise exception 'not_your_side' using errcode = '42501';
  end if;
  if (new.date_rating_a is distinct from old.date_rating_a and new.date_rating_a not between 1 and 10)
     or (new.date_rating_b is distinct from old.date_rating_b and new.date_rating_b not between 1 and 10) then
    raise exception 'invalid_rating' using errcode = '23514';
  end if;
  if coalesce(new.checkin_confirmed, false) and not coalesce(old.checkin_confirmed, false)
     and not (new.checkin_a is true and new.checkin_b is true) then
    raise exception 'checkin_not_mutual' using errcode = '42501';
  end if;

  -- Meetup proposal: only once an invite / chat exists; the proposer is the
  -- caller (or, when accepting one of the inviter's own offered times, the
  -- inviter); a proposal is confirmed only by the side that did not make it.
  if new.meeting_at is distinct from old.meeting_at
     or new.confirmed_place is distinct from old.confirmed_place
     or new.meetup_proposed_by is distinct from old.meetup_proposed_by
     or new.meetup_confirmed is distinct from old.meetup_confirmed then
    if old.invited_by is null and old.chat_opened is not true and old.status <> 'accepted' then
      raise exception 'no_invite_yet' using errcode = '42501';
    end if;
    if new.meetup_proposed_by is distinct from old.meetup_proposed_by
       and new.meetup_proposed_by is not null and new.meetup_proposed_by <> v_me
       and not (new.meetup_confirmed is true and new.meetup_proposed_by = old.invited_by) then
      raise exception 'invalid_proposer' using errcode = '42501';
    end if;
    if new.meetup_confirmed is true and old.meetup_confirmed is distinct from true
       and new.meetup_proposed_by = v_me then
      raise exception 'cannot_confirm_own_proposal' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_guard_client_writes on public.matches;
create trigger matches_guard_client_writes
  before insert or update on public.matches
  for each row execute function public.guard_match_client_writes();

-- Deleting match history is never a client action.
revoke delete on public.matches from authenticated;

-- likes: clients write only the like itself; status/match_id are server
-- state (handle_mutual_like). You can only like someone you can see.
revoke insert, update, delete on public.likes from authenticated;
grant insert (liker_id, likee_id, target_type, target_key, note, status) on public.likes to authenticated;
-- liker_id/likee_id are in the UPDATE grant only because PostgREST upserts
-- (recordLike, onConflict liker_id,likee_id) SET every payload column; the
-- guard rejects any actual change of either.
grant update (liker_id, likee_id, target_type, target_key, note, status) on public.likes to authenticated;

create or replace function public.guard_like_client_writes()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.status <> 'sent' then
    raise exception 'invalid_like_status' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.liker_id <> old.liker_id or new.likee_id <> old.likee_id
                           or new.match_id is distinct from old.match_id) then
    raise exception 'immutable_like_field' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not public.can_like_internal(new.likee_id) then
    raise exception 'target_not_visible' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists likes_guard_client_writes on public.likes;
create trigger likes_guard_client_writes
  before insert or update on public.likes
  for each row execute function public.guard_like_client_writes();

-- messages: send = (sender, receiver, content) only; the only update is the
-- receiver's read receipt. No edits of content by either side, no deletes.
revoke insert, update, delete on public.messages from authenticated;
grant insert (sender_id, receiver_id, content) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
drop policy if exists messages_update_own on public.messages;
drop policy if exists messages_update_read_receipt on public.messages;
create policy messages_update_read_receipt on public.messages
  for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- notifications: written only by the server; clients only mark them read.
revoke insert, update, delete on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- reports / blocks / events: append-only (blocks may be deleted = unblock).
revoke insert, update, delete on public.reports from authenticated;
grant insert (reporter_id, reported_id, reason, detail) on public.reports to authenticated;
revoke insert, update on public.blocks from authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;
revoke insert, update, delete on public.events from authenticated;
grant insert (user_id, name, properties) on public.events to authenticated;

-- upsert_match runs as the caller (INVOKER) and is covered by the matches
-- policies + guard; anon never needs it or pair_is_blocked.
revoke execute on function public.upsert_match(uuid, uuid, numeric) from public, anon;
revoke execute on function public.pair_is_blocked(uuid, uuid) from anon;

-- ---------------------------------------------------------------------------
-- 4. user-photos: no anonymous or cross-user LISTING
-- ---------------------------------------------------------------------------
-- The bucket stays public for now (display uses public URLs): known URLs
-- still load until photos move to a private bucket + signed URLs, which is
-- required before the closed beta (plan §3).
drop policy if exists "photos are public" on storage.objects;
drop policy if exists "Anyone can view photos" on storage.objects;
drop policy if exists "user-photos read own folder" on storage.objects;
create policy "user-photos read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Exact duplicates of "Users can upload/delete their own photos".
drop policy if exists "users can upload own photos" on storage.objects;
drop policy if exists "users can delete own photos" on storage.objects;

-- ---------------------------------------------------------------------------
-- 5. Public profile cards (other users)
-- ---------------------------------------------------------------------------
-- Owned by postgres (definer semantics). security_barrier only stops leaky
-- functions from seeing filtered rows; the AUTHORIZATION is the explicit
-- can_view_profile() predicate. Deliberately NOT included: district
-- (private), last_name, date_of_birth, phone, address, lat/lng, instagram,
-- push token, selfie path, interested-in list, discovery settings,
-- is_hidden, hide_location, setup/account/state columns.
drop view if exists public.profile_cards;
create view public.profile_cards
with (security_barrier = true) as
select
  p.id,
  p.first_name,
  case when p.date_of_birth is null then null
       else date_part('year', age(p.date_of_birth))::int end as age,
  p.zodiac_sign,
  p.city,
  p.gender,
  p.languages,
  p.morning_night,
  p.recharge_style,
  p.hobbies,
  p.drinking,
  p.smoking,
  p.pets,
  p.education,
  p.education_detail,
  p.occupation,
  p.height_cm,
  p.bio,
  p.availability_days,
  p.availability_hours,
  p.meeting_environment,
  p.favorite_spots,
  p.first_date_expectation,
  p.favorite_music,
  p.favorite_movie,
  p.favorite_book,
  p.favorite_activity,
  p.core_value,
  p.impressed_by,
  p.dealbreaker,
  p.photos,
  p.photo_verified,
  -- "Looking for" (owner decision): visible only on a card you may see.
  (select oa.intent from public.onboarding_answers oa where oa.user_id = p.id) as intent,
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        'Everyone' = any(p.meeting_preferences)
        or ('Men' = any(p.meeting_preferences) and me.gender = 'Man')
        or ('Women' = any(p.meeting_preferences) and me.gender = 'Woman')
        or ('Non-binary' = any(p.meeting_preferences) and me.gender = 'Non-binary')
      )
  ) as interested_in_viewer
from public.profiles p
where public.can_view_profile_as_me(p.id);

revoke all on public.profile_cards from public, anon, authenticated;
grant select on public.profile_cards to authenticated;
comment on view public.profile_cards is
  'P0 privacy: the only read path for OTHER users'' profiles. Rows: '
  'can_view_profile(auth.uid(), id). Columns: public card fields + age.';

-- ---------------------------------------------------------------------------
-- 6. RPCs used by the R-P0 client
-- ---------------------------------------------------------------------------
-- Discovery: same ranking/scoring as get_top_matches (body unchanged; it is
-- SECURITY DEFINER and already filters hidden/deleted/blocked/incomplete
-- and requires auth.uid() = p_user_id). Age instead of DOB, no district,
-- and no "Nearby" reason (it reveals a shared district).
create or replace function public.get_discovery_cards(p_limit integer default 10)
returns table(
  user_id uuid, first_name text, age integer, city text,
  zodiac_sign text, photos text[], match_percentage integer, match_category text,
  reasons text[], favorite_music text, favorite_movie text, favorite_book text,
  hobbies text[], availability_days text[], drinking text, smoking text,
  education text, education_detail text, morning_night text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.user_id, t.first_name,
         case when t.date_of_birth is null then null
              else date_part('year', age(t.date_of_birth))::int end,
         t.city, t.zodiac_sign, t.photos, t.match_percentage,
         t.match_category, array_remove(t.reasons, 'Nearby'), t.favorite_music, t.favorite_movie,
         t.favorite_book, t.hobbies, t.availability_days, t.drinking, t.smoking,
         t.education, t.education_detail, t.morning_night
  from public.get_top_matches(auth.uid(), p_limit) with ordinality as t(
    user_id, first_name, date_of_birth, city, district, zodiac_sign, photos,
    match_percentage, match_category, reasons, favorite_music, favorite_movie,
    favorite_book, hobbies, availability_days, drinking, smoking, education,
    education_detail, morning_night, ord)
  order by t.ord;
$$;

-- Likers: get_my_likers' premium branch also returned likers who are
-- blocked (either way) or deleted. This re-implementation keeps the same
-- premium gate and order, returns age instead of DOB, and counts/returns
-- only likers the viewer may see.
create or replace function public.get_my_liker_cards(p_limit integer default 50)
returns table(
  total_count bigint, liker_id uuid, first_name text, age integer,
  photo_path text, target_type text, target_key text, note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_premium boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select coalesce(p.is_premium, false) into v_is_premium from profiles p where p.id = v_uid;
  v_is_premium := coalesce(v_is_premium, false);

  return query
    with visible as (
      select l.liker_id, l.target_type, l.target_key, l.note, l.created_at
      from likes l
      where l.likee_id = v_uid and l.status = 'sent'
        and not exists (select 1 from blocks b where b.blocker_id = v_uid and b.blocked_id = l.liker_id)
        and public.can_view_profile(v_uid, l.liker_id)
    ), cnt as (select count(*)::bigint as n from visible)
    select cnt.n,
           case when v_is_premium then v.liker_id end,
           case when v_is_premium then p.first_name end,
           case when v_is_premium and p.date_of_birth is not null
                then date_part('year', age(p.date_of_birth))::int end,
           case when v_is_premium then p.photos[1] end,
           case when v_is_premium then v.target_type end,
           case when v_is_premium then v.target_key end,
           case when v_is_premium then v.note end,
           v.created_at
    from visible v
    join profiles p on p.id = v.liker_id
    cross join cnt
    order by v.created_at desc
    limit case when v_is_premium then greatest(p_limit, 0) else least(greatest(p_limit, 0), 3) end;
end;
$$;

-- Venues for an invite: near YOU first, then the rest. The other person's
-- district is never read, returned or used as a label ("near both of you"
-- would reveal it). p_other only has to be someone you may see.
create or replace function public.get_date_venue_suggestions(p_other uuid)
returns table(name text, district text, emoji text, reason text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with keys as (
    select lower(translate(coalesce((select district from profiles where id = auth.uid()), ''),
      'çğıöşüÇĞİÖŞÜ', 'cgiosuCGIOSU')) as md
  ), ranked as (
    select v.name, v.district, v.emoji, v.created_at,
      case when k.md <> '' and lower(translate(coalesce(v.district, ''), 'çğıöşüÇĞİÖŞÜ', 'cgiosuCGIOSU')) = k.md
           then 'you' end as reason
    from venues v cross join keys k
    where v.is_active = true
      and auth.uid() is not null
      and public.can_view_profile(auth.uid(), p_other)
  )
  select r.name, r.district, r.emoji, r.reason
  from ranked r
  order by case r.reason when 'you' then 0 else 1 end, r.created_at, r.name;
$$;

-- Unblock list: only what that list needs. No photo, no card.
create or replace function public.get_my_blocked_users()
returns table(block_id uuid, blocked_id uuid, first_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id, b.blocked_id, p.first_name, b.created_at
  from blocks b
  left join profiles p on p.id = b.blocked_id and p.deleted_at is null
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- One-time normalisation of the removed district-level filter.
update public.profiles set discovery_max_distance = 'whole_city'
where discovery_max_distance in ('same_district', 'same_neighborhood');

revoke all on function public.get_discovery_cards(integer) from public, anon;
revoke all on function public.get_my_liker_cards(integer) from public, anon;
revoke all on function public.get_date_venue_suggestions(uuid) from public, anon;
revoke all on function public.get_my_blocked_users() from public, anon;
grant execute on function public.get_discovery_cards(integer) to authenticated;
grant execute on function public.get_my_liker_cards(integer) to authenticated;
grant execute on function public.get_date_venue_suggestions(uuid) to authenticated;
grant execute on function public.get_my_blocked_users() to authenticated;
revoke all on function public.guard_profile_client_writes() from public, anon, authenticated;
revoke all on function public.guard_match_client_writes() from public, anon, authenticated;
revoke all on function public.guard_like_client_writes() from public, anon, authenticated;

commit;
