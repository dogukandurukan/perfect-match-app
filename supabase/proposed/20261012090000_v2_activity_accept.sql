-- V2 Activity: incoming interest → full profile → "Match & chat"
-- (owner decisions D75–D80, 2026-10-12; integration 2026-10-12).
--
-- NOT applied to the shared remote project (DEV = live). Applied and verified
-- only on the LOCAL Supabase (local-backend/, project tempa-local, 554xx):
-- scripts/local-backend/smoke_activity_local.mjs.
--
-- Builds on 20261009090000_v2_matches_daily_picks.sql (v2_active_match_id,
-- v2_is_suspended, get_my_matches_v2) and reuses the existing tables — no
-- second match / chat / notification system:
--
--  1. likes.seen_at — read state for an incoming like (D77). Written ONLY by
--     mark_like_seen_v2, which the app calls when the liker's profile is
--     really opened. Loading the Activity list never marks anything. Read
--     state is separate from match state: marking read never accepts.
--     (Considered: a notifications row per like. Rejected — it would be a
--     second record of the same like that has to be kept in sync with
--     status / match / block; the like row already is the record.)
--  2. get_my_activity_v2() — ONE snapshot for the Activity feed:
--       • pending: likes TO me with status 'sent' from people I may still
--         see under V2 rules (v2_can_view_public_profile: active members,
--         eligible pair or accepted match, no block, not unmatched), not
--         suspended, and NO active match between us. One row per person by
--         construction (unique liker/likee); the like's comment is part of
--         that row, never a separate card.
--       • matches: get_my_matches_v2() (accepted, chat open, not ended).
--     Pending and matches come from the same statement, so a person is
--     never both. Identity / comment / liked content follow the EXISTING
--     premium rule of get_my_liker_cards (non-premium: count only). Local
--     test accounts are made premium in the local seed data — no bypass here.
--  3. accept_like_v2(p_like) — "Match & chat": the caller must be the like's
--     recipient (checked on the server; anyone else gets 'not_found', the
--     same answer as a missing id). Creates / upgrades the ONE matches row
--     for the pair to accepted + chat_opened (same shape as handle_mutual_like,
--     source 'mutual_like'), links the incoming like (status 'matched',
--     match_id). The match is between the two PEOPLE; the liked photo /
--     answer stays context. No reverse like row, no message, no quota:
--     accepting incoming interest is not a new like (daily quota untouched).
--     Idempotent: a per-pair advisory lock (same key as send_like_v2) + the
--     unique pair index; a repeat, a concurrent tap or a retry after a lost
--     response returns the SAME match id (replayed = true). Refused when the
--     pair is blocked, unmatched ('passed'), either side suspended / not an
--     active member, or no longer eligible — nothing is written then.
--     Both sides get the existing 'mutual_match' notification + event.

-- 1. Read state ---------------------------------------------------------------
alter table public.likes add column if not exists seen_at timestamptz;

-- 2. Activity snapshot ----------------------------------------------------------
create or replace function public.get_my_activity_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_premium boolean;
  v_pending jsonb;
  v_count int;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_v2_member(v_me) then
    return jsonb_build_object('member', false, 'premium', false, 'pending_count', 0, 'pending', '[]'::jsonb, 'matches', '[]'::jsonb);
  end if;
  select coalesce(p.is_premium, false) into v_premium from profiles p where p.id = v_me;
  v_premium := coalesce(v_premium, false);

  with pending as (
    select l.*,
           case when l.target_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then l.target_key::uuid end as tid
    from likes l
    where l.likee_id = v_me
      and l.status = 'sent'
      and public.v2_can_view_public_profile(v_me, l.liker_id)
      and not public.v2_is_suspended(l.liker_id)
      and public.v2_active_match_id(v_me, l.liker_id) is null
  )
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'like_id', pe.id,
           'user_id', pe.liker_id,
           'first_name', public.v2_display_name(pe.liker_id),
           'age', date_part('year', age(o.date_of_birth))::int,
           'city', o.location_city,
           'photo_path', public.v2_main_photo(pe.liker_id),
           'target_type', pe.target_type,
           'note', pe.note,
           'created_at', pe.created_at,
           'seen', pe.seen_at is not null,
           -- My OWN liked content, looked up by id: removed / replaced → null.
           'target_photo_path', ph.storage_path,
           'target_prompt_id', pr.prompt_id,
           'target_answer', pr.answer) order by pe.created_at desc) filter (where v_premium), '[]'::jsonb)
    into v_count, v_pending
  from pending pe
  left join onboarding_v2 o on o.user_id = pe.liker_id
  left join profile_photos_v2 ph on pe.target_type = 'photo' and ph.id = pe.tid and ph.user_id = v_me
  left join profile_prompts_v2 pr on pe.target_type = 'prompt' and pr.id = pe.tid and pr.user_id = v_me;

  return jsonb_build_object(
    'member', true,
    'premium', v_premium,
    'pending_count', v_count,
    'pending', v_pending,
    'matches', coalesce((select jsonb_agg(to_jsonb(m)) from public.get_my_matches_v2() m), '[]'::jsonb));
