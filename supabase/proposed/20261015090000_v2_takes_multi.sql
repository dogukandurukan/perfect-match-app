-- V2 conversation starters: up to THREE per member (owner decisions
-- 2026-10-15, D94–D97). Builds on 20261014090000_v2_interests_takes.sql.
--
-- NOT applied to the shared remote project (DEV = live). Applied and verified
-- only on the LOCAL Supabase (tempa-local): scripts/local-backend/smoke_takes_local.mjs.
--
--  • 0–3 takes per member, each about a DIFFERENT saved selection (same
--    subject → only one take). Stable display order = `position` 1–3; a take
--    keeps its position when edited or when its subject changes.
--  • Existing takes are kept with their id and content (position 1).
--  • Same subject → updated in place (same id). Another subject for an
--    existing take → that ONE take is replaced by a new row (new id) in the
--    same position; the text is whatever the client sends (never carried).
--  • Removing a selection that takes depend on: refused until confirmed; then
--    the selection change and ONLY the dependent takes go in one transaction.
--  • Limits (3, one per subject) are enforced under the per-user row lock on
--    onboarding_v2 + unique indexes — concurrent requests can't exceed them.
--  • Question keys and stored answers are unchanged. (The display text for
--    activity_perfect_day on Running is a client wording change with the same
--    meaning — see D96.)

alter table public.profile_takes_v2 drop constraint if exists profile_takes_v2_user_id_key;
alter table public.profile_takes_v2 add column if not exists position smallint;
update public.profile_takes_v2 set position = 1 where position is null;
alter table public.profile_takes_v2 alter column position set not null;
alter table public.profile_takes_v2 drop constraint if exists profile_takes_v2_position_check;
alter table public.profile_takes_v2 add constraint profile_takes_v2_position_check check (position between 1 and 3);
create unique index if not exists profile_takes_v2_user_position_uniq on public.profile_takes_v2 (user_id, position);
create unique index if not exists profile_takes_v2_user_subject_uniq on public.profile_takes_v2 (user_id, subject_kind, subject_id);

create or replace function public.v2_take_json(t public.profile_takes_v2)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id, 'position', t.position, 'subject_kind', t.subject_kind, 'subject_id', t.subject_id,
    'subject_title', t.subject_title, 'question_id', t.question_id, 'answer', t.answer, 'updated_at', t.updated_at) end
$$;

create or replace function public.v2_my_takes_json(p_user uuid)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(public.v2_take_json(t) order by t.position), '[]'::jsonb)
  from public.profile_takes_v2 t where t.user_id = p_user
$$;

create or replace function public.get_my_interests_v2()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); o onboarding_v2;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into o from onboarding_v2 where user_id = v_uid;
  return jsonb_build_object(
    'editable', public.is_active_v2_member(v_uid),
    'interests', coalesce(to_jsonb(o.interests), '[]'::jsonb),
    'activities', coalesce(to_jsonb(o.activities), '[]'::jsonb),
    'artists', coalesce(o.artists, '[]'::jsonb),
    'books', coalesce(o.books, '[]'::jsonb),
    'screen', coalesce(o.screen, '[]'::jsonb),
    'takes', public.v2_my_takes_json(v_uid));
end;
$$;

create or replace function public.save_interests_v2(
  p_interests text[], p_activities text[], p_artists jsonb, p_books jsonb, p_screen jsonb, p_remove_take boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  o onboarding_v2; n onboarding_v2;
  v_orphans jsonb;
  v_removed int := 0;
begin
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
          and public.v2_is_taste_list(coalesce(p_screen, '[]'::jsonb), 'screen')) then
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

  -- Takes whose subject would disappear (only those).
  select coalesce(jsonb_agg(public.v2_take_json(t) order by t.position), '[]'::jsonb) into v_orphans
  from profile_takes_v2 t
  where t.user_id = v_uid and public.v2_take_subject_title(n, t.subject_kind, t.subject_id) is null;

  if jsonb_array_length(v_orphans) > 0 then
    if not coalesce(p_remove_take, false) then
      return jsonb_build_object('ok', false, 'error', 'take_subject_removed', 'takes', v_orphans);
    end if;
    delete from profile_takes_v2 t
    where t.user_id = v_uid and public.v2_take_subject_title(n, t.subject_kind, t.subject_id) is null;
    get diagnostics v_removed = row_count;
  end if;

  update onboarding_v2 set interests = n.interests, activities = n.activities, artists = n.artists,
    books = n.books, screen = n.screen, updated_at = now()
  where user_id = v_uid;
  return jsonb_build_object('ok', true, 'takes_removed', v_removed) || public.get_my_interests_v2();
end;
$$;

