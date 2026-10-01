-- V2 match → chat → date suggestion (2026-10-01, owner decision).
--
-- Flow: mutual like → one match + open chat (existing handle_mutual_like) →
-- either side may suggest a date from the chat → the other side accepts,
-- suggests another time, or says "not now". No invitation before a match.
--
-- This package:
--   1. date_proposals_v2: one row per suggestion (pending / accepted /
--      declined / countered / cancelled). At most ONE pending suggestion per
--      match. Clients only read it (participants); every write goes through
--      the SECURITY DEFINER RPCs below.
--   2. RPCs (signed-in participants of an ACTIVE chat only — accepted, chat
--      open, no block either way, neither account deleted):
--        propose_date_v2  — idempotent per request id
--        respond_date_v2  — accept / decline / counter; never on your own
--                           suggestion; idempotent
--        unmatch_v2       — ends the match (status 'passed'), cancels a
--                           pending suggestion
--        get_my_matches_v2, get_my_date_plans_v2, get_chat_v2 — explicit,
--                           minimal fields (first name + photo path), no score
--   3. Client writes to the meetup columns of a match that has an open chat
--      are refused (they must use the RPCs); new pre-match invitations from
--      clients are refused. Existing rows are NOT changed or deleted.
--   4. Profile access / V2 discovery: a pair whose match was ended (passed)
--      is excluded; the "match" path of profile access needs an accepted
--      match. Already-matched pairs leave Discover (they are in Matches).
-- No score, no ranking, no quota change.

-- ---------------------------------------------------------------------------
-- 1. Suggestions table
-- ---------------------------------------------------------------------------
create table if not exists public.date_proposals_v2 (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  place text check (place is null or char_length(btrim(place)) between 1 and 120),
  meeting_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'countered', 'cancelled')),
  reply_to uuid references public.date_proposals_v2(id) on delete set null,
  request_id uuid not null,
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (proposed_by, request_id)
);
create unique index if not exists date_proposals_v2_one_pending
  on public.date_proposals_v2 (match_id) where status = 'pending';
create index if not exists date_proposals_v2_match on public.date_proposals_v2 (match_id, created_at);

alter table public.date_proposals_v2 enable row level security;
revoke all on public.date_proposals_v2 from anon, authenticated;
grant select on public.date_proposals_v2 to authenticated;
drop policy if exists date_proposals_v2_participants on public.date_proposals_v2;
create policy date_proposals_v2_participants on public.date_proposals_v2 for select to authenticated
  using (exists (select 1 from public.matches m
                 where m.id = match_id and auth.uid() in (m.user_a_id, m.user_b_id)));

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- An active chat for p_me: participant, accepted, chat open, no block either
-- way, neither account deleted.
create or replace function public.v2_chat_active(p_match uuid, p_me uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from matches m
    join profiles pa on pa.id = m.user_a_id
    join profiles pb on pb.id = m.user_b_id
    where m.id = p_match and p_me in (m.user_a_id, m.user_b_id)
      and m.status = 'accepted' and m.chat_opened is true
      and pa.deleted_at is null and pb.deleted_at is null
      and not exists (select 1 from blocks k
                      where (k.blocker_id = m.user_a_id and k.blocked_id = m.user_b_id)
                         or (k.blocker_id = m.user_b_id and k.blocked_id = m.user_a_id)))
$$;
revoke all on function public.v2_chat_active(uuid, uuid) from public, anon, authenticated;

