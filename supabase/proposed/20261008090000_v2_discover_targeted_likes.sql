-- V2 Discover: targeted photo / prompt likes with an optional comment, saved
-- in ONE server operation (2026-10-08). perfect-match-dev only, applied with
--   node scripts/dev-backend/apply-dev.mjs discover
--
-- What it does
--  1. profile_prompts_v2 gets a stable row id (photos already have one).
--     save_prompts_v2 replaces rows, so changed content always gets a NEW id:
--     an old like can never be re-bound to different content.
--  2. get_profile_v2 also returns those ids (`photos`: [{id, path}],
--     `prompts[].id`). District is still NOT returned: there is no explicit
--     "show my district" choice, and a filled district is not consent.
--  3. send_like_v2(...) — the only write path for active V2 members:
--     caller is an active V2 member; the target person is visible to them
--     (blocks either way, hidden, deleted, eligibility — same rule as
--     get_profile_v2); the photo / prompt id belongs to that person; one like
--     per person; note ≤ 240; quota (existing rule: free 5 / premium 10 per
--     rolling 24 h, same counter as increment_daily_views) checked and
--     consumed in the same transaction. The caller's profiles row is locked,
--     so double taps, concurrent requests and a network retry can't create a
--     second like or spend a second unit. A retry with the same request id
--     returns the original result (idempotent).
--  4. get_my_like_quota_v2() — the server counter for the header.
--  5. likes guard: active V2 members can no longer insert / update `likes`
--     directly (that path skipped the quota and target checks). V1 accounts
--     keep their legacy path unchanged.
--  6. get_my_liker_cards: for premium likees (rule unchanged) it also says
--     WHICH of their photos / prompts was liked, and whether that content
--     still exists (never pointing at another photo / prompt).
-- Unchanged: Discover order (get_discovery_candidates_v2), scoring (none on
-- V2), premium visibility, handle_mutual_like (a comment alone never opens a
-- chat; a mutual like seeds each note once).

-- 1. Stable prompt ids -------------------------------------------------------
alter table public.profile_prompts_v2 add column if not exists id uuid not null default gen_random_uuid();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profile_prompts_v2_id_key') then
    alter table public.profile_prompts_v2 add constraint profile_prompts_v2_id_key unique (id);
  end if;
end $$;

-- Idempotency key for send_like_v2 (one per liker).
alter table public.likes add column if not exists client_request_id uuid;
create unique index if not exists likes_liker_request_uniq on public.likes (liker_id, client_request_id)
  where client_request_id is not null;

-- 2. get_profile_v2 with content ids ----------------------------------------
create or replace function public.get_profile_v2(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user_id', o.user_id,
    'first_name', btrim(o.first_name),
    'age', date_part('year', age(o.date_of_birth))::int,
    'zodiac', public.v2_zodiac(o.date_of_birth),
    'city', o.location_city,
    'height_cm', o.height_cm,
    'work_status', o.work_status,
    'job_title', nullif(btrim(o.job_title), ''),
    'school', o.school,
    'hometown', o.hometown,
    'intent', o.intent,
    'core_values', coalesce(to_jsonb(o.core_values), '[]'::jsonb),
    'interests', coalesce(to_jsonb(o.interests), '[]'::jsonb),
    'smoking', o.smoking,
    'drinking', o.drinking,
    'pets', o.pets,
    'pet_kind', o.pet_kind,
    'activity', o.activity,
    'artists', coalesce(o.artists, '[]'::jsonb),
    'books', coalesce(o.books, '[]'::jsonb),
    'screen', coalesce(o.screen, '[]'::jsonb),
    'date_types', coalesce(to_jsonb(o.date_types), '[]'::jsonb),
    'favorite_spot', nullif(btrim(o.favorite_spot), ''),
    'days_pref', o.days_pref,
    'time_pref', o.time_pref,
    'prompts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slot', p.slot, 'prompt_id', p.prompt_id, 'answer', p.answer)
                                          order by p.slot)
                         from profile_prompts_v2 p where p.user_id = o.user_id), '[]'::jsonb),
    'photo_paths', coalesce((select jsonb_agg(f.storage_path order by f.position)
                             from profile_photos_v2 f where f.user_id = o.user_id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path) order by f.position)
                        from profile_photos_v2 f where f.user_id = o.user_id), '[]'::jsonb))
  from onboarding_v2 o
  where o.user_id = p_user
    and public.v2_can_view_public_profile(auth.uid(), p_user)
