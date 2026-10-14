-- V2 "Interests & conversation starter" (owner decisions 2026-10-14, D87–D93).
--
-- NOT applied to the shared remote project (DEV = live). Applied and verified
-- only on the LOCAL Supabase (tempa-local): scripts/local-backend/smoke_takes_local.mjs.
--
--  1. onboarding_v2.activities — up to 5 concrete activities from a small
--     fixed catalog (separate from the 16 broad interests, whose 1–10 rule is
--     unchanged; nothing is derived from the broad categories).
--  2. profile_takes_v2 — ONE optional personal answer per user ("conversation
--     starter"), tied to one of the user's OWN saved selections: an activity,
--     a book, a movie/series or an artist (kept by its existing source id).
--     A short fixed question per subject kind; answer 1–180 characters
--     (Turkish or English, stored as typed). The subject title is copied from
--     the user's own saved selection when saved (never from the client).
--     Same subject → updated in place (same id); a different subject → the old
--     row is replaced by a NEW row (new id), so nothing that may later point
--     at a take id ever silently refers to a different subject.
--  3. Narrow server operations for ACCEPTED, ACTIVE members only — the general
--     v2_assert_editable lock is NOT relaxed and no other application field,
--     status, photo or standard prompt can be changed through them:
--       get_my_interests_v2()                       own selections + take
--       save_interests_v2(interests, activities, artists, books, screen, remove_take)
--       save_take_v2(kind, subject_id, question_id, answer)
--       delete_take_v2()
--     Removing the subject of the take is refused ('take_subject_removed',
--     nothing written) unless the caller confirmed (p_remove_take = true):
--     then selections + take change in ONE transaction. Deleting the take
--     alone never touches the selections. save_prompts_v2 is not used.
--  4. get_profile_v2 also returns `activities` and `take` — same visibility
--     rule as before (v2_can_view_public_profile: block, hidden, deleted,
--     eligibility, unmatch). No likes / comments on the take yet.

-- 1. Activities ---------------------------------------------------------------
alter table public.onboarding_v2 add column if not exists activities text[] not null default '{}';
alter table public.onboarding_v2 drop constraint if exists onboarding_v2_activities_check;
alter table public.onboarding_v2 add constraint onboarding_v2_activities_check
  check (v2_is_subset(activities, array['running','walking','cycling','hiking','swimming','gym','yoga','pilates','dancing','cooking','gaming','photography'], 5));

create or replace function public.v2_activity_label(p_key text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_key
    when 'running' then 'Running' when 'walking' then 'Walking' when 'cycling' then 'Cycling'
    when 'hiking' then 'Hiking' when 'swimming' then 'Swimming' when 'gym' then 'Gym'
    when 'yoga' then 'Yoga' when 'pilates' then 'Pilates' when 'dancing' then 'Dancing'
    when 'cooking' then 'Cooking' when 'gaming' then 'Gaming' when 'photography' then 'Photography' end
$$;

-- 2. Takes ----------------------------------------------------------------------
create table if not exists public.profile_takes_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('activity', 'book', 'screen', 'artist')),
  subject_id text not null check (char_length(subject_id) between 1 and 300),
  subject_title text not null check (char_length(btrim(subject_title)) between 1 and 200),
  question_id text not null check (
    (subject_kind = 'activity' and question_id in ('activity_favourite_part', 'activity_perfect_day'))
    or (subject_kind = 'book' and question_id in ('book_why', 'book_stayed'))
    or (subject_kind = 'screen' and question_id in ('screen_why', 'screen_scene'))
    or (subject_kind = 'artist' and question_id in ('artist_first_song', 'artist_when'))),
  answer text not null check (char_length(btrim(answer)) between 1 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_takes_v2 enable row level security;
drop policy if exists profile_takes_v2_own on public.profile_takes_v2;
create policy profile_takes_v2_own on public.profile_takes_v2 for select to authenticated using (user_id = auth.uid());
revoke all on public.profile_takes_v2 from public, anon, authenticated;
grant select on public.profile_takes_v2 to authenticated;

create or replace function public.v2_take_json(t public.profile_takes_v2)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id, 'subject_kind', t.subject_kind, 'subject_id', t.subject_id, 'subject_title', t.subject_title,
    'question_id', t.question_id, 'answer', t.answer, 'updated_at', t.updated_at) end
$$;

/** Is (kind, id) one of this user's currently saved selections? */
create or replace function public.v2_take_subject_title(o public.onboarding_v2, p_kind text, p_id text)
returns text language sql stable set search_path = public, pg_temp as $$
  select case p_kind
    when 'activity' then case when p_id = any(o.activities) then public.v2_activity_label(p_id) end
    when 'book' then (select e ->> 'title' from jsonb_array_elements(coalesce(o.books, '[]'::jsonb)) e where e ->> 'id' = p_id limit 1)
    when 'screen' then (select e ->> 'title' from jsonb_array_elements(coalesce(o.screen, '[]'::jsonb)) e where e ->> 'id' = p_id limit 1)
    when 'artist' then (select e ->> 'title' from jsonb_array_elements(coalesce(o.artists, '[]'::jsonb)) e where e ->> 'id' = p_id limit 1)
  end
$$;

-- 3. Narrow operations ------------------------------------------------------
create or replace function public.v2_assert_member_profile_edit()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  -- Accepted + verified + active only (suspended / pending / draft refused).
  if not public.is_active_v2_member(v_uid) then raise exception 'not_member' using errcode = '42501'; end if;
  return v_uid;
end;
$$;

create or replace function public.get_my_interests_v2()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); o onboarding_v2; t profile_takes_v2;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into o from onboarding_v2 where user_id = v_uid;
  select * into t from profile_takes_v2 where user_id = v_uid;
  return jsonb_build_object(
    'editable', public.is_active_v2_member(v_uid),
    'interests', coalesce(to_jsonb(o.interests), '[]'::jsonb),
    'activities', coalesce(to_jsonb(o.activities), '[]'::jsonb),
    'artists', coalesce(o.artists, '[]'::jsonb),
    'books', coalesce(o.books, '[]'::jsonb),
    'screen', coalesce(o.screen, '[]'::jsonb),
    'take', public.v2_take_json(t));
