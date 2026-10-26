-- V2: an approved, active member edits a few PUBLIC profile details from
-- Profile → Edit profile (owner decision 2026-10-27, "Package 1"). LOCAL
-- (tempa-local) first; not wired into apply-dev.mjs.
--
-- update_member_profile_v2(p_changes jsonb, p_expected jsonb)
--   • caller: an active V2 member only (v2_assert_member_profile_edit) —
--     drafts, submitted, rejected, suspended and signed-out callers are
--     refused. The general application lock (v2_assert_editable) is NOT
--     relaxed; this is a separate, narrow operation.
--   • only these onboarding_v2 fields: intent ("Looking for", optional),
--     height_cm, work_status (optional), smoking, drinking, pets, pet_kind,
--     activity, date_types, days_pref, time_pref. Any other key → refused.
--     Not touched: job_title (kept when work_status changes), favorite_spot,
--     names, birthday, gender, interested_in, location, prompts, photos,
--     the private D104b preferences, account / review state.
--   • the FINAL values are validated together: required fields stay set,
--     1–2 date types, height 90–250, pet_kind required with "have_pets" and
--     cleared otherwise (a stale kind is cleared automatically).
--   • p_expected = the values the screen loaded for exactly the changed keys;
--     if any differs from the server (changed on another device / screen) →
--     {ok:false, error:'profile_changed'}, nothing written (never a silent
--     overwrite). Field-level, so unrelated edits (e.g. interests) don't
--     conflict.
--   • atomic: the member's onboarding_v2 row is locked, one UPDATE.
--   • none of these fields is copied into `profiles` at acceptance, so no
--     denormalised copy needs syncing; get_profile_v2 reads them live.
create or replace function public.v2_member_profile_fields(o public.onboarding_v2)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'intent', o.intent, 'height_cm', o.height_cm, 'work_status', o.work_status,
    'smoking', o.smoking, 'drinking', o.drinking, 'pets', o.pets, 'pet_kind', o.pet_kind,
    'activity', o.activity, 'date_types', to_jsonb(o.date_types),
    'days_pref', o.days_pref, 'time_pref', o.time_pref)
$$;

create or replace function public.update_member_profile_v2(p_changes jsonb, p_expected jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  v_allowed text[] := array['intent','height_cm','work_status','smoking','drinking','pets','pet_kind',
                            'activity','date_types','days_pref','time_pref'];
  o onboarding_v2;
  v_cur jsonb;
  v_new jsonb;
  k text;
  v_types text[];
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb
     or p_expected is null or jsonb_typeof(p_expected) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;
  for k in select jsonb_object_keys(p_changes) loop
    if not (k = any(v_allowed)) then return jsonb_build_object('ok', false, 'error', 'field_not_editable', 'field', k); end if;
  end loop;
  -- Expected values: exactly the changed keys.
  if (select array_agg(x order by x) from jsonb_object_keys(p_expected) x)
     is distinct from (select array_agg(x order by x) from jsonb_object_keys(p_changes) x) then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  select * into o from onboarding_v2 where user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_cur := public.v2_member_profile_fields(o);
  for k in select jsonb_object_keys(p_expected) loop
    if (v_cur -> k) is distinct from (p_expected -> k) then
      return jsonb_build_object('ok', false, 'error', 'profile_changed', 'field', k);
    end if;
  end loop;

  -- Final values (shape first, then the rules on the merged result).
  v_new := v_cur || p_changes;
  for k in select unnest(array['intent','work_status','smoking','drinking','pets','pet_kind','activity','days_pref','time_pref']) loop
    if jsonb_typeof(v_new -> k) not in ('string', 'null') then return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', k); end if;
  end loop;
  if jsonb_typeof(v_new -> 'height_cm') <> 'number' or (v_new ->> 'height_cm')::numeric <> trunc((v_new ->> 'height_cm')::numeric)
     or (v_new ->> 'height_cm')::numeric not between 90 and 250 then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'height_cm');
  end if;
  if jsonb_typeof(v_new -> 'date_types') <> 'array'
     or exists (select 1 from jsonb_array_elements(v_new -> 'date_types') e where jsonb_typeof(e) <> 'string') then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'date_types');
  end if;
  select coalesce(array_agg(x), '{}') into v_types from jsonb_array_elements_text(v_new -> 'date_types') x;
  if cardinality(v_types) not between 1 and 2 or cardinality(v_types) <> (select count(distinct x) from unnest(v_types) x)
     or not public.v2_is_subset(v_types, array['coffee','drinks','dinner','activity','walk','outdoors'], 2) then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'date_types');
  end if;
  if not public.v2_is_one_of(v_new ->> 'intent', array['long_term','casual','figuring_out']) then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'intent');
  end if;
  if not public.v2_is_one_of(v_new ->> 'work_status', array['full_time','part_time','self_employed','student','between_jobs']) then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'work_status');
  end if;
  if v_new ->> 'smoking' is null or not public.v2_is_one_of(v_new ->> 'smoking', array['no','sometimes','yes'])
     or v_new ->> 'drinking' is null or not public.v2_is_one_of(v_new ->> 'drinking', array['none','sometimes','regularly'])
     or v_new ->> 'pets' is null or not public.v2_is_one_of(v_new ->> 'pets', array['have_pets','like_no_pets','neutral','rather_not'])
     or v_new ->> 'activity' is null or not public.v2_is_one_of(v_new ->> 'activity', array['very','somewhat','not_very'])
     or v_new ->> 'days_pref' is null or not public.v2_is_one_of(v_new ->> 'days_pref', array['weekdays','weekends','either'])
     or v_new ->> 'time_pref' is null or not public.v2_is_one_of(v_new ->> 'time_pref', array['daytime','evening','either']) then
    return jsonb_build_object('ok', false, 'error', 'invalid_value');
  end if;
  -- Pet kind: required with "I have pets"; a stale kind is cleared otherwise.
  if v_new ->> 'pets' = 'have_pets' then
    if v_new ->> 'pet_kind' is null or not public.v2_is_one_of(v_new ->> 'pet_kind', array['dog','cat','both','other']) then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'pet_kind');
    end if;
  else
    v_new := jsonb_set(v_new, '{pet_kind}', 'null'::jsonb);
  end if;

  update onboarding_v2 set
    intent = v_new ->> 'intent',
    height_cm = (v_new ->> 'height_cm')::smallint,
    work_status = v_new ->> 'work_status',
    smoking = v_new ->> 'smoking',
    drinking = v_new ->> 'drinking',
    pets = v_new ->> 'pets',
    pet_kind = v_new ->> 'pet_kind',
    activity = v_new ->> 'activity',
    date_types = v_types,
    days_pref = v_new ->> 'days_pref',
    time_pref = v_new ->> 'time_pref',
    updated_at = now()
  where user_id = v_uid
  returning * into o;
  return jsonb_build_object('ok', true, 'profile', public.v2_member_profile_fields(o));
end;
$$;

revoke all on function public.v2_member_profile_fields(public.onboarding_v2) from public, anon, authenticated;
revoke all on function public.update_member_profile_v2(jsonb, jsonb) from public, anon;
grant execute on function public.update_member_profile_v2(jsonb, jsonb) to authenticated;
