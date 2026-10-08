-- V2 Matches: server-owned daily picks + featured mutual match, like source,
-- no automatic messages from like notes, suspension modelled separately
-- (owner decisions 2026-10-08, D61–D66 + Matches integration decisions).
--
-- NOT applied to the shared remote project (DEV = live). Verified only on
-- the local replica: supabase/proposed/tests/http_matches.test.mjs.
--
--  1. Suspension = account_state_v2.membership_status = 'suspended' (an
--     explicit value; "not active" in general is NOT suspension). A suspended
--     account: no new interaction (already: not an active member), no
--     messaging (chat state 'unavailable', message inserts refused); the
--     other participant can still read the history ("Account unavailable").
--  2. Hidden (profiles.is_hidden, the user's own choice): out of discovery and
--     daily picks (already via v2_pair_eligible), existing chats continue.
--     Profile access is not opened to everyone.
--  3. Daily period: ((now() at time zone 'Europe/Istanbul') - 12 h)::date,
--     i.e. it changes at 12:00 Istanbul. One row per user and period in
--     daily_picks_v2 (no client access), created on first read under a
--     per-user lock; re-opening, concurrent requests or the device clock
--     never change it. A person who becomes unavailable mid-period is not
--     replaced until the next period.
--     Pick (TEMPORARY rule — not a compatibility score): mutual eligibility
--     (v2_pair_eligible) minus any match row, anyone I liked, anyone ever
--     featured to me as a pick, and the featured mutual; ordered by a stable
--     per-user/per-period hash (random, reproducible).
--     Featured mutual: my active, visible (not hidden, active member) matches
--     with no message in the pair; never-featured first, then least recently
--     featured, ties → older match. May repeat when it is the only one.
--  4. Today's pick is excluded from Discover; Discover first ensures today's
--     row, so which tab opens first never changes the result.
--  5. likes.source ('discover' | 'daily_pick', NULL = unknown/old) and
--     likes.pick_period, validated in send_like_v2: 'daily_pick' only for the
--     CURRENT period's pick; an outdated pick (or a stale Discover card that
--     became today's pick) is refused with 'stale_pick' before any like or
--     quota is spent. Old rows are not backfilled.
--  6. handle_mutual_like: for a V2 pair the notes are no longer copied into
--     messages (V1 unchanged); get_chat_v2 returns them as `likes` context
--     (which photo / prompt, who sent it). Existing messages are untouched.

-- 1/2. Suspension --------------------------------------------------------------
create or replace function public.v2_is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from account_state_v2 s where s.user_id = p_user and s.membership_status = 'suspended') $$;