end;
$$;

create or replace function public.save_interests_v2(
  p_interests text[], p_activities text[], p_artists jsonb, p_books jsonb, p_screen jsonb, p_remove_take boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  o onboarding_v2; t profile_takes_v2; n onboarding_v2;
  v_removed boolean := false;
begin
  -- Same rules as onboarding: 1–10 broad interests, ≤ 5 activities, ≤ 3 per
  -- taste list, no duplicates (the table checks are the backstop).
  if coalesce(cardinality(p_interests), 0) not between 1 and 10
     or cardinality(p_interests) <> (select count(distinct x) from unnest(p_interests) x) then
    return jsonb_build_object('ok', false, 'error', 'invalid_interests');
  end if;
  if coalesce(cardinality(p_activities), 0) > 5
     or coalesce(cardinality(p_activities), 0) <> (select count(distinct x) from unnest(coalesce(p_activities, '{}')) x)
     or exists (select 1 from unnest(coalesce(p_activities, '{}')) x where public.v2_activity_label(x) is null) then
    return jsonb_build_object('ok', false, 'error', 'invalid_activities');
  end if;
  if not (public.v2_is_taste_list(coalesce(p_artists, '[]'::jsonb), 'artist') and public.v2_is_taste_list(coalesce(p_books, '[]'::jsonb), 'book')
          and public.v2_is_taste_list(coalesce(p_screen, '[]'::jsonb), 'screen'))
     or (select count(*) <> count(distinct e ->> 'id') from jsonb_array_elements(coalesce(p_artists, '[]')) e)
     or (select count(*) <> count(distinct e ->> 'id') from jsonb_array_elements(coalesce(p_books, '[]')) e)
     or (select count(*) <> count(distinct e ->> 'id') from jsonb_array_elements(coalesce(p_screen, '[]')) e) then
    return jsonb_build_object('ok', false, 'error', 'invalid_taste');
  end if;

  select * into o from onboarding_v2 where user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_member'); end if;
  n := o;
  n.interests := p_interests;
  n.activities := coalesce(p_activities, '{}');
  n.artists := coalesce(p_artists, '[]'::jsonb);
  n.books := coalesce(p_books, '[]'::jsonb);
  n.screen := coalesce(p_screen, '[]'::jsonb);

  select * into t from profile_takes_v2 where user_id = v_uid for update;
  if found and public.v2_take_subject_title(n, t.subject_kind, t.subject_id) is null then
    if not coalesce(p_remove_take, false) then
      -- Nothing written: the app asks first.
      return jsonb_build_object('ok', false, 'error', 'take_subject_removed', 'take', public.v2_take_json(t));
    end if;
    delete from profile_takes_v2 where id = t.id;
    v_removed := true;
  end if;

  update onboarding_v2 set interests = n.interests, activities = n.activities, artists = n.artists,
    books = n.books, screen = n.screen, updated_at = now()
  where user_id = v_uid;
  return jsonb_build_object('ok', true, 'take_removed', v_removed) || public.get_my_interests_v2();
end;
$$;

create or replace function public.save_take_v2(p_subject_kind text, p_subject_id text, p_question_id text, p_answer text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  o onboarding_v2; t profile_takes_v2; v_title text;
  v_answer text := btrim(coalesce(p_answer, ''));
begin
  if char_length(v_answer) not between 1 and 180 then return jsonb_build_object('ok', false, 'error', 'invalid_answer'); end if;
  if not ((p_subject_kind = 'activity' and p_question_id in ('activity_favourite_part', 'activity_perfect_day'))
       or (p_subject_kind = 'book' and p_question_id in ('book_why', 'book_stayed'))
       or (p_subject_kind = 'screen' and p_question_id in ('screen_why', 'screen_scene'))
       or (p_subject_kind = 'artist' and p_question_id in ('artist_first_song', 'artist_when'))) then
    return jsonb_build_object('ok', false, 'error', 'invalid_question');
  end if;
  -- Locks the selections so a concurrent save_interests_v2 can't remove the
  -- subject in between.
  select * into o from onboarding_v2 where user_id = v_uid for update;
  v_title := public.v2_take_subject_title(o, p_subject_kind, p_subject_id);
  if v_title is null then return jsonb_build_object('ok', false, 'error', 'subject_not_selected'); end if;

  select * into t from profile_takes_v2 where user_id = v_uid for update;
  if found and t.subject_kind = p_subject_kind and t.subject_id = p_subject_id then
    update profile_takes_v2 set question_id = p_question_id, answer = v_answer, subject_title = v_title, updated_at = now()
    where id = t.id returning * into t;
  else
    delete from profile_takes_v2 where user_id = v_uid;
    insert into profile_takes_v2 (user_id, subject_kind, subject_id, subject_title, question_id, answer)
    values (v_uid, p_subject_kind, p_subject_id, v_title, p_question_id, v_answer) returning * into t;
  end if;
  return jsonb_build_object('ok', true, 'take', public.v2_take_json(t));
end;
$$;

create or replace function public.delete_take_v2()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.v2_assert_member_profile_edit(); v_n int;
begin
  -- The take only; the activity / book / film / artist stays selected.
  delete from profile_takes_v2 where user_id = v_uid;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_n > 0);
end;
$$;

-- 4. Public profile: + activities, + take (visibility rule unchanged) --------
create or replace function public.get_profile_v2(p_user uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
    'activities', coalesce(to_jsonb(o.activities), '[]'::jsonb),
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
                        from profile_photos_v2 f where f.user_id = o.user_id), '[]'::jsonb),
    'take', (select jsonb_build_object('subject_kind', t.subject_kind, 'subject_id', t.subject_id, 'subject_title', t.subject_title,
                                       'question_id', t.question_id, 'answer', t.answer)
             from profile_takes_v2 t where t.user_id = o.user_id))
  from onboarding_v2 o
  where o.user_id = p_user
    and public.v2_can_view_public_profile(auth.uid(), p_user)
$function$;

revoke all on function public.v2_activity_label(text) from public, anon;
revoke all on function public.v2_take_json(public.profile_takes_v2) from public, anon, authenticated;
revoke all on function public.v2_take_subject_title(public.onboarding_v2, text, text) from public, anon, authenticated;
revoke all on function public.v2_assert_member_profile_edit() from public, anon, authenticated;
revoke all on function public.get_my_interests_v2() from public, anon;
grant execute on function public.get_my_interests_v2() to authenticated;
revoke all on function public.save_interests_v2(text[], text[], jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_interests_v2(text[], text[], jsonb, jsonb, jsonb, boolean) to authenticated;
revoke all on function public.save_take_v2(text, text, text, text) from public, anon;
grant execute on function public.save_take_v2(text, text, text, text) to authenticated;
revoke all on function public.delete_take_v2() from public, anon;
grant execute on function public.delete_take_v2() to authenticated;
revoke all on function public.get_profile_v2(uuid) from public, anon;
grant execute on function public.get_profile_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
