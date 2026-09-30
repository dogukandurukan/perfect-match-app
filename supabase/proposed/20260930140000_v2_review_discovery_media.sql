-- V2: reviewer "request changes" loop, V2 discovery ELIGIBILITY (no scoring),
-- orphaned-media listing. PROPOSED, NOT APPLIED. Requires
-- 20260930120000_v2_onboarding_persistence.sql (and P0-A + P1).

begin;

-- ---------------------------------------------------------------------------
-- 1. Review loop: request changes → user edits → resubmit → accept
-- ---------------------------------------------------------------------------
alter table public.account_state_v2
  add column if not exists review_items text[] check (review_items is null or review_items <@ array[
    'basics.name','basics.birthday','basics.gender','basics.interested_in','basics.location','basics.height',
    'compatibility.answers','compatibility.values','yourLife.answers','yourLife.pet_kind','yourWorld.interests',
    'yourDates.date_types','yourDates.when','yourProfile.photos','yourProfile.prompts','yourProfile.selfie']);

-- Audit trail of every state change (service/reviewer only; never clients).
create table if not exists public.application_events_v2 (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null check (event in ('submitted','changes_requested','accepted','rejected')),
  note text,
  items text[],
  created_at timestamptz not null default now()
);
alter table public.application_events_v2 enable row level security;
revoke all on public.application_events_v2 from anon, authenticated;

-- Reviewer decision. request_changes needs a note or items; asking for a new
-- selfie drops the stored one (the old object becomes an orphan and is
-- removed by the media clean-up). Accept projects the minimum public card
-- data into profiles so photos can be shown/signed to other active members.
create or replace function public.review_application_v2(
  p_user uuid, p_decision text, p_note text default null, p_items text[] default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare s account_state_v2; o onboarding_v2;
begin
  if p_decision not in ('accept', 'reject', 'request_changes') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  select * into s from account_state_v2 where user_id = p_user for update;
  if s.user_id is null or s.application_status <> 'submitted' then
    raise exception 'not_submitted' using errcode = '22023';
  end if;
  if p_decision = 'request_changes' and coalesce(btrim(p_note), '') = '' and coalesce(cardinality(p_items), 0) = 0 then
    raise exception 'changes_need_note_or_items' using errcode = '22023';
  end if;
  update account_state_v2 set
    application_status = case p_decision when 'accept' then 'accepted' when 'reject' then 'rejected' else 'changes_requested' end,
    verification_status = case p_decision when 'accept' then 'verified' when 'reject' then 'rejected' else 'none' end,
    membership_status = case p_decision when 'accept' then 'active' else 'none' end,
    review_note = p_note,
    review_items = case when p_decision = 'request_changes' then p_items end,
    selfie_path = case when p_decision = 'request_changes' and 'yourProfile.selfie' = any(coalesce(p_items, '{}'))
                       then null else selfie_path end,
    reviewed_at = now(), updated_at = now()
  where user_id = p_user returning * into s;
  insert into application_events_v2 (user_id, event, note, items)
  values (p_user, case p_decision when 'accept' then 'accepted' when 'reject' then 'rejected' else 'changes_requested' end,
          p_note, p_items);
  if p_decision = 'accept' then
    select * into o from onboarding_v2 where user_id = p_user;
    update profiles set
      first_name = o.first_name,
      date_of_birth = o.date_of_birth,       -- private column (own row only after P0-B)
      city = o.location_city,
      photos = (select array_agg(f.storage_path order by f.position) from profile_photos_v2 f where f.user_id = p_user),
      setup_completed = true                  -- server-set; clients can't (guard)
    where id = p_user;
  end if;
  return to_jsonb(s) - 'selfie_path';
end;
$$;
revoke all on function public.review_application_v2(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.review_application_v2(uuid, text, text, text[]) to service_role;
drop function if exists public.review_application_v2(uuid, text, text);

-- Submission: also clears the previous review request and logs the event.
create or replace function public.submit_application_v2(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); s account_state_v2; v_missing text[];
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_ensure_me();
  select * into s from account_state_v2 where user_id = v_uid for update;
  if s.application_status in ('submitted', 'accepted', 'rejected') then
    return jsonb_build_object('status', s.application_status, 'submitted_at', s.submitted_at, 'already', true);
  end if;
  v_missing := public.v2_missing_for(v_uid);
  if coalesce(cardinality(v_missing), 0) > 0 then
    return jsonb_build_object('status', s.application_status, 'missing', to_jsonb(v_missing));
  end if;
  update account_state_v2 set application_status = 'submitted', verification_status = 'pending',
    submitted_at = now(), submit_request_id = p_request_id, review_items = null, updated_at = now()
  where user_id = v_uid returning * into s;
  insert into application_events_v2 (user_id, event) values (v_uid, 'submitted');
  return jsonb_build_object('status', s.application_status, 'submitted_at', s.submitted_at, 'already', false);
end;
$$;

-- The owner's bundle now also carries the reviewer's note and items.
create or replace function public.get_my_onboarding_v2()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_ensure_me();
  return jsonb_build_object(
    'draft', (select to_jsonb(o) - 'user_id' from onboarding_v2 o where o.user_id = v_uid),
    'prompts', coalesce((select jsonb_agg(jsonb_build_object('slot', p.slot, 'prompt_id', p.prompt_id, 'answer', p.answer)
                                          order by p.slot) from profile_prompts_v2 p where p.user_id = v_uid), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path, 'position', f.position)
                                         order by f.position) from profile_photos_v2 f where f.user_id = v_uid), '[]'::jsonb),
    'state', (select jsonb_build_object('application_status', s.application_status,
                                        'verification_status', s.verification_status,
                                        'membership_status', s.membership_status,
                                        'has_selfie', s.selfie_path is not null,
                                        'submitted_at', s.submitted_at,
                                        'review_note', case when s.application_status = 'changes_requested' then s.review_note end,
                                        'review_items', case when s.application_status = 'changes_requested' then s.review_items end)
              from account_state_v2 s where s.user_id = v_uid),
    'email', (select jsonb_build_object('address', u.email, 'confirmed', u.email_confirmed_at is not null)
              from auth.users u where u.id = v_uid));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. V2 discovery ELIGIBILITY — separate from any scoring