-- For RLS: answers only for a pair the caller belongs to (no oracle).
create or replace function public.v2_pair_has_suspended(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select case when auth.uid() is distinct from a and auth.uid() is distinct from b then false
              else public.v2_is_suspended(a) or public.v2_is_suspended(b) end
$$;

-- 'active' | 'unavailable' (a participant is suspended; history readable) | 'ended'
create or replace function public.v2_chat_state(p_match uuid, p_me uuid)
returns text language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not exists (
      select 1 from matches m
      join profiles pa on pa.id = m.user_a_id
      join profiles pb on pb.id = m.user_b_id
      where m.id = p_match and p_me in (m.user_a_id, m.user_b_id)
        and m.status = 'accepted' and m.chat_opened is true
        and pa.deleted_at is null and pb.deleted_at is null
        and not exists (select 1 from blocks k
                        where (k.blocker_id = m.user_a_id and k.blocked_id = m.user_b_id)
                           or (k.blocker_id = m.user_b_id and k.blocked_id = m.user_a_id))) then 'ended'
    when exists (select 1 from matches m where m.id = p_match
                 and (public.v2_is_suspended(m.user_a_id) or public.v2_is_suspended(m.user_b_id))) then 'unavailable'
    else 'active' end
$$;

-- Active = messaging allowed: now also false when a participant is suspended.
create or replace function public.v2_chat_active(p_match uuid, p_me uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.v2_chat_state(p_match, p_me) = 'active' $$;

-- Messages: no new message to / from a suspended account (V1 accounts have no
-- account_state_v2 row → unaffected).
drop policy if exists messages_insert_policy on public.messages;
create policy messages_insert_policy on public.messages for insert to public
with check (
  auth.uid() = sender_id
  and not public.pair_is_blocked(sender_id, receiver_id)
  and not public.v2_pair_has_suspended(sender_id, receiver_id)
  and exists (select 1 from matches
              where matches.status = 'accepted'
                and ((matches.user_a_id = auth.uid() and matches.user_b_id = messages.receiver_id)
                  or (matches.user_b_id = auth.uid() and matches.user_a_id = messages.receiver_id))));

-- Chats list: active chats + chats with a suspended account (read-only).
drop function if exists public.get_my_matches_v2();
create function public.get_my_matches_v2()
returns table(match_id uuid, other_id uuid, first_name text, photo_path text, matched_at timestamptz,
              last_message text, last_message_at timestamptz, last_from_me boolean, unread integer, unavailable boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  with mine as (
    select m.id, m.created_at,
           case when m.user_a_id = auth.uid() then m.user_b_id else m.user_a_id end as other,
           public.v2_chat_state(m.id, auth.uid()) as st
    from matches m
    where auth.uid() in (m.user_a_id, m.user_b_id)
  )
  select mine.id, mine.other, public.v2_display_name(mine.other),
         case when mine.st = 'unavailable' then null else public.v2_main_photo(mine.other) end,
         mine.created_at, lm.content, lm.created_at, lm.sender_id = auth.uid(),
         (select count(*)::int from messages u where u.sender_id = mine.other and u.receiver_id = auth.uid() and u.read_at is null),
         mine.st = 'unavailable'
  from mine
  left join lateral (
    select x.content, x.created_at, x.sender_id from messages x
    where (x.sender_id = auth.uid() and x.receiver_id = mine.other) or (x.sender_id = mine.other and x.receiver_id = auth.uid())
    order by x.created_at desc limit 1) lm on true
  where mine.st in ('active', 'unavailable')
  order by coalesce(lm.created_at, mine.created_at) desc
$$;

-- 5. Like source ----------------------------------------------------------------
alter table public.likes add column if not exists source text;
alter table public.likes add column if not exists pick_period date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'likes_source_check') then
    alter table public.likes add constraint likes_source_check check (source is null or source in ('discover', 'daily_pick'));
  end if;
end $$;

-- 3. Daily period + picks -------------------------------------------------------
create or replace function public.v2_pick_period(p_at timestamptz)
returns date language sql stable set search_path = public, pg_temp
as $$ select ((p_at at time zone 'Europe/Istanbul') - interval '12 hours')::date $$;

create or replace function public.v2_pick_refresh_at(p_period date)
returns timestamptz language sql stable set search_path = public, pg_temp
as $$ select ((p_period + 1)::timestamp + time '12:00') at time zone 'Europe/Istanbul' $$;

create table if not exists public.daily_picks_v2 (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period date not null,
  pick_user_id uuid references public.profiles(id) on delete set null,
  mutual_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, period)
);
create index if not exists daily_picks_v2_pick on public.daily_picks_v2 (user_id, pick_user_id);
create index if not exists daily_picks_v2_mutual on public.daily_picks_v2 (user_id, mutual_user_id);
alter table public.daily_picks_v2 enable row level security;
revoke all on public.daily_picks_v2 from public, anon, authenticated;

-- The pair's messages exist (any sender). Historic V1-style seeded notes
-- count as messages: they can't be told apart reliably.
create or replace function public.v2_pair_has_messages(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from messages g
                     where (g.sender_id = p_a and g.receiver_id = p_b) or (g.sender_id = p_b and g.receiver_id = p_a)) $$;

create or replace function public.v2_active_match_id(p_me uuid, p_other uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$
  select m.id from matches m
  where least(m.user_a_id::text, m.user_b_id::text) = least(p_me::text, p_other::text)
    and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(p_me::text, p_other::text)
    and public.v2_chat_active(m.id, p_me)
  limit 1
$$;

-- Creates (once) and returns the caller's row for the period of p_at.
create or replace function public.v2_ensure_daily_picks(p_user uuid, p_at timestamptz)
returns public.daily_picks_v2 language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_period date := public.v2_pick_period(p_at);
  r public.daily_picks_v2;
  v_pick uuid;
  v_mutual uuid;
begin
  select * into r from daily_picks_v2 where user_id = p_user and period = v_period;
  if found then return r; end if;
  if p_user is null or not public.is_active_v2_member(p_user) then return null; end if;
  -- One creator per user at a time; a concurrent request waits, then reads.
  perform pg_advisory_xact_lock(hashtextextended('daily_picks_v2:' || p_user::text, 11));
  select * into r from daily_picks_v2 where user_id = p_user and period = v_period;
  if found then return r; end if;

  -- Featured mutual: active, visible matches with no message yet.
  select x.other into v_mutual
  from (
    select case when m.user_a_id = p_user then m.user_b_id else m.user_a_id end as other, m.created_at
    from matches m
    where p_user in (m.user_a_id, m.user_b_id) and public.v2_chat_active(m.id, p_user)
  ) x
  join profiles op on op.id = x.other
  where coalesce(op.is_hidden, false) = false
    and op.deleted_at is null
    and public.is_active_v2_member(x.other)
    and not public.v2_pair_has_messages(p_user, x.other)
  order by (select max(d.period) from daily_picks_v2 d where d.user_id = p_user and d.mutual_user_id = x.other) asc nulls first,
           x.created_at asc, x.other
  limit 1;

  -- Pick (temporary rule: stable per-user/per-period random, NOT a score).
  select c.user_id into v_pick
  from onboarding_v2 c
  where c.user_id <> p_user
    and public.v2_pair_eligible(p_user, c.user_id)
    and not exists (select 1 from matches m
                    where least(m.user_a_id::text, m.user_b_id::text) = least(p_user::text, c.user_id::text)
                      and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(p_user::text, c.user_id::text))
    and not exists (select 1 from likes l where l.liker_id = p_user and l.likee_id = c.user_id)
    and not exists (select 1 from daily_picks_v2 d where d.user_id = p_user and d.pick_user_id = c.user_id)
    and c.user_id is distinct from v_mutual
  order by md5(p_user::text || ':' || c.user_id::text || ':' || v_period::text)
  limit 1;

  insert into daily_picks_v2 (user_id, period, pick_user_id, mutual_user_id)
  values (p_user, v_period, v_pick, v_mutual)
  on conflict (user_id, period) do nothing;
  select * into r from daily_picks_v2 where user_id = p_user and period = v_period;
  return r;
end;
$$;

-- A card with LIVE state; null when the stored person is no longer
-- available (never replaced inside the period).
create or replace function public.v2_daily_card(p_me uuid, p_other uuid, p_kind text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_match uuid;
  v_like likes%rowtype;
  v_state text;
  o onboarding_v2%rowtype;
begin
  if p_other is null then return null; end if;
  v_match := public.v2_active_match_id(p_me, p_other);
  if p_kind = 'mutual' then
    -- Must still be a chat-active, visible match.
    if v_match is null or exists (select 1 from profiles p where p.id = p_other and (coalesce(p.is_hidden, false) or p.deleted_at is not null))
       or not public.is_active_v2_member(p_other) then
      return null;
    end if;
  else
    -- The pick: visible to me (eligibility, blocks, hidden, deleted,
    -- suspension, unmatch), or an active match formed during the period.
    if v_match is null and not public.v2_can_view_public_profile(p_me, p_other) then return null; end if;
  end if;
  select * into o from onboarding_v2 where user_id = p_other;
  select * into v_like from likes where liker_id = p_me and likee_id = p_other;
  v_state := case
    when v_match is not null and public.v2_pair_has_messages(p_me, p_other) then 'conversation_started'
    when v_match is not null then 'matched'
    when v_like.id is not null then 'like_sent'
    else 'new' end;
  return jsonb_build_object(
    'user_id', p_other,
    'first_name', public.v2_display_name(p_other),
    'age', case when o.date_of_birth is not null then date_part('year', age(o.date_of_birth))::int end,
    'city', o.location_city,
    'photo_path', public.v2_main_photo(p_other),
    'state', v_state,
    'match_id', v_match,
    'like', case when v_like.id is null then null
                 else jsonb_build_object('target_type', v_like.target_type, 'target_key', v_like.target_key, 'note', v_like.note) end);
end;
$$;

create or replace function public.v2_daily_picks_json(p_user uuid, p_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.daily_picks_v2; v_pick jsonb; v_mutual jsonb;
begin
  if p_user is null or not public.is_active_v2_member(p_user) then
    return jsonb_build_object('member', false);
  end if;
  r := public.v2_ensure_daily_picks(p_user, p_at);
  v_pick := public.v2_daily_card(p_user, r.pick_user_id, 'pick');
  v_mutual := public.v2_daily_card(p_user, r.mutual_user_id, 'mutual');
  return jsonb_build_object(
    'member', true,
    'period', r.period,
    'refresh_at', public.v2_pick_refresh_at(r.period),
    'pick', v_pick,
    'pick_reason', case when r.pick_user_id is null then 'none' when v_pick is null then 'unavailable' end,
    'mutual', v_mutual,
    'mutual_reason', case when r.mutual_user_id is null then 'none' when v_mutual is null then 'unavailable' end,
    -- For the empty state: matches exist, none left to feature today.
    'has_matches', exists (select 1 from matches m where p_user in (m.user_a_id, m.user_b_id) and public.v2_chat_active(m.id, p_user)));
end;
$$;

create or replace function public.get_daily_picks_v2()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return public.v2_daily_picks_json(auth.uid(), now());
end;
$$;

-- 4. Discover without today's pick (and creating today's row first) ---------
create or replace function public.get_discovery_candidates_v2(p_limit integer default 20)
returns table(user_id uuid, first_name text, age integer, city text, photo_paths text[])
language plpgsql security definer set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare r public.daily_picks_v2;
begin
  r := public.v2_ensure_daily_picks(auth.uid(), now());
  return query
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
    and not exists (select 1 from likes l where l.liker_id = me.user_id and l.likee_id = c.user_id)
    -- NEW (2026-10-08): today's daily pick is shown only in Matches.
    and c.user_id is distinct from r.pick_user_id
    and public.v2_wants(me.interested_in, c.gender)
    and public.v2_wants(c.interested_in, me.gender)
    and date_part('year', age(c.date_of_birth)) between me.amin and me.amax
    and date_part('year', age(me.date_of_birth)) between coalesce(cp.discovery_age_min, 18) and coalesce(cp.discovery_age_max, 120)
    and lower(btrim(c.location_city)) = lower(btrim(me.location_city))
  order by c.user_id
  limit greatest(least(coalesce(p_limit, 20), 100), 0);
end;
$$;

-- 5. send_like_v2 with a validated source ---------------------------------------
create or replace function public.send_like_v2(
  p_likee uuid, p_target_type text, p_target_id uuid, p_note text, p_request_id uuid, p_source text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count int; v_reset timestamptz; v_premium boolean; v_limit int;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_existing likes%rowtype;
  v_like likes%rowtype;
  v_quota jsonb;
  v_period date := public.v2_pick_period(now());
  v_today public.daily_picks_v2;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_likee is null or p_target_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;
  if p_source is null or p_source not in ('discover', 'daily_pick') then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  select coalesce(p.daily_views_count, 0), p.daily_views_reset_at, coalesce(p.is_premium, false)
    into v_count, v_reset, v_premium from profiles p where p.id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_member'); end if;
  if v_reset is null or v_reset + interval '24 hours' < now() then v_count := 0; v_reset := now(); end if;
  v_limit := public.v2_like_limit(v_premium);
  v_quota := jsonb_build_object('used', v_count, 'limit', v_limit, 'remaining', greatest(v_limit - v_count, 0),
    'resets_at', v_reset + interval '24 hours');

  perform pg_advisory_xact_lock(hashtextextended(least(v_uid::text, p_likee::text) || ':' || greatest(v_uid::text, p_likee::text), 7));

  select * into v_existing from likes where liker_id = v_uid and likee_id = p_likee;
  if found then
    if v_existing.client_request_id = p_request_id then
      return jsonb_build_object('ok', true, 'replayed', true, 'like_id', v_existing.id,
        'matched', v_existing.status = 'matched', 'target_type', v_existing.target_type,
        'target_id', v_existing.target_key, 'note', v_existing.note, 'source', v_existing.source, 'quota', v_quota);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_liked', 'quota', v_quota);
  end if;

  if not public.is_active_v2_member(v_uid) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  -- Source check BEFORE anything is written or spent. Only the CURRENT
  -- period's pick counts as daily_pick; any other day's pick, or a Discover
  -- card that became today's pick, asks the client to refresh.
  v_today := public.v2_ensure_daily_picks(v_uid, now());
  if p_source = 'daily_pick' and (v_today.pick_user_id is distinct from p_likee) then
    return jsonb_build_object('ok', false, 'error', 'stale_pick', 'quota', v_quota);
  end if;
  if p_source = 'discover' and v_today.pick_user_id = p_likee then
    return jsonb_build_object('ok', false, 'error', 'stale_pick', 'quota', v_quota);
  end if;

  if not public.v2_can_view_public_profile(v_uid, p_likee) or p_likee = v_uid then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  if p_target_type = 'photo' then
    if not exists (select 1 from profile_photos_v2 f where f.id = p_target_id and f.user_id = p_likee) then
      return jsonb_build_object('ok', false, 'error', 'invalid_target');
    end if;
  elsif p_target_type = 'prompt' then
    if not exists (select 1 from profile_prompts_v2 r where r.id = p_target_id and r.user_id = p_likee) then
      return jsonb_build_object('ok', false, 'error', 'invalid_target');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_target');
  end if;
  if v_note is not null and char_length(v_note) > 240 then
    return jsonb_build_object('ok', false, 'error', 'note_too_long');
  end if;
  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'quota_exhausted', 'quota', v_quota);
  end if;

  update profiles set daily_views_count = v_count + 1, daily_views_reset_at = v_reset where id = v_uid;
  insert into likes (liker_id, likee_id, target_type, target_key, note, status, client_request_id, source, pick_period)
  values (v_uid, p_likee, p_target_type, p_target_id::text, v_note, 'sent', p_request_id, p_source,
          case when p_source = 'daily_pick' then v_period end)
  returning * into v_like;
  select * into v_like from likes where id = v_like.id;
  v_quota := jsonb_build_object('used', v_count + 1, 'limit', v_limit, 'remaining', greatest(v_limit - v_count - 1, 0),
    'resets_at', v_reset + interval '24 hours');
  insert into events (user_id, name, properties)
  values (v_uid, 'like_sent', jsonb_build_object('target_type', p_target_type, 'has_note', v_note is not null, 'source', p_source));
  return jsonb_build_object('ok', true, 'replayed', false, 'like_id', v_like.id, 'matched', v_like.status = 'matched',
    'target_type', v_like.target_type, 'target_id', v_like.target_key, 'note', v_like.note, 'source', p_source, 'quota', v_quota);
end;
$$;

-- The 5-argument form (installed builds) stays: it is the Discover path.
create or replace function public.send_like_v2(
  p_likee uuid, p_target_type text, p_target_id uuid, p_note text, p_request_id uuid)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.send_like_v2(p_likee, p_target_type, p_target_id, p_note, p_request_id, 'discover') $$;

-- 6. Notes stay likes in V2 (no automatic messages) -----------------------------
create or replace function public.handle_mutual_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_match_id uuid;
  v_v2_pair boolean;
begin
  if NEW.status <> 'sent' then
    return NEW;
  end if;
  if not exists (
    select 1 from likes r
    where r.liker_id = NEW.likee_id
      and r.likee_id = NEW.liker_id
      and r.status = 'sent'
  ) then
    return NEW;
  end if;

  insert into matches (user_a_id, user_b_id, status, match_score, chat_opened, source, expires_at, created_at)
  values (
    least(NEW.liker_id::text, NEW.likee_id::text)::uuid,
    greatest(NEW.liker_id::text, NEW.likee_id::text)::uuid,
    'accepted', 100, true, 'mutual_like', now() + interval '24 hours', now())
  on conflict (least(user_a_id::text, user_b_id::text), greatest(user_a_id::text, user_b_id::text))
  do update set status = 'accepted', chat_opened = true, source = 'mutual_like'
  where matches.chat_opened is not true
  returning id into v_match_id;

  if v_match_id is null then
    return NEW;
  end if;

  update likes
    set status = 'matched', match_id = v_match_id
    where status = 'sent'
      and ((liker_id = NEW.liker_id and likee_id = NEW.likee_id)
        or (liker_id = NEW.likee_id and likee_id = NEW.liker_id));

  -- V1 only (unchanged): a like's note becomes the opening message. A V2 pair
  -- (both have a V2 account state) keeps notes as like context instead —
  -- the chat starts only when someone actually sends a message.
  v_v2_pair := exists (select 1 from account_state_v2 s where s.user_id = NEW.liker_id)
           and exists (select 1 from account_state_v2 s where s.user_id = NEW.likee_id);
  if not v_v2_pair then
    insert into messages (sender_id, receiver_id, content, created_at)
    select l.liker_id, l.likee_id, l.note, l.created_at
    from likes l
    where l.match_id = v_match_id
      and l.note is not null
      and length(trim(l.note)) > 0
    order by l.created_at asc;
  end if;

  insert into notifications (user_id, type, text, related_user_id)
  values
    (NEW.liker_id, 'mutual_match', 'Eşleştiniz! Sohbet açıldı 💛', NEW.likee_id),
    (NEW.likee_id, 'mutual_match', 'Eşleştiniz! Sohbet açıldı 💛', NEW.liker_id);

  insert into events (user_id, name, properties)
  values
    (NEW.liker_id, 'mutual_match', jsonb_build_object('match_id', v_match_id)),
    (NEW.likee_id, 'mutual_match', jsonb_build_object('match_id', v_match_id));

  return NEW;
end;
$$;

-- Chat: state + the like context (which photo / prompt, who sent it).
create or replace function public.get_chat_v2(p_match uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select case when not exists (select 1 from matches m where m.id = p_match and auth.uid() in (m.user_a_id, m.user_b_id))
    then null
    else jsonb_build_object(
      'match_id', p_match,
      'active', public.v2_chat_active(p_match, auth.uid()),
      'state', public.v2_chat_state(p_match, auth.uid()),
      'proposals', coalesce((select jsonb_agg(public.v2_proposal_json(p, auth.uid()) order by p.created_at)
                             from date_proposals_v2 p where p.match_id = p_match), '[]'::jsonb),
      'likes', case when public.v2_chat_state(p_match, auth.uid()) = 'ended' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object(
                 'from_me', l.liker_id = auth.uid(),
                 'target_type', l.target_type,
                 'note', l.note,
                 'created_at', l.created_at,
                 'photo_path', ph.storage_path,
                 'prompt_id', pr.prompt_id,
                 'answer', pr.answer) order by l.created_at)
        from matches m
        join likes l on (l.liker_id = m.user_a_id and l.likee_id = m.user_b_id) or (l.liker_id = m.user_b_id and l.likee_id = m.user_a_id)
        left join profile_photos_v2 ph on l.target_type = 'photo' and ph.user_id = l.likee_id
             and ph.id::text = l.target_key
        left join profile_prompts_v2 pr on l.target_type = 'prompt' and pr.user_id = l.likee_id
             and pr.id::text = l.target_key
        where m.id = p_match), '[]'::jsonb) end)
  end
$$;

-- Grants: authenticated only; the period/picks internals are not callable
-- by clients (service_role is used only by the local tests).
revoke all on function public.v2_is_suspended(uuid) from public, anon, authenticated;
revoke all on function public.v2_pair_has_suspended(uuid, uuid) from public, anon;
grant execute on function public.v2_pair_has_suspended(uuid, uuid) to authenticated;
revoke all on function public.v2_chat_state(uuid, uuid) from public, anon, authenticated;
revoke all on function public.v2_pair_has_messages(uuid, uuid) from public, anon, authenticated;
revoke all on function public.v2_active_match_id(uuid, uuid) from public, anon, authenticated;
revoke all on function public.v2_ensure_daily_picks(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.v2_daily_card(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.v2_daily_picks_json(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.v2_daily_picks_json(uuid, timestamptz) to service_role;
revoke all on function public.get_daily_picks_v2() from public, anon;
grant execute on function public.get_daily_picks_v2() to authenticated;
revoke all on function public.get_my_matches_v2() from public, anon;
grant execute on function public.get_my_matches_v2() to authenticated;
revoke all on function public.get_discovery_candidates_v2(integer) from public, anon;
grant execute on function public.get_discovery_candidates_v2(integer) to authenticated;
revoke all on function public.send_like_v2(uuid, text, uuid, text, uuid, text) from public, anon;
grant execute on function public.send_like_v2(uuid, text, uuid, text, uuid, text) to authenticated;
revoke all on function public.send_like_v2(uuid, text, uuid, text, uuid) from public, anon;
grant execute on function public.send_like_v2(uuid, text, uuid, text, uuid) to authenticated;
revoke all on function public.get_chat_v2(uuid) from public, anon;
grant execute on function public.get_chat_v2(uuid) to authenticated;