$$;

-- 3/4. Quota helpers + send_like_v2 -----------------------------------------
-- Existing rule (lib/dailyViews.ts): free 5, premium 10 likes per rolling
-- 24 h window starting at daily_views_reset_at.
create or replace function public.v2_like_limit(p_premium boolean)
returns int language sql immutable set search_path = public, pg_temp
as $$ select case when coalesce(p_premium, false) then 10 else 5 end $$;

create or replace function public.get_my_like_quota_v2()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_count int; v_reset timestamptz; v_premium boolean; v_limit int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select coalesce(p.daily_views_count, 0), p.daily_views_reset_at, coalesce(p.is_premium, false)
    into v_count, v_reset, v_premium from profiles p where p.id = v_uid;
  if v_reset is null or v_reset + interval '24 hours' < now() then v_count := 0; v_reset := null; end if;
  v_limit := public.v2_like_limit(v_premium);
  return jsonb_build_object('used', v_count, 'limit', v_limit, 'remaining', greatest(v_limit - v_count, 0),
    'resets_at', case when v_reset is null then null else v_reset + interval '24 hours' end);
end;
$$;

create or replace function public.send_like_v2(
  p_likee uuid, p_target_type text, p_target_id uuid, p_note text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count int; v_reset timestamptz; v_premium boolean; v_limit int;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_existing likes%rowtype;
  v_like likes%rowtype;
  v_quota jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_likee is null or p_target_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  -- Serialises every like this caller sends (quota + one-per-person).
  select coalesce(p.daily_views_count, 0), p.daily_views_reset_at, coalesce(p.is_premium, false)
    into v_count, v_reset, v_premium from profiles p where p.id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_member'); end if;
  if v_reset is null or v_reset + interval '24 hours' < now() then v_count := 0; v_reset := now(); end if;
  v_limit := public.v2_like_limit(v_premium);
  v_quota := jsonb_build_object('used', v_count, 'limit', v_limit, 'remaining', greatest(v_limit - v_count, 0),
    'resets_at', v_reset + interval '24 hours');

  -- Pair lock: if both people like each other at the same moment, the second
  -- transaction waits for the first, so handle_mutual_like always sees the
  -- other like and the match is never missed (lock order: own profile row,
  -- then the pair — no deadlock).
  perform pg_advisory_xact_lock(hashtextextended(least(v_uid::text, p_likee::text) || ':' || greatest(v_uid::text, p_likee::text), 7));

  -- One like per person. Same request again (double tap / network retry) →
  -- the original result, nothing new written or spent.
  select * into v_existing from likes where liker_id = v_uid and likee_id = p_likee;
  if found then
    if v_existing.client_request_id = p_request_id then
      return jsonb_build_object('ok', true, 'replayed', true, 'like_id', v_existing.id,
        'matched', v_existing.status = 'matched', 'target_type', v_existing.target_type,
        'target_id', v_existing.target_key, 'note', v_existing.note, 'quota', v_quota);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_liked', 'quota', v_quota);
  end if;

  if not public.is_active_v2_member(v_uid) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  -- Same visibility rule as get_profile_v2 (blocks either way, hidden,
  -- deleted, membership, eligibility).
  if not public.v2_can_view_public_profile(v_uid, p_likee) or p_likee = v_uid then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  -- The content must belong to that person (and is then visible to the
  -- caller, since their whole public profile is).
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

  -- Like + comment + quota in this one transaction.
  update profiles set daily_views_count = v_count + 1, daily_views_reset_at = v_reset where id = v_uid;
  insert into likes (liker_id, likee_id, target_type, target_key, note, status, client_request_id)
  values (v_uid, p_likee, p_target_type, p_target_id::text, v_note, 'sent', p_request_id)
  returning * into v_like;
  -- handle_mutual_like may have turned it into a match already.
  select * into v_like from likes where id = v_like.id;
  v_quota := jsonb_build_object('used', v_count + 1, 'limit', v_limit, 'remaining', greatest(v_limit - v_count - 1, 0),
    'resets_at', v_reset + interval '24 hours');
  insert into events (user_id, name, properties)
  values (v_uid, 'like_sent', jsonb_build_object('target_type', p_target_type, 'has_note', v_note is not null, 'source', 'v2'));
  return jsonb_build_object('ok', true, 'replayed', false, 'like_id', v_like.id, 'matched', v_like.status = 'matched',
    'target_type', v_like.target_type, 'target_id', v_like.target_key, 'note', v_like.note, 'quota', v_quota);
end;
$$;

-- 5. Direct writes closed for V2 members ------------------------------------
-- The guard runs with the caller's rights (it needs current_user to tell
-- client writes apart), and clients may not call is_active_v2_member. This
-- definer helper answers only for the caller themself.
create or replace function public.v2_caller_is_member()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select auth.uid() is not null and public.is_active_v2_member(auth.uid()) $$;
revoke all on function public.v2_caller_is_member() from public, anon;
grant execute on function public.v2_caller_is_member() to authenticated;

