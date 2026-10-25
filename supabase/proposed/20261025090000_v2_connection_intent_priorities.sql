-- V2 onboarding: "What you're looking for" — intention, priorities and
-- connection style, version 3 (owner 2026-10-25, D104b). LOCAL (tempa-local)
-- first; not wired into apply-dev.mjs. Builds on
-- 20261022120000_v2_connection_answers.sql and
-- 20261023090000_v2_connection_answers_versions.sql.
--
-- Version 3 has new meanings and new stable ids. Version-1/2 answers stay as
-- they are (kept per version; never converted).
--   answers = {
--     intent:          one of one_night|casual|see_where|long_term|marriage|figuring_out
--     intent_also:     [concrete intents, not figuring_out, not the main one]   (needs intent)
--     priorities_none: true                                                    (not with priorities)
--     priorities:      { topic: { detail: 'preference'|'must_have' } }  1–3 topics, each ≥1 detail;
--                      children = exactly one detail; interests = 1–3 of the user's OWN interests
--     connection:      1–2 of regular_contact|gradual|own_space|open_talk|own_rhythm, or ['not_sure'] alone
--   }  — every key optional (partial answers are valid).
--
-- Intention is asked once: while the app section is on, the old Compatibility
-- intent step is hidden, so completeness accepts EITHER the old
-- onboarding_v2.intent OR a version-3 main intention. They are never mapped
-- onto each other; the version-3 intention is private (not in
-- get_profile_v2) and, like everything here, not used by matching.
-- Everything else in v2_missing_for is unchanged.

create or replace function public.v2_connection_check_v3(p_uid uuid, a jsonb)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  k text; v jsonb; d text; imp jsonb;
  v_intents text[] := array['one_night','casual','see_where','long_term','marriage','figuring_out'];
  v_also text[] := array['one_night','casual','see_where','long_term','marriage'];
  v_conn text[] := array['regular_contact','gradual','own_space','open_talk','own_rhythm','not_sure'];
  v_details jsonb := jsonb_build_object(
    'active', jsonb_build_array('exercises','active_together'),
    'education', jsonb_build_array('degree'),
    'career', jsonb_build_array('steady_job','values_career'),
    'money', jsonb_build_array('independent','similar_spending'),
    'living', jsonb_build_array('lives_alone','similar_routine'),
    'children', jsonb_build_array('wants','does_not_want','deciding'));
  v_interests text[];
  v_arr text[];
begin
  if a is null or jsonb_typeof(a) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(a) loop
    if k not in ('intent','intent_also','priorities_none','priorities','connection') then return false; end if;
  end loop;
  if a ? 'intent' and (jsonb_typeof(a->'intent') <> 'string' or not ((a->>'intent') = any(v_intents))) then return false; end if;
  if a ? 'intent_also' then
    if not (a ? 'intent') or jsonb_typeof(a->'intent_also') <> 'array' then return false; end if;
    if exists (select 1 from jsonb_array_elements(a->'intent_also') e where jsonb_typeof(e) <> 'string') then return false; end if;
    select array_agg(x) into v_arr from jsonb_array_elements_text(a->'intent_also') x;
    if cardinality(v_arr) = 0 or cardinality(v_arr) <> (select count(distinct x) from unnest(v_arr) x)
       or not (v_arr <@ v_also) or (a->>'intent') = any(v_arr) then return false; end if;
  end if;
  if a ? 'priorities_none' then
    if a->'priorities_none' <> 'true'::jsonb or a ? 'priorities' then return false; end if;
  end if;
  if a ? 'priorities' then
    if jsonb_typeof(a->'priorities') <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(a->'priorities')) not between 1 and 3 then return false; end if;
    select coalesce(o.interests, '{}') into v_interests from onboarding_v2 o where o.user_id = p_uid;
    for k, v in select * from jsonb_each(a->'priorities') loop
      if jsonb_typeof(v) <> 'object' or (select count(*) from jsonb_object_keys(v)) = 0 then return false; end if;
      if k = 'interests' then
        if (select count(*) from jsonb_object_keys(v)) > 3 then return false; end if;
      elsif not (v_details ? k) then return false;
      elsif k = 'children' and (select count(*) from jsonb_object_keys(v)) <> 1 then return false;
      end if;
      for d, imp in select * from jsonb_each(v) loop
        if imp not in ('"preference"'::jsonb, '"must_have"'::jsonb) then return false; end if;
        if k = 'interests' then
          if d = 'other' or not (d = any(coalesce(v_interests, '{}'))) then return false; end if;
        elsif not ((v_details -> k) ? d) then return false;
        end if;
      end loop;
    end loop;
  end if;
  if a ? 'connection' then
    if jsonb_typeof(a->'connection') <> 'array' then return false; end if;
    if exists (select 1 from jsonb_array_elements(a->'connection') e where jsonb_typeof(e) <> 'string') then return false; end if;
    select array_agg(x) into v_arr from jsonb_array_elements_text(a->'connection') x;
    if cardinality(v_arr) not between 1 and 2 or cardinality(v_arr) <> (select count(distinct x) from unnest(v_arr) x)
       or not (v_arr <@ v_conn) or ('not_sure' = any(v_arr) and cardinality(v_arr) > 1) then return false; end if;
  end if;
  return true;
