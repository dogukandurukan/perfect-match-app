-- V2 Activity: profile visits (owner decisions 2026-10-22, D103). LOCAL
-- (tempa-local) first; not wired into apply-dev.mjs.
--
-- One row per (visitor, visited) pair. A visit = an active member really
-- opened another member's FULL profile and it loaded (the app calls
-- record_profile_visit_v2 only then). No history is back-filled: rows start
-- with real opens after this package.
--   • first open → "Viewed your profile"; a later open at least
--     v2_profile_visit_window() (24 h, a documented product constant — change
--     it by redefining that function) after the last COUNTED visit →
--     "Visited again". Opens inside the window change nothing, so repeated
--     requests / re-renders never fake a "Visited again". The exact number of
--     visits is never returned.
--   • a visit is recorded only after the visitor acknowledged that visits are
--     visible to the other person (account_state_v2.visits_notice_ack_at,
--     ack_profile_visits_notice_v2) — no hidden visits.
--   • only for a visible pair (v2_can_view_public_profile: active members,
--     eligible or matched, no block, not unmatched); never one's own profile;
--     never written for someone else (the visitor is always auth.uid()).
--   • get_my_profile_visits_v2: only MY visitors, still visible to me (blocked,
--     deleted, suspended or no-longer-visible people are left out). Identity
--     follows the likes rule (D84 / owner 2026-10-22): premium → people;
--     otherwise → only how many people visited.
--   • visits create no like, match or notification, and are not part of the
--     Activity unseen-likes badge.

create table if not exists public.profile_visits_v2 (
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  visited_id uuid not null references public.profiles(id) on delete cascade,
  first_visit_at timestamptz not null default now(),
  last_visit_at timestamptz not null default now(),
  visits integer not null default 1 check (visits >= 1),
  primary key (visitor_id, visited_id),
  constraint profile_visits_v2_not_self check (visitor_id <> visited_id)
);
create index if not exists profile_visits_v2_visited_idx on public.profile_visits_v2 (visited_id, last_visit_at desc);
alter table public.profile_visits_v2 enable row level security; -- no policies: RPCs only
revoke all on public.profile_visits_v2 from anon, authenticated;

alter table public.account_state_v2 add column if not exists visits_notice_ack_at timestamptz;

-- Product constant: how long after the last counted visit a new open counts again.
create or replace function public.v2_profile_visit_window()
returns interval language sql immutable as $$ select interval '24 hours' $$;

create or replace function public.ack_profile_visits_notice_v2()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_v2_member(v_me) then return jsonb_build_object('ok', false, 'reason', 'not_member'); end if;
  update account_state_v2 set visits_notice_ack_at = coalesce(visits_notice_ack_at, now()) where user_id = v_me;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.record_profile_visit_v2(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_visits int;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_v2_member(v_me) then return jsonb_build_object('recorded', false, 'reason', 'not_member'); end if;
  if p_user is null or p_user = v_me then return jsonb_build_object('recorded', false, 'reason', 'own'); end if;
  if not exists (select 1 from account_state_v2 where user_id = v_me and visits_notice_ack_at is not null) then
    return jsonb_build_object('recorded', false, 'reason', 'notice_required');
  end if;
  if not public.v2_can_view_public_profile(v_me, p_user) or public.v2_is_suspended(p_user) then
    return jsonb_build_object('recorded', false, 'reason', 'not_visible');
  end if;
  insert into profile_visits_v2 as v (visitor_id, visited_id)
  values (v_me, p_user)
  on conflict (visitor_id, visited_id) do update
    set visits = v.visits + 1, last_visit_at = now()
    where v.last_visit_at <= now() - public.v2_profile_visit_window()
  returning visits into v_visits;
  if v_visits is null then return jsonb_build_object('recorded', false, 'reason', 'within_window'); end if;
  return jsonb_build_object('recorded', true, 'again', v_visits > 1);
end;
$$;

create or replace function public.get_my_profile_visits_v2()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_premium boolean;
  v_count int;
  v_list jsonb;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_v2_member(v_me) then
    return jsonb_build_object('member', false, 'premium', false, 'count', 0, 'visits', '[]'::jsonb, 'notice_ack', false);
  end if;
  select coalesce(p.is_premium, false) into v_premium from profiles p where p.id = v_me;
  v_premium := coalesce(v_premium, false);
  with visible as (
    select pv.* from profile_visits_v2 pv
    where pv.visited_id = v_me
      and public.v2_can_view_public_profile(v_me, pv.visitor_id)
      and not public.v2_is_suspended(pv.visitor_id)
  )
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'user_id', vi.visitor_id,
           'first_name', public.v2_display_name(vi.visitor_id),
           'age', date_part('year', age(o.date_of_birth))::int,
           'city', o.location_city,
           'photo_path', public.v2_main_photo(vi.visitor_id),
           'last_visit_at', vi.last_visit_at,
           'again', vi.visits > 1) order by vi.last_visit_at desc) filter (where v_premium), '[]'::jsonb)
    into v_count, v_list
  from visible vi
  left join onboarding_v2 o on o.user_id = vi.visitor_id;
  return jsonb_build_object('member', true, 'premium', v_premium, 'count', v_count, 'visits', v_list,
    'notice_ack', exists (select 1 from account_state_v2 where user_id = v_me and visits_notice_ack_at is not null));
end;
$$;

revoke all on function public.v2_profile_visit_window() from public, anon;
grant execute on function public.v2_profile_visit_window() to authenticated;
revoke all on function public.ack_profile_visits_notice_v2() from public, anon;
grant execute on function public.ack_profile_visits_notice_v2() to authenticated;
revoke all on function public.record_profile_visit_v2(uuid) from public, anon;
grant execute on function public.record_profile_visit_v2(uuid) to authenticated;
revoke all on function public.get_my_profile_visits_v2() from public, anon;
grant execute on function public.get_my_profile_visits_v2() to authenticated;
