-- V2 onboarding: optional "How do you connect?" questions before the first
-- submit (owner decisions 2026-10-22, D104 — first draft, the questions will
-- change). LOCAL (tempa-local) first; not wired into apply-dev.mjs.
--
-- connection_answers_v2: one row per applicant — the question set version and
-- {question_id: option_id} with stable ids (never display text). Partial
-- answers and an empty set are valid; nothing is required.
--   • PRIVATE: no other user can read it; it is NOT used by matching, the
--     public profile, review completeness (v2_missing_for is unchanged, D93
--     unchanged) or acceptance.
--   • written only by the applicant themself while their application is still
--     a DRAFT (v2_assert_editable + status 'draft'): approved members are never
--     asked again; submitted / changes-requested applications keep what they had.
--   • version 1 only; unknown question or option ids are refused.
create table if not exists public.connection_answers_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version integer not null,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.connection_answers_v2 enable row level security; -- no policies: RPCs only
revoke all on public.connection_answers_v2 from anon, authenticated;

-- The version-1 catalog (ids only; texts live in the app).
create or replace function public.v2_connection_catalog(p_version int)
returns jsonb language sql immutable as $$
  select case when p_version = 1 then jsonb_build_object(
    'meet_new', jsonb_build_array('open_quickly', 'take_time', 'depends'),
    'when_bothered', jsonb_build_array('talk_now', 'time_then_talk', 'depends'),
    'time_together', jsonb_build_array('plans_ahead', 'spontaneous', 'both'),
    'show_care', jsonb_build_array('words', 'quality_time', 'actions', 'mix'))
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
  on conflict (user_id) do update set version = excluded.version, answers = excluded.answers, updated_at = now();
  return jsonb_build_object('ok', true, 'version', p_version, 'answers', p_answers);
end;
$$;

create or replace function public.get_my_connection_answers_v2()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  r record;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select version, answers into r from connection_answers_v2 where user_id = v_me;
  return jsonb_build_object('version', r.version, 'answers', coalesce(r.answers, '{}'::jsonb),
    'can_edit', exists (select 1 from account_state_v2 where user_id = v_me and application_status = 'draft'));
end;
$$;

revoke all on function public.v2_connection_catalog(int) from public, anon;
grant execute on function public.v2_connection_catalog(int) to authenticated;
revoke all on function public.save_connection_answers_v2(int, jsonb) from public, anon;
grant execute on function public.save_connection_answers_v2(int, jsonb) to authenticated;
revoke all on function public.get_my_connection_answers_v2() from public, anon;
grant execute on function public.get_my_connection_answers_v2() to authenticated;