end;
$$;

create or replace function public.save_connection_answers_v2(p_version int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_cat jsonb := public.v2_connection_catalog(p_version);
  k text;
  v jsonb;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_assert_editable();
  if not exists (select 1 from account_state_v2 where user_id = v_me and application_status = 'draft') then
    raise exception 'application_locked' using errcode = '42501', hint = 'connection answers are only asked before the first submit';
  end if;
  if p_version = 3 then
    if not public.v2_connection_check_v3(v_me, p_answers) then
      raise exception 'invalid_answers' using errcode = '22023', hint = 'version 3 answers do not match the rules';
    end if;
  else
    if v_cat is null then raise exception 'unknown_version' using errcode = '22023'; end if;
    if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'invalid_answers' using errcode = '22023'; end if;
    for k, v in select * from jsonb_each(p_answers) loop
      if not (v_cat ? k) or jsonb_typeof(v) <> 'string' or not ((v_cat -> k) ? (v #>> '{}')) then
        raise exception 'invalid_answers' using errcode = '22023', hint = 'unknown question or option id';
      end if;
    end loop;
  end if;
  insert into connection_answers_v2 (user_id, version, answers, updated_at)
  values (v_me, p_version, p_answers, now())
  on conflict (user_id, version) do update set answers = excluded.answers, updated_at = now();
  return jsonb_build_object('ok', true, 'version', p_version, 'answers', p_answers);
end;
$$;

-- Same reader, plus the versions this server supports (an app asking for
-- version 3 on an older server must not show the section).
create or replace function public.get_my_connection_answers_v2(p_version int default 1)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  r record;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select version, answers into r from connection_answers_v2 where user_id = v_me and version = p_version;
  return jsonb_build_object('version', r.version, 'answers', coalesce(r.answers, '{}'::jsonb),
    'can_edit', exists (select 1 from account_state_v2 where user_id = v_me and application_status = 'draft'),
    'supports', jsonb_build_array(1, 2, 3));
end;
$$;

create or replace function public.v2_connection_has_intent(p_uid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from connection_answers_v2 c where c.user_id = p_uid and c.version = 3 and c.answers ? 'intent')
$$;

-- Completeness: unchanged except the intention may come from either place.
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
    case when (o.intent is null and not public.v2_connection_has_intent(p_uid)) or o.social_energy is null or o.message_frequency is null
           or o.relationship_space is null or o.emotional_expression is null or o.meeting_pace is null
         then 'compatibility.answers' end,
    case when coalesce(cardinality(o.core_values), 0) not between 1 and 2 then 'compatibility.values' end,
    case when o.smoking is null or o.drinking is null or o.pets is null or o.activity is null then 'yourLife.answers' end,
    case when o.pets = 'have_pets' and o.pet_kind is null then 'yourLife.pet_kind' end,
    case when coalesce(cardinality(o.interests), 0) not between 1 and 10 then 'yourWorld.interests' end,
    case when coalesce(cardinality(o.date_types), 0) not between 1 and 2 then 'yourDates.date_types' end,
    case when o.days_pref is null or o.time_pref is null then 'yourDates.when' end,
    case when (select count(*) from profile_photos_v2 f where f.user_id = p_uid) not between 3 and 6 then 'yourProfile.photos' end,
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

revoke all on function public.v2_connection_check_v3(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.v2_connection_has_intent(uuid) from public, anon, authenticated;
revoke all on function public.save_connection_answers_v2(int, jsonb) from public, anon;
grant execute on function public.save_connection_answers_v2(int, jsonb) to authenticated;
revoke all on function public.get_my_connection_answers_v2(int) from public, anon;
grant execute on function public.get_my_connection_answers_v2(int) to authenticated;