-- ---------------------------------------------------------------------------
-- Strictly a V2 member (V1 accounts have no row and are NOT V2 members).
create or replace function public.is_active_v2_member(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from account_state_v2 s where s.user_id = p_user
                 and s.application_status = 'accepted' and s.verification_status = 'verified'
                 and s.membership_status = 'active')
$$;
revoke all on function public.is_active_v2_member(uuid) from public, anon, authenticated;

-- Does an interested-in list (V2 keys) include this gender (V2 keys)?
create or replace function public.v2_wants(p_interested text[], p_gender text)
returns boolean language sql immutable set search_path = public, pg_temp
as $$
  select 'everyone' = any(coalesce(p_interested, '{}'))
      or (p_gender = 'woman' and 'women' = any(coalesce(p_interested, '{}')))
      or (p_gender = 'man' and 'men' = any(coalesce(p_interested, '{}')))
      or (p_gender = 'non_binary' and 'non_binary_people' = any(coalesce(p_interested, '{}')))
$$;
revoke all on function public.v2_wants(text[], text) from public, anon;

-- Eligible V2 members for the caller. Rules (all mutual where it applies):
-- both accepted + verified + active; neither hidden nor deleted; no block
-- either way; each one's gender is in the other's interested-in; each one's
-- age is inside the other's discovery age range (profiles.discovery_age_min/
-- max, defaults 18–60); same city. NO score and NO ranking: a fixed order by
-- user id, so eligibility can be verified without inventing weights.
create or replace function public.get_discovery_candidates_v2(p_limit integer default 20)
returns table(user_id uuid, first_name text, age integer, city text, photo_paths text[])
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (
    select o.user_id, o.gender, o.interested_in, o.date_of_birth, o.location_city,
           coalesce(p.discovery_age_min, 18) as amin, coalesce(p.discovery_age_max, 120) as amax
    from onboarding_v2 o join profiles p on p.id = o.user_id
    where o.user_id = auth.uid() and public.is_active_v2_member(auth.uid())
  )
  select c.user_id, c.first_name,
         date_part('year', age(c.date_of_birth))::int,
         c.location_city,
         (select array_agg(f.storage_path order by f.position) from profile_photos_v2 f where f.user_id = c.user_id)
  from onboarding_v2 c
  join profiles cp on cp.id = c.user_id
  cross join me
  where c.user_id <> me.user_id
    and public.is_active_v2_member(c.user_id)
    and coalesce(cp.is_hidden, false) = false
    and cp.deleted_at is null
    and not exists (select 1 from blocks b
                    where (b.blocker_id = me.user_id and b.blocked_id = c.user_id)
                       or (b.blocker_id = c.user_id and b.blocked_id = me.user_id))
    and public.v2_wants(me.interested_in, c.gender)
    and public.v2_wants(c.interested_in, me.gender)
    and date_part('year', age(c.date_of_birth)) between me.amin and me.amax
    and date_part('year', age(me.date_of_birth)) between coalesce(cp.discovery_age_min, 18) and coalesce(cp.discovery_age_max, 120)
    and lower(btrim(c.location_city)) = lower(btrim(me.location_city))
  order by c.user_id
  limit greatest(least(coalesce(p_limit, 20), 100), 0)
$$;
revoke all on function public.get_discovery_candidates_v2(integer) from public, anon;
grant execute on function public.get_discovery_candidates_v2(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Orphaned media (service role only). Deleting storage.objects rows in SQL
-- does not delete the stored file, so this only LISTS; the clean-up script /
-- scheduled function removes them through the Storage API. The grace period
-- protects uploads that are in flight between upload and registration.
-- ---------------------------------------------------------------------------
create or replace function public.list_orphan_media_v2(p_min_age interval default interval '24 hours')
returns table(bucket_id text, name text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.bucket_id, o.name, o.created_at
  from storage.objects o
  where o.created_at < now() - greatest(p_min_age, interval '1 hour')
    and (
      (o.bucket_id = 'profile-photos-private'
        and not exists (select 1 from profile_photos_v2 f where f.storage_path = o.name)
        and not exists (select 1 from profiles p where o.name = any(coalesce(p.photos, '{}'))))
      or
      (o.bucket_id = 'verification-selfies'
        and not exists (select 1 from account_state_v2 s where s.selfie_path = o.name)
        and not exists (select 1 from profiles p where p.verification_selfie_path = o.name))
    )
  order by o.created_at
$$;
revoke all on function public.list_orphan_media_v2(interval) from public, anon, authenticated;
grant execute on function public.list_orphan_media_v2(interval) to service_role;

commit;
