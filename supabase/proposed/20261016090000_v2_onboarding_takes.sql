-- D93: an application is complete with two standard answers OR one standard
-- answer + one conversation starter (owner decision 2026-10-14, implemented
-- 2026-10-16). Builds on 20261014090000 / 20261015090000.
--
-- NOT applied to the shared remote project (DEV = live). Applied and verified
-- only on the LOCAL Supabase (tempa-local): scripts/local-backend/smoke_onboarding_takes_local.mjs.
--
--  1. v2_missing_for: 'yourProfile.prompts' is missing unless the member has
--     ≥ 2 valid standard answers, or ≥ 1 valid standard answer + ≥ 1 valid
--     conversation starter (non-blank answer whose subject is still one of
--     the saved selections). Starters alone are never enough. Every other
--     requirement is unchanged. submit_application_v2 already refuses on any
--     missing item, so a direct API submit can't skip it.
--  2. v2_assert_take_writer: starters may be written by (a) active approved
--     members (unchanged) or (b) the applicant themself while the application
--     is EDITABLE (draft / changes_requested — the existing v2_assert_editable
--     rule). Submitted (pending review), rejected, accepted-but-not-active
--     (e.g. suspended) and signed-out callers are refused. The general
--     application lock is not changed. Only save_take_v2 / delete_take_v2 use
--     it; save_interests_v2 stays members-only.
--  3. save_onboarding_v2 (Your World): also stores `activities` (same 12-key
--     catalog, ≤ 5) and refuses to remove a subject that starters depend on
--     ('take_subject_removed', titles in DETAIL) unless confirm_remove_takes
--     is true; then only those starters are deleted in the same transaction.
--     Everything else in the function is unchanged.
--  Standard answers: save_prompts_v2 is NOT changed (applicants only — their
--  rows have no likes before acceptance); existing members' prompt rows and
--  ids are untouched.

create or replace function public.v2_assert_take_writer()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if public.is_active_v2_member(v_uid) then return v_uid; end if;
  -- Applicants: only while their own application is editable (raises
  -- application_locked otherwise — submitted, rejected, suspended, …).
  perform public.v2_assert_editable();
  return v_uid;
end;
$$;