drop function if exists public.save_take_v2(text, text, text, text);
create or replace function public.save_take_v2(p_take_id uuid, p_subject_kind text, p_subject_id text, p_question_id text, p_answer text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  o onboarding_v2; t profile_takes_v2; v_title text; v_pos smallint;
  v_answer text := btrim(coalesce(p_answer, ''));
begin
  if char_length(v_answer) not between 1 and 180 then return jsonb_build_object('ok', false, 'error', 'invalid_answer'); end if;
  if not ((p_subject_kind = 'activity' and p_question_id in ('activity_favourite_part', 'activity_perfect_day'))
       or (p_subject_kind = 'book' and p_question_id in ('book_why', 'book_stayed'))
       or (p_subject_kind = 'screen' and p_question_id in ('screen_why', 'screen_scene'))
       or (p_subject_kind = 'artist' and p_question_id in ('artist_first_song', 'artist_when'))) then
    return jsonb_build_object('ok', false, 'error', 'invalid_question');
  end if;
  -- Per-user lock: serializes every take / selection change of this member,
  -- so the 3-limit and one-per-subject hold under concurrent requests.
  select * into o from onboarding_v2 where user_id = v_uid for update;
  v_title := public.v2_take_subject_title(o, p_subject_kind, p_subject_id);
  if v_title is null then return jsonb_build_object('ok', false, 'error', 'subject_not_selected'); end if;

  if p_take_id is null then
    -- Add: never overwrites another take.
    if exists (select 1 from profile_takes_v2 where user_id = v_uid and subject_kind = p_subject_kind and subject_id = p_subject_id) then
      return jsonb_build_object('ok', false, 'error', 'subject_taken');
    end if;
    select min(p) into v_pos from generate_series(1, 3) p
    where not exists (select 1 from profile_takes_v2 x where x.user_id = v_uid and x.position = p);
    if v_pos is null then return jsonb_build_object('ok', false, 'error', 'limit_reached'); end if;
    insert into profile_takes_v2 (user_id, position, subject_kind, subject_id, subject_title, question_id, answer)
    values (v_uid, v_pos, p_subject_kind, p_subject_id, v_title, p_question_id, v_answer) returning * into t;
    return jsonb_build_object('ok', true, 'take', public.v2_take_json(t));
  end if;

  select * into t from profile_takes_v2 where id = p_take_id and user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if t.subject_kind = p_subject_kind and t.subject_id = p_subject_id then
    update profile_takes_v2 set question_id = p_question_id, answer = v_answer, subject_title = v_title, updated_at = now()
    where id = t.id returning * into t;
  else
    if exists (select 1 from profile_takes_v2 where user_id = v_uid and subject_kind = p_subject_kind and subject_id = p_subject_id) then
      return jsonb_build_object('ok', false, 'error', 'subject_taken');
    end if;
    v_pos := t.position;
    delete from profile_takes_v2 where id = t.id;
    insert into profile_takes_v2 (user_id, position, subject_kind, subject_id, subject_title, question_id, answer)
    values (v_uid, v_pos, p_subject_kind, p_subject_id, v_title, p_question_id, v_answer) returning * into t;
  end if;
  return jsonb_build_object('ok', true, 'take', public.v2_take_json(t));
end;
$$;

drop function if exists public.delete_take_v2();
create or replace function public.delete_take_v2(p_take_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.v2_assert_member_profile_edit(); v_n int;
begin
  perform 1 from onboarding_v2 where user_id = v_uid for update;
  -- This take only; its selection and the other takes stay.
  delete from profile_takes_v2 where id = p_take_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

-- Public profile: `takes` (0–3, by position) replaces `take`; rule unchanged.
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
    'takes', coalesce((select jsonb_agg(jsonb_build_object('subject_kind', t.subject_kind, 'subject_id', t.subject_id,
                                                           'subject_title', t.subject_title, 'question_id', t.question_id,
                                                           'answer', t.answer) order by t.position)
                       from profile_takes_v2 t where t.user_id = o.user_id), '[]'::jsonb))
  from onboarding_v2 o
  where o.user_id = p_user
    and public.v2_can_view_public_profile(auth.uid(), p_user)
$function$;

revoke all on function public.v2_take_json(public.profile_takes_v2) from public, anon, authenticated;
revoke all on function public.v2_my_takes_json(uuid) from public, anon, authenticated;
revoke all on function public.get_my_interests_v2() from public, anon;
grant execute on function public.get_my_interests_v2() to authenticated;
revoke all on function public.save_interests_v2(text[], text[], jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_interests_v2(text[], text[], jsonb, jsonb, jsonb, boolean) to authenticated;
revoke all on function public.save_take_v2(uuid, text, text, text, text) from public, anon;
grant execute on function public.save_take_v2(uuid, text, text, text, text) to authenticated;
revoke all on function public.delete_take_v2(uuid) from public, anon;
grant execute on function public.delete_take_v2(uuid) to authenticated;
revoke all on function public.get_profile_v2(uuid) from public, anon;
grant execute on function public.get_profile_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