end;
$$;

-- 3. Read state writer ---------------------------------------------------------
create or replace function public.mark_like_seen_v2(p_like uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_seen timestamptz;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  -- Only the like's recipient; nothing else about the like changes.
  update likes set seen_at = coalesce(seen_at, now())
  where id = p_like and likee_id = v_me
  returning seen_at into v_seen;
  if v_seen is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'seen_at', v_seen);
end;
$$;

-- 4. Match & chat ---------------------------------------------------------------
create or replace function public.accept_like_v2(p_like uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_like likes%rowtype;
  v_other uuid;
  v_match uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_like is null then return jsonb_build_object('ok', false, 'error', 'invalid_request'); end if;

  select * into v_like from likes where id = p_like;
  -- Someone else's like answers exactly like a missing one (no oracle).
  if not found or v_like.likee_id <> v_me then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_other := v_like.liker_id;

  -- Same pair lock as send_like_v2: accepts, likes and retries for this pair
  -- run one at a time.
  perform pg_advisory_xact_lock(hashtextextended(least(v_me::text, v_other::text) || ':' || greatest(v_me::text, v_other::text), 7));
  select * into v_like from likes where id = p_like for update;

  -- Already matched (double tap, concurrent request, retry after a lost
  -- response, or matched another way): the existing match, nothing new.
  v_match := public.v2_active_match_id(v_me, v_other);
  if v_match is not null then
    update likes set status = 'matched', match_id = v_match
    where status = 'sent'
      and ((liker_id = v_me and likee_id = v_other) or (liker_id = v_other and likee_id = v_me));
    return jsonb_build_object('ok', true, 'replayed', true, 'match_id', v_match, 'user_id', v_other);
  end if;

  if v_like.status <> 'sent' then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  if not public.is_active_v2_member(v_me) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  if public.v2_is_suspended(v_other)
     or not public.v2_can_view_public_profile(v_me, v_other)
     or not public.v2_can_view_public_profile(v_other, v_me) then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  insert into matches (user_a_id, user_b_id, status, match_score, chat_opened, source, expires_at, created_at)
  values (least(v_me::text, v_other::text)::uuid, greatest(v_me::text, v_other::text)::uuid,
          'accepted', 100, true, 'mutual_like', now() + interval '24 hours', now())
  on conflict (least(user_a_id::text, user_b_id::text), greatest(user_a_id::text, user_b_id::text))
  do update set status = 'accepted', chat_opened = true, source = 'mutual_like'
  -- Never revives an unmatched pair or touches an open chat.
  where matches.status <> 'passed' and matches.chat_opened is not true
  returning id into v_match;

  if v_match is null or public.v2_active_match_id(v_me, v_other) is distinct from v_match then
    raise exception 'match_not_created' using errcode = 'P0001';  -- rolls everything back
  end if;

  update likes set status = 'matched', match_id = v_match, seen_at = coalesce(seen_at, now())
  where status = 'sent'
    and ((liker_id = v_me and likee_id = v_other) or (liker_id = v_other and likee_id = v_me));

  insert into notifications (user_id, type, text, related_user_id)
  values (v_other, 'mutual_match', 'Eşleştiniz! Sohbet açıldı 💛', v_me),
         (v_me, 'mutual_match', 'Eşleştiniz! Sohbet açıldı 💛', v_other);
  insert into events (user_id, name, properties)
  values (v_me, 'mutual_match', jsonb_build_object('match_id', v_match, 'via', 'activity_accept')),
         (v_other, 'mutual_match', jsonb_build_object('match_id', v_match, 'via', 'activity_accept'));

  return jsonb_build_object('ok', true, 'replayed', false, 'match_id', v_match, 'user_id', v_other);
end;
$$;

revoke all on function public.get_my_activity_v2() from public, anon;
grant execute on function public.get_my_activity_v2() to authenticated;
revoke all on function public.mark_like_seen_v2(uuid) from public, anon;
grant execute on function public.mark_like_seen_v2(uuid) to authenticated;
revoke all on function public.accept_like_v2(uuid) from public, anon;
grant execute on function public.accept_like_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