create or replace function public.v2_valid_take_count(p_uid uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int
  from profile_takes_v2 t join onboarding_v2 o on o.user_id = t.user_id
  where t.user_id = p_uid and btrim(t.answer) <> '' and public.v2_take_subject_title(o, t.subject_kind, t.subject_id) is not null
$$;

create or replace function public.v2_missing_for(p_uid uuid)
 returns text[]
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select array_remove(array[
    case when o.first_name is null or o.last_name is null then 'basics.name' end,
    case when o.date_of_birth is null then 'basics.birthday' end,
    case when o.gender is null then 'basics.gender' end,
    case when coalesce(cardinality(o.interested_in), 0) = 0 then 'basics.interested_in' end,
    case when o.location_city is null then 'basics.location' end,
    case when o.height_cm is null then 'basics.height' end,
    case when o.intent is null or o.social_energy is null or o.message_frequency is null
           or o.relationship_space is null or o.emotional_expression is null or o.meeting_pace is null
         then 'compatibility.answers' end,
    case when coalesce(cardinality(o.core_values), 0) not between 1 and 2 then 'compatibility.values' end,
    case when o.smoking is null or o.drinking is null or o.pets is null or o.activity is null then 'yourLife.answers' end,
    case when o.pets = 'have_pets' and o.pet_kind is null then 'yourLife.pet_kind' end,
    case when coalesce(cardinality(o.interests), 0) not between 1 and 10 then 'yourWorld.interests' end,
    case when coalesce(cardinality(o.date_types), 0) not between 1 and 2 then 'yourDates.date_types' end,
    case when o.days_pref is null or o.time_pref is null then 'yourDates.when' end,
    case when (select count(*) from profile_photos_v2 f where f.user_id = p_uid) not between 3 and 6 then 'yourProfile.photos' end,
    -- NEW (D93): 2 standard answers, or 1 standard answer + 1 conversation starter.
    case when not (
           (select count(*) from profile_prompts_v2 p where p.user_id = p_uid and btrim(p.answer) <> '') >= 2
        or ((select count(*) from profile_prompts_v2 p where p.user_id = p_uid and btrim(p.answer) <> '') >= 1
            and public.v2_valid_take_count(p_uid) >= 1))
         then 'yourProfile.prompts' end,
    case when s.selfie_path is null then 'yourProfile.selfie' end,
    case when u.email_confirmed_at is null then 'account.email' end,
    case when pr.privacy_consent_at is null then 'account.consent' end
  ], null)
  from onboarding_v2 o
  join account_state_v2 s on s.user_id = o.user_id
  join profiles pr on pr.id = o.user_id
  left join auth.users u on u.id = o.user_id
  where o.user_id = p_uid
$function$;

create or replace function public.save_take_v2(p_take_id uuid, p_subject_kind text, p_subject_id text, p_question_id text, p_answer text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.v2_assert_take_writer();
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

create or replace function public.delete_take_v2(p_take_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.v2_assert_take_writer(); v_n int;
begin
  perform 1 from onboarding_v2 where user_id = v_uid for update;
  -- This take only; its selection and the other takes stay.
  delete from profile_takes_v2 where id = p_take_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

CREATE OR REPLACE FUNCTION public.save_onboarding_v2(p_section text, p_data jsonb, p_resume_step smallint DEFAULT NULL::smallint, p_resume_section text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_allowed text[];
  v_bad text;
  v_next onboarding_v2;
  v_orphans text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_ensure_me();
  perform public.v2_assert_editable();
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_allowed := case p_section
    when 'basics' then array['first_name','last_name','date_of_birth','gender','interested_in','location_id',
                             'location_city','location_district','location_label','height_cm']
    when 'compatibility' then array['intent','social_energy','message_frequency','relationship_space',
                                    'emotional_expression','meeting_pace','core_values']
    when 'yourLife' then array['smoking','drinking','pets','pet_kind','activity']
    when 'yourWorld' then array['work_status','job_title','school','hometown','interests','activities','artists','books','screen','confirm_remove_takes']
    when 'yourDates' then array['date_types','favorite_spot','days_pref','time_pref']
    when 'yourProfile' then array[]::text[]
    else null end;
  if v_allowed is null then raise exception 'invalid_section' using errcode = '22023'; end if;
  if p_resume_section is not null and p_resume_section not in
     ('basics','compatibility','yourLife','yourWorld','yourDates','yourProfile') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  select k into v_bad from jsonb_object_keys(p_data) k where k <> all(v_allowed) limit 1;
  if v_bad is not null then raise exception 'unknown_field: %', v_bad using errcode = '22023'; end if;

  if p_data ? 'date_of_birth' and p_data ->> 'date_of_birth' is not null then
    if (p_data ->> 'date_of_birth')::date > current_date - interval '18 years'
       or (p_data ->> 'date_of_birth')::date < current_date - interval '120 years' then
      raise exception 'invalid_date_of_birth' using errcode = '23514';
    end if;
  end if;

  -- NEW (2026-10-16, D93): conversation starters depend on the Your World
  -- selections. Removing a subject that starters are about is refused until
  -- the client confirms (confirm_remove_takes = true); then ONLY those
  -- starters are deleted, in this same transaction.
  if p_section = 'yourWorld' then
    select * into v_next from onboarding_v2 where user_id = v_uid for update;
    if p_data ? 'activities' then
      v_next.activities := coalesce((select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'activities', 'null'::jsonb)) x), '{}');
    end if;
    if p_data ? 'artists' then v_next.artists := nullif(p_data -> 'artists', 'null'::jsonb); end if;
    if p_data ? 'books' then v_next.books := nullif(p_data -> 'books', 'null'::jsonb); end if;
    if p_data ? 'screen' then v_next.screen := nullif(p_data -> 'screen', 'null'::jsonb); end if;
    select string_agg(t.subject_title, ', ' order by t.position) into v_orphans
    from profile_takes_v2 t
    where t.user_id = v_uid and public.v2_take_subject_title(v_next, t.subject_kind, t.subject_id) is null;
    if v_orphans is not null then
      if coalesce((p_data ->> 'confirm_remove_takes')::boolean, false) is not true then
        raise exception 'take_subject_removed' using errcode = 'P0001', detail = v_orphans;
      end if;
      delete from profile_takes_v2 t
      where t.user_id = v_uid and public.v2_take_subject_title(v_next, t.subject_kind, t.subject_id) is null;
    end if;
  end if;

  update onboarding_v2 o set
    first_name = case when p_data ? 'first_name' then nullif(btrim(p_data ->> 'first_name'), '') else o.first_name end,
    last_name = case when p_data ? 'last_name' then nullif(btrim(p_data ->> 'last_name'), '') else o.last_name end,
    date_of_birth = case when p_data ? 'date_of_birth' then (p_data ->> 'date_of_birth')::date else o.date_of_birth end,
    gender = case when p_data ? 'gender' then p_data ->> 'gender' else o.gender end,
    interested_in = case when p_data ? 'interested_in' then
      (select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'interested_in', 'null'::jsonb)) x) else o.interested_in end,
    location_id = case when p_data ? 'location_id' then p_data ->> 'location_id' else o.location_id end,
    location_city = case when p_data ? 'location_city' then p_data ->> 'location_city' else o.location_city end,
    location_district = case when p_data ? 'location_district' then p_data ->> 'location_district' else o.location_district end,
    location_label = case when p_data ? 'location_label' then p_data ->> 'location_label' else o.location_label end,
    height_cm = case when p_data ? 'height_cm' then (p_data ->> 'height_cm')::smallint else o.height_cm end,
    intent = case when p_data ? 'intent' then p_data ->> 'intent' else o.intent end,
    social_energy = case when p_data ? 'social_energy' then p_data ->> 'social_energy' else o.social_energy end,
    message_frequency = case when p_data ? 'message_frequency' then p_data ->> 'message_frequency' else o.message_frequency end,
    relationship_space = case when p_data ? 'relationship_space' then p_data ->> 'relationship_space' else o.relationship_space end,
    emotional_expression = case when p_data ? 'emotional_expression' then p_data ->> 'emotional_expression' else o.emotional_expression end,
    meeting_pace = case when p_data ? 'meeting_pace' then p_data ->> 'meeting_pace' else o.meeting_pace end,
    core_values = case when p_data ? 'core_values' then
      (select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'core_values', 'null'::jsonb)) x) else o.core_values end,
    smoking = case when p_data ? 'smoking' then p_data ->> 'smoking' else o.smoking end,
    drinking = case when p_data ? 'drinking' then p_data ->> 'drinking' else o.drinking end,
    pets = case when p_data ? 'pets' then p_data ->> 'pets' else o.pets end,
    pet_kind = case when p_data ? 'pet_kind' then p_data ->> 'pet_kind'
                    when p_data ? 'pets' and p_data ->> 'pets' is distinct from 'have_pets' then null else o.pet_kind end,
    activity = case when p_data ? 'activity' then p_data ->> 'activity' else o.activity end,
    work_status = case when p_data ? 'work_status' then p_data ->> 'work_status' else o.work_status end,
    job_title = case when p_data ? 'job_title' then nullif(btrim(p_data ->> 'job_title'), '') else o.job_title end,
    school = case when p_data ? 'school' then nullif(p_data -> 'school', 'null'::jsonb) else o.school end,
    hometown = case when p_data ? 'hometown' then nullif(p_data -> 'hometown', 'null'::jsonb) else o.hometown end,
    interests = case when p_data ? 'interests' then
      (select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'interests', 'null'::jsonb)) x) else o.interests end,
    artists = case when p_data ? 'artists' then nullif(p_data -> 'artists', 'null'::jsonb) else o.artists end,
    books = case when p_data ? 'books' then nullif(p_data -> 'books', 'null'::jsonb) else o.books end,
    screen = case when p_data ? 'screen' then nullif(p_data -> 'screen', 'null'::jsonb) else o.screen end,
    activities = case when p_data ? 'activities' then
      coalesce((select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'activities', 'null'::jsonb)) x), '{}') else o.activities end,
    date_types = case when p_data ? 'date_types' then
      (select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'date_types', 'null'::jsonb)) x) else o.date_types end,
    favorite_spot = case when p_data ? 'favorite_spot' then nullif(btrim(p_data ->> 'favorite_spot'), '') else o.favorite_spot end,
    days_pref = case when p_data ? 'days_pref' then p_data ->> 'days_pref' else o.days_pref end,
    time_pref = case when p_data ? 'time_pref' then p_data ->> 'time_pref' else o.time_pref end,
    resume_section = coalesce(p_resume_section, case when p_resume_step is not null then p_section end, o.resume_section),
    resume_step = coalesce(p_resume_step, o.resume_step),
    updated_at = now()
  where o.user_id = v_uid;
  return jsonb_build_object('saved', true, 'section', p_section);
end;
$function$;

revoke all on function public.v2_assert_take_writer() from public, anon, authenticated;
revoke all on function public.v2_valid_take_count(uuid) from public, anon, authenticated;
revoke all on function public.save_take_v2(uuid, text, text, text, text) from public, anon;
grant execute on function public.save_take_v2(uuid, text, text, text, text) to authenticated;
revoke all on function public.delete_take_v2(uuid) from public, anon;
grant execute on function public.delete_take_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