create or replace function public.guard_like_client_writes()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- NEW (2026-10-08): V2 members like only through send_like_v2 (quota,
  -- target ownership and one-per-person are enforced there).
  if public.v2_caller_is_member() then
    raise exception 'use_send_like_v2' using errcode = '42501';
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

-- 6. Likes you: which content was liked (premium only, as before) -----------
drop function if exists public.get_my_liker_cards(integer);
create function public.get_my_liker_cards(p_limit integer default 50)
returns table(total_count bigint, liker_id uuid, first_name text, age integer, photo_path text,
              target_type text, target_key text, note text, created_at timestamptz,
              target_available boolean, target_photo_path text, target_prompt_id text, target_answer text)
language plpgsql stable security definer set search_path = public, pg_temp
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
      select l.liker_id, l.target_type, l.target_key, l.note, l.created_at,
             case when l.target_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  then l.target_key::uuid end as tid
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
           v.created_at,
           -- The likee's OWN content, looked up by id only: if it was removed
           -- or replaced this is false and nothing else is shown.
           case when v_is_premium then (ph.id is not null or pr.id is not null) end,
           case when v_is_premium then ph.storage_path end,
           case when v_is_premium then pr.prompt_id end,
           case when v_is_premium then pr.answer end
    from visible v
    join profiles p on p.id = v.liker_id
    cross join cnt
    left join profile_photos_v2 ph on v.target_type = 'photo' and ph.id = v.tid and ph.user_id = v_uid
    left join profile_prompts_v2 pr on v.target_type = 'prompt' and pr.id = v.tid and pr.user_id = v_uid
    order by v.created_at desc
    limit case when v_is_premium then greatest(p_limit, 0) else least(greatest(p_limit, 0), 3) end;
end;
$$;

-- Grants: authenticated only.
revoke all on function public.get_my_liker_cards(integer) from public, anon;
grant execute on function public.get_my_liker_cards(integer) to authenticated;
revoke all on function public.send_like_v2(uuid, text, uuid, text, uuid) from public, anon;
grant execute on function public.send_like_v2(uuid, text, uuid, text, uuid) to authenticated;
revoke all on function public.get_my_like_quota_v2() from public, anon;
grant execute on function public.get_my_like_quota_v2() to authenticated;
revoke all on function public.v2_like_limit(boolean) from public, anon;
grant execute on function public.v2_like_limit(boolean) to authenticated;
revoke all on function public.get_profile_v2(uuid) from public, anon;
grant execute on function public.get_profile_v2(uuid) to authenticated;
