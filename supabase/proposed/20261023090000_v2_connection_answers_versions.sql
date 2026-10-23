-- V2 onboarding: optional dating-preference questions, version 2 (owner
-- revision 2026-10-23, D104). LOCAL (tempa-local) first; not wired into
-- apply-dev.mjs. Builds on 20261022120000_v2_connection_answers.sql.
--
-- The version-1 draft questions changed meaning, so version 2 has NEW stable
-- question / option ids. Answers are now kept PER VERSION: saving version 2
-- never overwrites version-1 answers (they stay as they are, unread by the
-- app). Rules are unchanged: private, RPCs only, draft applicants only, not
-- used by matching, the public profile, completeness or acceptance.
alter table public.connection_answers_v2 drop constraint if exists connection_answers_v2_pkey;
alter table public.connection_answers_v2 add primary key (user_id, version);

create or replace function public.v2_connection_catalog(p_version int)
returns jsonb language sql immutable as $$
  select case
    when p_version = 1 then jsonb_build_object(
      'meet_new', jsonb_build_array('open_quickly', 'take_time', 'depends'),
      'when_bothered', jsonb_build_array('talk_now', 'time_then_talk', 'depends'),
      'time_together', jsonb_build_array('plans_ahead', 'spontaneous', 'both'),
      'show_care', jsonb_build_array('words', 'quality_time', 'actions', 'mix'))
    when p_version = 2 then jsonb_build_object(
      'plan_first_date', jsonb_build_array('decide_together', 'few_options', 'suggest_first', 'any'),
      'first_date_comfort', jsonb_build_array('short_casual', 'quiet_place', 'small_activity', 'chatted_before'))
    else null end
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
  if v_cat is null then raise exception 'unknown_version' using errcode = '22023'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'invalid_answers' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_answers) loop
    if not (v_cat ? k) or jsonb_typeof(v) <> 'string' or not ((v_cat -> k) ? (v #>> '{}')) then
      raise exception 'invalid_answers' using errcode = '22023', hint = 'unknown question or option id';
    end if;
  end loop;
  insert into connection_answers_v2 (user_id, version, answers, updated_at)
  values (v_me, p_version, p_answers, now())
  on conflict (user_id, version) do update set answers = excluded.answers, updated_at = now();
  return jsonb_build_object('ok', true, 'version', p_version, 'answers', p_answers);
end;
$$;

-- Reads ONE version (default 1 = what the version-1 app asked for).
drop function if exists public.get_my_connection_answers_v2();
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
    'can_edit', exists (select 1 from account_state_v2 where user_id = v_me and application_status = 'draft'));
end;
$$;

revoke all on function public.v2_connection_catalog(int) from public, anon;
grant execute on function public.v2_connection_catalog(int) to authenticated;
revoke all on function public.save_connection_answers_v2(int, jsonb) from public, anon;
grant execute on function public.save_connection_answers_v2(int, jsonb) to authenticated;
revoke all on function public.get_my_connection_answers_v2(int) from public, anon;
grant execute on function public.get_my_connection_answers_v2(int) to authenticated;