create or replace function public.v2_other_of(p_match uuid, p_me uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$ select case when m.user_a_id = p_me then m.user_b_id else m.user_a_id end from matches m where m.id = p_match $$;
revoke all on function public.v2_other_of(uuid, uuid) from public, anon, authenticated;

-- First name + main photo path for a person the caller has a match with
-- (V2 answers first, V1 profile columns as the fallback for legacy rows).
create or replace function public.v2_display_name(p_user uuid)
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(nullif(btrim(o.first_name), ''), nullif(btrim(p.first_name), ''))
      from profiles p left join onboarding_v2 o on o.user_id = p.id where p.id = p_user $$;
revoke all on function public.v2_display_name(uuid) from public, anon, authenticated;

create or replace function public.v2_main_photo(p_user uuid)
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(
        (select f.storage_path from profile_photos_v2 f where f.user_id = p_user order by f.position limit 1),
        (select p.photos[1] from profiles p where p.id = p_user)) $$;
revoke all on function public.v2_main_photo(uuid) from public, anon, authenticated;

create or replace function public.v2_proposal_json(p date_proposals_v2, p_me uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$ select jsonb_build_object('id', p.id, 'match_id', p.match_id, 'mine', p.proposed_by = p_me,
        'place', p.place, 'meeting_at', p.meeting_at, 'status', p.status, 'reply_to', p.reply_to,
        'responded_at', p.responded_at, 'created_at', p.created_at) $$;
revoke all on function public.v2_proposal_json(date_proposals_v2, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reads
-- ---------------------------------------------------------------------------
create or replace function public.get_my_matches_v2()
returns table(match_id uuid, other_id uuid, first_name text, photo_path text, matched_at timestamptz,
              last_message text, last_message_at timestamptz, last_from_me boolean, unread integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  with mine as (
    select m.id, m.created_at,
           case when m.user_a_id = auth.uid() then m.user_b_id else m.user_a_id end as other
    from matches m
    where auth.uid() in (m.user_a_id, m.user_b_id)
      and public.v2_chat_active(m.id, auth.uid())
  )
  select mine.id, mine.other, public.v2_display_name(mine.other), public.v2_main_photo(mine.other), mine.created_at,
         lm.content, lm.created_at, lm.sender_id = auth.uid(),
         (select count(*)::int from messages u where u.sender_id = mine.other and u.receiver_id = auth.uid() and u.read_at is null)
  from mine
  left join lateral (
    select x.content, x.created_at, x.sender_id from messages x
    where (x.sender_id = auth.uid() and x.receiver_id = mine.other) or (x.sender_id = mine.other and x.receiver_id = auth.uid())
    order by x.created_at desc limit 1) lm on true
  order by coalesce(lm.created_at, mine.created_at) desc
$$;
revoke all on function public.get_my_matches_v2() from public, anon;
grant execute on function public.get_my_matches_v2() to authenticated;

-- Plans: pending suggestions (both directions) and accepted plans that have
-- not passed yet (6 h grace), only for active chats.
create or replace function public.get_my_date_plans_v2()
returns table(proposal_id uuid, match_id uuid, other_id uuid, first_name text, photo_path text,
              place text, meeting_at timestamptz, status text, mine boolean, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, p.match_id, public.v2_other_of(p.match_id, auth.uid()),
         public.v2_display_name(public.v2_other_of(p.match_id, auth.uid())),
         public.v2_main_photo(public.v2_other_of(p.match_id, auth.uid())),
         p.place, p.meeting_at, p.status, p.proposed_by = auth.uid(), p.created_at
  from date_proposals_v2 p
  where public.v2_chat_active(p.match_id, auth.uid())
    and (p.status = 'pending'
         or (p.status = 'accepted' and p.meeting_at > now() - interval '6 hours'
             and p.id = (select q.id from date_proposals_v2 q where q.match_id = p.match_id and q.status = 'accepted'
                         order by q.responded_at desc nulls last limit 1)))
  order by (p.status = 'pending') desc, p.meeting_at
$$;
revoke all on function public.get_my_date_plans_v2() from public, anon;
grant execute on function public.get_my_date_plans_v2() to authenticated;

-- One chat's state: active or not, plus its suggestions (for the in-chat cards).
create or replace function public.get_chat_v2(p_match uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select case when not exists (select 1 from matches m where m.id = p_match and auth.uid() in (m.user_a_id, m.user_b_id))
    then null
    else jsonb_build_object(
      'match_id', p_match,
      'active', public.v2_chat_active(p_match, auth.uid()),
      'proposals', coalesce((select jsonb_agg(public.v2_proposal_json(p, auth.uid()) order by p.created_at)
                             from date_proposals_v2 p where p.match_id = p_match), '[]'::jsonb))
  end
$$;
revoke all on function public.get_chat_v2(uuid) from public, anon;
grant execute on function public.get_chat_v2(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Actions
-- ---------------------------------------------------------------------------
create or replace function public.propose_date_v2(p_match uuid, p_meeting_at timestamptz, p_place text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_row date_proposals_v2;
  v_pending date_proposals_v2;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'request_id_required' using errcode = '22023'; end if;
  -- Same request again (double tap / retry): return what was created.
  select * into v_row from date_proposals_v2 where proposed_by = v_me and request_id = p_request_id;
  if found then return public.v2_proposal_json(v_row, v_me) || jsonb_build_object('already', true); end if;

  if not public.v2_chat_active(p_match, v_me) then raise exception 'chat_not_active' using errcode = '42501'; end if;
  if p_meeting_at is null or p_meeting_at <= now() or p_meeting_at > now() + interval '120 days' then
    raise exception 'invalid_time' using errcode = '22023';
  end if;
  perform 1 from matches where id = p_match for update; -- serialise suggestions per match
  select * into v_pending from date_proposals_v2 where match_id = p_match and status = 'pending';
  if found then
    raise exception '%', case when v_pending.proposed_by = v_me then 'proposal_pending' else 'reply_to_pending' end
      using errcode = '42501';
  end if;
  insert into date_proposals_v2 (match_id, proposed_by, place, meeting_at, request_id)
  values (p_match, v_me, nullif(btrim(p_place), ''), p_meeting_at, p_request_id)
  returning * into v_row;
  insert into notifications (user_id, type, text, related_user_id)
  values (public.v2_other_of(p_match, v_me), 'date_proposed', 'suggested a date', v_me);
  return public.v2_proposal_json(v_row, v_me) || jsonb_build_object('already', false);
end;
$$;
revoke all on function public.propose_date_v2(uuid, timestamptz, text, uuid) from public, anon;
grant execute on function public.propose_date_v2(uuid, timestamptz, text, uuid) to authenticated;

create or replace function public.respond_date_v2(p_proposal uuid, p_action text,
  p_meeting_at timestamptz default null, p_place text default null, p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_p date_proposals_v2;
  v_new date_proposals_v2;
  v_target text;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_action not in ('accept', 'decline', 'counter') then raise exception 'invalid_action' using errcode = '22023'; end if;
  v_target := case p_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'countered' end;

  select * into v_p from date_proposals_v2 where id = p_proposal for update;
  if not found or v_me not in (select unnest(array[m.user_a_id, m.user_b_id]) from matches m where m.id = v_p.match_id) then
    raise exception 'proposal_not_found' using errcode = '42501';
  end if;
  if v_p.proposed_by = v_me then raise exception 'cannot_respond_own_proposal' using errcode = '42501'; end if;

  -- Repeat of the same answer (double tap / retry): return the current state.
  if v_p.status = v_target and v_p.responded_by = v_me then
    if p_action = 'counter' then
      select * into v_new from date_proposals_v2 where reply_to = v_p.id;
      return public.v2_proposal_json(v_new, v_me) || jsonb_build_object('already', true);
    end if;
    return public.v2_proposal_json(v_p, v_me) || jsonb_build_object('already', true);
  end if;
  if v_p.status <> 'pending' then raise exception 'proposal_not_pending' using errcode = '42501'; end if;
  if not public.v2_chat_active(v_p.match_id, v_me) then raise exception 'chat_not_active' using errcode = '42501'; end if;

  if p_action = 'counter' then
    if p_request_id is null then raise exception 'request_id_required' using errcode = '22023'; end if;
    if p_meeting_at is null or p_meeting_at <= now() or p_meeting_at > now() + interval '120 days' then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
  end if;

  update date_proposals_v2 set status = v_target, responded_by = v_me, responded_at = now()
  where id = v_p.id returning * into v_p;

  if p_action = 'accept' then
    -- The agreed plan also lands on the match (existing reminder / check-in
    -- infrastructure reads these columns). Runs as the function owner, so the
    -- client-write guard does not apply.
    update matches set meeting_at = v_p.meeting_at, confirmed_place = v_p.place,
           meetup_proposed_by = v_p.proposed_by, meetup_confirmed = true,
           meetup_reminder_sent_at = null, meetup_morning_reminder_sent_at = null
    where id = v_p.match_id;
    insert into notifications (user_id, type, text, related_user_id)
    values (v_p.proposed_by, 'date_accepted', 'accepted your date', v_me);
    return public.v2_proposal_json(v_p, v_me) || jsonb_build_object('already', false);
  elsif p_action = 'counter' then
    insert into date_proposals_v2 (match_id, proposed_by, place, meeting_at, reply_to, request_id)
    values (v_p.match_id, v_me, nullif(btrim(p_place), ''), p_meeting_at, v_p.id, p_request_id)
    returning * into v_new;
    insert into notifications (user_id, type, text, related_user_id)
    values (v_p.proposed_by, 'date_proposed', 'suggested another time', v_me);
    return public.v2_proposal_json(v_new, v_me) || jsonb_build_object('already', false);
  end if;
  return public.v2_proposal_json(v_p, v_me) || jsonb_build_object('already', false);
end;
$$;
revoke all on function public.respond_date_v2(uuid, text, timestamptz, text, uuid) from public, anon;
grant execute on function public.respond_date_v2(uuid, text, timestamptz, text, uuid) to authenticated;

-- Ends a match for both sides (status 'passed'; messages, suggestions and
-- profile access stop). Idempotent. Nothing is deleted.
create or replace function public.unmatch_v2(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_me uuid := auth.uid(); v_status text;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select status into v_status from matches where id = p_match and v_me in (user_a_id, user_b_id) for update;
  if not found then raise exception 'match_not_found' using errcode = '42501'; end if;
  if v_status = 'passed' then return jsonb_build_object('status', 'passed', 'already', true); end if;
  if v_status <> 'accepted' then raise exception 'not_matched' using errcode = '42501'; end if;
  update matches set status = 'passed' where id = p_match;
  update date_proposals_v2 set status = 'cancelled', responded_by = v_me, responded_at = now()
  where match_id = p_match and status = 'pending';
  return jsonb_build_object('status', 'passed', 'already', false);
end;
$$;
revoke all on function public.unmatch_v2(uuid) from public, anon;
grant execute on function public.unmatch_v2(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Client-write guard on matches (P0-A function, two additions marked NEW)
-- ---------------------------------------------------------------------------
create or replace function public.guard_match_client_writes()
returns trigger language plpgsql set search_path = public, pg_temp
as $function$
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

  if new.id <> old.id or new.user_a_id <> old.user_a_id or new.user_b_id <> old.user_b_id
     or new.source is distinct from old.source
     or new.user_a_accepted is distinct from old.user_a_accepted
     or new.user_b_accepted is distinct from old.user_b_accepted then
    raise exception 'immutable_match_field' using errcode = '42501';
  end if;

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

  -- NEW (2026-10-01): no invitation before a match. Existing invites are kept
  -- as they are; a new one can no longer be started by a client.
  if new.invited_by is distinct from old.invited_by then
    raise exception 'invites_retired' using errcode = '42501';
  end if;

  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.chat_opened := true;
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

  if new.chat_opened is distinct from old.chat_opened then
    if new.chat_opened is not true then
      if not (new.chat_opened is false and old.chat_opened is null) then
        raise exception 'cannot_close_chat' using errcode = '42501';
      end if;
    elsif new.status is distinct from 'accepted' then
      raise exception 'chat_needs_mutual_consent' using errcode = '42501';
    end if;
  end if;

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

  if new.meeting_at is distinct from old.meeting_at
     or new.confirmed_place is distinct from old.confirmed_place
     or new.meetup_proposed_by is distinct from old.meetup_proposed_by
     or new.meetup_confirmed is distinct from old.meetup_confirmed then
    -- NEW (2026-10-01): once a chat is open, dates are suggested and accepted
    -- only through propose_date_v2 / respond_date_v2.
    if old.chat_opened is true then
      raise exception 'use_date_proposals' using errcode = '42501';
    end if;
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
$function$;

-- ---------------------------------------------------------------------------
-- 6. Profile access + V2 discovery: ended matches stay ended
-- ---------------------------------------------------------------------------
create or replace function public.v2_pair_has_match(p_a uuid, p_b uuid, p_status text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from matches m
        where least(m.user_a_id::text, m.user_b_id::text) = least(p_a::text, p_b::text)
          and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(p_a::text, p_b::text)
          and m.status = p_status) $$;
revoke all on function public.v2_pair_has_match(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.v2_can_view_public_profile(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select p_viewer is not null and p_target is not null and (
    p_viewer = p_target
    or (public.is_active_v2_member(p_viewer)
        and public.is_active_v2_member(p_target)
        and public.can_view_profile(p_viewer, p_target)
        and not public.v2_pair_has_match(p_viewer, p_target, 'passed')
        and (public.v2_pair_eligible(p_viewer, p_target)
             or public.v2_pair_has_match(p_viewer, p_target, 'accepted'))))
$$;
revoke all on function public.v2_can_view_public_profile(uuid, uuid) from public, anon, authenticated;

-- Same as 20260930140000 plus one rule: pairs that already have an accepted
-- (in Matches) or ended (passed) match are not shown again. Fixed order, no score.
create or replace function public.get_discovery_candidates_v2(p_limit integer default 20)
returns table(user_id uuid, first_name text, age integer, city text, photo_paths text[])
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (
    select o.user_id, o.gender, o.interested_in, o.date_of_birth, o.location_city,
           coalesce(p.discovery_age_min, 18) as amin, coalesce(p.discovery_age_max, 120) as amax
    from onboarding_v2 o join profiles p on p.id = o.user_id
    where o.user_id = auth.uid() and public.is_active_v2_member(auth.uid())
  )
  select c.user_id, c.first_name,
         date_part('year', age(c.date_of_birth))::int,
         c.location_city,
         (select array_agg(f.storage_path order by f.position) from profile_photos_v2 f where f.user_id = c.user_id)
  from onboarding_v2 c
  join profiles cp on cp.id = c.user_id
  cross join me
  where c.user_id <> me.user_id
    and public.is_active_v2_member(c.user_id)
    and coalesce(cp.is_hidden, false) = false
    and cp.deleted_at is null
    and not exists (select 1 from blocks b
                    where (b.blocker_id = me.user_id and b.blocked_id = c.user_id)
                       or (b.blocker_id = c.user_id and b.blocked_id = me.user_id))
    and not exists (select 1 from matches m
                    where least(m.user_a_id::text, m.user_b_id::text) = least(me.user_id::text, c.user_id::text)
                      and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(me.user_id::text, c.user_id::text)
                      and m.status in ('accepted', 'passed'))
    and public.v2_wants(me.interested_in, c.gender)
    and public.v2_wants(c.interested_in, me.gender)
    and date_part('year', age(c.date_of_birth)) between me.amin and me.amax
    and date_part('year', age(me.date_of_birth)) between coalesce(cp.discovery_age_min, 18) and coalesce(cp.discovery_age_max, 120)
    and lower(btrim(c.location_city)) = lower(btrim(me.location_city))
  order by c.user_id
  limit greatest(least(coalesce(p_limit, 20), 100), 0)
$$;
revoke all on function public.get_discovery_candidates_v2(integer) from public, anon;
grant execute on function public.get_discovery_candidates_v2(integer) to authenticated;
