-- V2 onboarding persistence, application and access gate (WP1 + WP2 core).
-- PROPOSED, NOT APPLIED. Requires P0-A + P1 (private photo bucket).
-- Written fresh against the CURRENT V2 code keys (lib/onboardingV2/*); the
-- archived Revision 2 draft (tempa/v2-drafts-archive) is NOT applied or reused.
--
-- Principles
-- - Clients never write these tables directly (no INSERT/UPDATE/DELETE grant);
--   every write goes through a SECURITY DEFINER RPC that validates keys and
--   limits against the V2 code, keyed on auth.uid().
-- - All V2 answers are private to the owner (SELECT own row only). Nothing
--   here is visible to other users; public projection is WP3.
-- - Application / verification / membership state is server-owned: only the
--   submit RPC (draft → submitted) and service-role reviewer RPCs change it.
-- - A pending (not accepted/verified/active) V2 user is neither shown to
--   others nor allowed to use discovery.
-- - Existing (V1) accounts have no account_state_v2 row and keep working.

begin;

-- ---------------------------------------------------------------------------
-- 0. Small validation helpers
-- ---------------------------------------------------------------------------
create or replace function public.v2_is_one_of(p_value text, p_allowed text[])
returns boolean language sql immutable set search_path = public, pg_temp
as $$ select p_value is null or p_value = any(p_allowed) $$;

create or replace function public.v2_is_subset(p_values text[], p_allowed text[], p_max int)
returns boolean language sql immutable set search_path = public, pg_temp
as $$
  select p_values is null or (
    coalesce(array_length(p_values, 1), 0) <= p_max
    and p_values <@ p_allowed
    and coalesce(array_length(p_values, 1), 0) = (select count(distinct v) from unnest(p_values) v))
$$;

-- A taste/school/hometown item as produced by lib/onboardingV2/yourWorld.ts.
create or replace function public.v2_is_taste_item(p_item jsonb, p_kind text)
returns boolean language sql immutable set search_path = public, pg_temp
as $$
  select p_item is null or (
    jsonb_typeof(p_item) = 'object'
    and p_item ->> 'kind' = p_kind
    and p_item ->> 'source' in ('musicbrainz', 'openlibrary', 'wikidata', 'sample', 'custom')
    and char_length(coalesce(p_item ->> 'id', '')) between 1 and 200
    and char_length(btrim(coalesce(p_item ->> 'title', ''))) between 1 and 200
    and char_length(coalesce(p_item ->> 'subtitle', '')) <= 200
    and (p_item ->> 'imageUrl' is null
         or (p_item ->> 'imageUrl' ~ '^https://' and char_length(p_item ->> 'imageUrl') <= 500))
    and (select count(*) from jsonb_object_keys(p_item) k
         where k not in ('kind', 'source', 'id', 'title', 'subtitle', 'imageUrl')) = 0)
$$;

create or replace function public.v2_is_taste_list(p_list jsonb, p_kind text)
returns boolean language sql immutable set search_path = public, pg_temp
as $$
  select p_list is null or (
    jsonb_typeof(p_list) = 'array'
    and jsonb_array_length(p_list) <= 3
    and (select bool_and(public.v2_is_taste_item(e, p_kind)) from jsonb_array_elements(p_list) e) is not false
    and (select count(distinct e ->> 'id') from jsonb_array_elements(p_list) e) = jsonb_array_length(p_list))
$$;

-- ---------------------------------------------------------------------------
-- 1. Tables (owner-read only; no client DML)
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  questionnaire_version smallint not null default 1,
  -- resume position (section id + 1-based step, as in lib/onboardingV2/previewFlow.ts)
  resume_section text check (resume_section in ('basics','compatibility','yourLife','yourWorld','yourDates','yourProfile')),
  resume_step smallint check (resume_step between 1 and 20),
  -- Section 2 Basics
  first_name text check (char_length(btrim(first_name)) between 1 and 50),
  last_name text check (char_length(btrim(last_name)) between 1 and 50),
  date_of_birth date,
  gender text check (public.v2_is_one_of(gender, array['woman','man','non_binary'])),
  interested_in text[] check (interested_in is null or interested_in = array['everyone']
    or public.v2_is_subset(interested_in, array['women','men','non_binary_people'], 3)),
  location_id text check (char_length(location_id) <= 100),
  location_city text check (char_length(location_city) <= 80),
  location_district text check (char_length(location_district) <= 80),
  location_label text check (char_length(location_label) <= 200),
  height_cm smallint check (height_cm between 90 and 250),
  -- Section 3 Compatibility
  intent text check (public.v2_is_one_of(intent, array['long_term','casual','figuring_out'])),
  social_energy text check (public.v2_is_one_of(social_energy, array['low_key','mix','social'])),
  message_frequency text check (public.v2_is_one_of(message_frequency, array['little_each_day','few_checkins','often'])),
  relationship_space text check (public.v2_is_one_of(relationship_space, array['plenty_of_space','balance','lots_together'])),
  emotional_expression text check (public.v2_is_one_of(emotional_expression, array['reserved','warm_when_comfortable','open'])),
  meeting_pace text check (public.v2_is_one_of(meeting_pace, array['quickly','after_chatting','take_my_time'])),
  core_values text[] check (public.v2_is_subset(core_values,
    array['trust','growth','fun','stability','independence','adventure','affection','family','health','respect'], 2)),
  -- Section 4 Your Life
  smoking text check (public.v2_is_one_of(smoking, array['no','sometimes','yes'])),
  drinking text check (public.v2_is_one_of(drinking, array['none','sometimes','regularly'])),
  pets text check (public.v2_is_one_of(pets, array['have_pets','like_no_pets','neutral','rather_not'])),
  pet_kind text check (public.v2_is_one_of(pet_kind, array['dog','cat','both','other'])),
  activity text check (public.v2_is_one_of(activity, array['very','somewhat','not_very'])),
  -- Section 5 Your World
  work_status text check (public.v2_is_one_of(work_status, array['full_time','part_time','self_employed','student','between_jobs'])),
  job_title text check (char_length(job_title) <= 80),
  school jsonb check (public.v2_is_taste_item(school, 'school')),
  hometown jsonb check (public.v2_is_taste_item(hometown, 'hometown')),
  interests text[] check (public.v2_is_subset(interests, array['travel','food','sports','music','art','movies','books',
    'outdoors','tech','gaming','fashion','wellness','animals','nightlife','culture','other'], 10)),
  artists jsonb check (public.v2_is_taste_list(artists, 'artist')),
  books jsonb check (public.v2_is_taste_list(books, 'book')),
  screen jsonb check (public.v2_is_taste_list(screen, 'screen')),
  -- Section 6 Your Dates
  date_types text[] check (public.v2_is_subset(date_types, array['coffee','drinks','dinner','activity','walk','outdoors'], 2)),
  favorite_spot text check (char_length(favorite_spot) <= 120),
  days_pref text check (public.v2_is_one_of(days_pref, array['weekdays','weekends','either'])),
  time_pref text check (public.v2_is_one_of(time_pref, array['daytime','evening','either'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_v2_pet_kind_only_with_pets check (pet_kind is null or pets = 'have_pets')
);

-- Prompt catalog = the 20 ids of lib/onboardingV2/promptCatalog.ts (D60).
create table if not exists public.prompt_catalog_v2 (
  id text primary key,
  category text not null check (category in ('about_me','just_for_fun','you_and_me','my_everyday')),
  active boolean not null default true
);
insert into public.prompt_catalog_v2 (id, category) values
  ('small_thing_i_love','about_me'), ('friends_know_me_for','about_me'), ('want_to_try','about_me'),
  ('one_thing_to_know','about_me'), ('ask_me_about','about_me'),
  ('funny_little_habit','just_for_fun'), ('oddly_good_at','just_for_fun'), ('dont_judge_me','just_for_fun'),
  ('take_too_seriously','just_for_fun'), ('most_used_phrase','just_for_fun'),
  ('together_we_could','you_and_me'), ('first_date_needs','you_and_me'), ('you_pick_the_place','you_and_me'),
  ('well_laugh_about','you_and_me'), ('teach_me_how_to','you_and_me'),
  ('sunday_starts_with','my_everyday'), ('always_make_time_for','my_everyday'), ('comfort_food','my_everyday'),
  ('after_a_long_day','my_everyday'), ('always_say_yes_to','my_everyday')
on conflict (id) do nothing;

create table if not exists public.profile_prompts_v2 (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  prompt_id text not null references public.prompt_catalog_v2(id),
  answer text not null check (char_length(btrim(answer)) between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  unique (user_id, prompt_id)
);

create table if not exists public.profile_photos_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (user_id, position) deferrable initially deferred,
  constraint profile_photos_v2_own_folder check (split_part(storage_path, '/', 1) = user_id::text)
);

create table if not exists public.account_state_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  application_status text not null default 'draft'
    check (application_status in ('draft','submitted','accepted','rejected','changes_requested')),
  verification_status text not null default 'none'
    check (verification_status in ('none','pending','verified','rejected')),
  membership_status text not null default 'none' check (membership_status in ('none','active','suspended')),
  selfie_path text check (selfie_path is null or split_part(selfie_path, '/', 1) = user_id::text),
  submitted_at timestamptz,
  submit_request_id uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_v2 enable row level security;
alter table public.profile_prompts_v2 enable row level security;
alter table public.profile_photos_v2 enable row level security;
alter table public.account_state_v2 enable row level security;
alter table public.prompt_catalog_v2 enable row level security;

revoke all on public.onboarding_v2, public.profile_prompts_v2, public.profile_photos_v2,
  public.account_state_v2, public.prompt_catalog_v2 from anon, authenticated;
grant select on public.onboarding_v2, public.profile_prompts_v2, public.profile_photos_v2,
  public.account_state_v2, public.prompt_catalog_v2 to authenticated;

drop policy if exists onboarding_v2_own on public.onboarding_v2;
create policy onboarding_v2_own on public.onboarding_v2 for select to authenticated using (user_id = auth.uid());
drop policy if exists profile_prompts_v2_own on public.profile_prompts_v2;
create policy profile_prompts_v2_own on public.profile_prompts_v2 for select to authenticated using (user_id = auth.uid());
drop policy if exists profile_photos_v2_own on public.profile_photos_v2;
create policy profile_photos_v2_own on public.profile_photos_v2 for select to authenticated using (user_id = auth.uid());
drop policy if exists account_state_v2_own on public.account_state_v2;
create policy account_state_v2_own on public.account_state_v2 for select to authenticated using (user_id = auth.uid());
drop policy if exists prompt_catalog_v2_read on public.prompt_catalog_v2;
create policy prompt_catalog_v2_read on public.prompt_catalog_v2 for select to authenticated using (active);

-- ---------------------------------------------------------------------------
-- 2. Membership check used by discovery / visibility
-- ---------------------------------------------------------------------------
-- A user with a V2 account-state row is a member only when accepted +
-- verified + active. Users without a row are V1 accounts (unchanged).
create or replace function public.is_active_member(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select not exists (select 1 from account_state_v2 s where s.user_id = p_user)
      or exists (select 1 from account_state_v2 s where s.user_id = p_user
                 and s.application_status = 'accepted'
                 and s.verification_status = 'verified'
                 and s.membership_status = 'active')
$$;
revoke all on function public.is_active_member(uuid) from public, anon, authenticated;

-- Visibility (P0 rule) + membership: a pending V2 user is never visible to
-- strangers. Same body as P0-A plus one membership condition.
create or replace function public.can_view_profile(p_viewer uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_viewer is not null and p_target is not null and (
    p_viewer = p_target
    or (
      not exists (
        select 1 from blocks b
        where (b.blocker_id = p_viewer and b.blocked_id = p_target)
           or (b.blocker_id = p_target and b.blocked_id = p_viewer))
      and public.is_active_member(p_target)
      and exists (
        select 1 from profiles t
        where t.id = p_target
          and t.deleted_at is null
          and (
            (coalesce(t.setup_completed, false) and coalesce(t.is_hidden, false) = false)
            or exists (
              select 1 from matches m
              where least(m.user_a_id::text, m.user_b_id::text) = least(p_viewer::text, p_target::text)
                and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(p_viewer::text, p_target::text)
                and m.status = 'accepted')
          )))
  );
$$;

-- Discovery: a pending V2 user gets nothing (and is excluded as a candidate
-- because setup_completed stays false until activation — see guard below).
create or replace function public.get_discovery_cards(p_limit integer default 10)
returns table(
  user_id uuid, first_name text, age integer, city text,
  zodiac_sign text, photos text[], match_percentage integer, match_category text,
  reasons text[], favorite_music text, favorite_movie text, favorite_book text,
  hobbies text[], availability_days text[], drinking text, smoking text,
  education text, education_detail text, morning_night text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.user_id, t.first_name,
         case when t.date_of_birth is null then null
              else date_part('year', age(t.date_of_birth))::int end,
         t.city, t.zodiac_sign, t.photos, t.match_percentage,
         t.match_category, array_remove(t.reasons, 'Nearby'), t.favorite_music, t.favorite_movie,
         t.favorite_book, t.hobbies, t.availability_days, t.drinking, t.smoking,
         t.education, t.education_detail, t.morning_night
  from public.get_top_matches(auth.uid(), p_limit) with ordinality as t(
    user_id, first_name, date_of_birth, city, district, zodiac_sign, photos,
    match_percentage, match_category, reasons, favorite_music, favorite_movie,
    favorite_book, hobbies, availability_days, drinking, smoking, education,
    education_detail, morning_night, ord)
  where public.is_active_member(auth.uid())
    and public.is_active_member(t.user_id)
  order by t.ord;
$$;

-- setup_completed (the V1 Home gate) can never be self-set by a V2 user that
-- is not an active member. Wraps the P0-A guard (same body + this rule).
create or replace function public.guard_profile_client_writes()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if coalesce(new.setup_completed, false)
     and (tg_op = 'INSERT' or coalesce(old.setup_completed, false) = false) then
    if not public.is_active_member_as_me() then
      raise exception 'membership_not_active' using errcode = '42501';
    end if;
    if coalesce(btrim(new.first_name), '') = ''
       or new.date_of_birth is null
       or new.date_of_birth > (current_date - interval '18 years')
       or new.gender is null
       or coalesce(btrim(new.city), '') = ''
       or coalesce(array_length(new.meeting_preferences, 1), 0) = 0 then
      raise exception 'setup_incomplete' using errcode = '23514',
        hint = 'first name, 18+ date of birth, gender, city and interested-in are required';
    end if;
  end if;

  if new.discovery_max_distance in ('same_district', 'same_neighborhood') then
    new.discovery_max_distance := 'whole_city';
  end if;

  if new.verification_selfie_path is not null
     and (tg_op = 'INSERT' or new.verification_selfie_path is distinct from old.verification_selfie_path)
     and split_part(new.verification_selfie_path, '/', 1) <> coalesce(auth.uid()::text, '') then
    raise exception 'invalid_selfie_path' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.is_active_member_as_me()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.is_active_member(auth.uid()) $$;
revoke all on function public.is_active_member_as_me() from public, anon;
grant execute on function public.is_active_member_as_me() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Client RPCs (all keyed on auth.uid())
-- ---------------------------------------------------------------------------
-- Creates the caller's profiles row (id only) + draft + account state once.
create or replace function public.v2_ensure_me()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  -- Existing V1 members are never pulled into V2 (that would turn them into
  -- pending applicants and hide them). They keep their current access.
  if not exists (select 1 from account_state_v2 where user_id = v_uid)
     and exists (select 1 from profiles where id = v_uid and coalesce(setup_completed, false)) then
    raise exception 'legacy_account' using errcode = '42501';
  end if;
  insert into profiles (id) values (v_uid) on conflict (id) do nothing;
  insert into onboarding_v2 (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into account_state_v2 (user_id) values (v_uid) on conflict (user_id) do nothing;
end;
$$;

create or replace function public.v2_assert_editable()
returns void language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from account_state_v2 where user_id = auth.uid()
                 and application_status in ('draft', 'changes_requested')) then
    raise exception 'application_locked' using errcode = '42501',
      hint = 'answers can only be changed before submitting (or when changes are requested)';
  end if;
end;
$$;

-- Everything the owner needs to resume (their own data only).
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
                                        'submitted_at', s.submitted_at)
              from account_state_v2 s where s.user_id = v_uid),
    'email', (select jsonb_build_object('address', u.email, 'confirmed', u.email_confirmed_at is not null)
              from auth.users u where u.id = v_uid));
end;
$$;

-- Saves one section (partial values allowed while drafting; every value
-- present is validated by the table CHECKs). Unknown keys are rejected.
create or replace function public.save_onboarding_v2(p_section text, p_data jsonb, p_resume_step smallint default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed text[];
  v_bad text;
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
    when 'yourWorld' then array['work_status','job_title','school','hometown','interests','artists','books','screen']
    when 'yourDates' then array['date_types','favorite_spot','days_pref','time_pref']
    when 'yourProfile' then array[]::text[]
    else null end;
  if v_allowed is null then raise exception 'invalid_section' using errcode = '22023'; end if;
  select k into v_bad from jsonb_object_keys(p_data) k where k <> all(v_allowed) limit 1;
  if v_bad is not null then raise exception 'unknown_field: %', v_bad using errcode = '22023'; end if;

  if p_data ? 'date_of_birth' and p_data ->> 'date_of_birth' is not null then
    if (p_data ->> 'date_of_birth')::date > current_date - interval '18 years'
       or (p_data ->> 'date_of_birth')::date < current_date - interval '120 years' then
      raise exception 'invalid_date_of_birth' using errcode = '23514';
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
    date_types = case when p_data ? 'date_types' then
      (select array_agg(x) from jsonb_array_elements_text(nullif(p_data -> 'date_types', 'null'::jsonb)) x) else o.date_types end,
    favorite_spot = case when p_data ? 'favorite_spot' then nullif(btrim(p_data ->> 'favorite_spot'), '') else o.favorite_spot end,
    days_pref = case when p_data ? 'days_pref' then p_data ->> 'days_pref' else o.days_pref end,
    time_pref = case when p_data ? 'time_pref' then p_data ->> 'time_pref' else o.time_pref end,
    resume_section = case when p_resume_step is not null then p_section else o.resume_section end,
    resume_step = coalesce(p_resume_step, o.resume_step),
    updated_at = now()
  where o.user_id = v_uid;
  return jsonb_build_object('saved', true, 'section', p_section);
end;
$$;

-- Prompts: the full set (1–3 slots) replaces the previous one atomically.
create or replace function public.save_prompts_v2(p_prompts jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_ensure_me();
  perform public.v2_assert_editable();
  if jsonb_typeof(p_prompts) is distinct from 'array' or jsonb_array_length(p_prompts) > 3 then
    raise exception 'invalid_prompts' using errcode = '22023';
  end if;
  delete from profile_prompts_v2 where user_id = v_uid;
  insert into profile_prompts_v2 (user_id, slot, prompt_id, answer)
  select v_uid, (e ->> 'slot')::smallint, e ->> 'prompt_id', btrim(e ->> 'answer')
  from jsonb_array_elements(p_prompts) e
  where coalesce(btrim(e ->> 'answer'), '') <> '' and e ->> 'prompt_id' is not null;
  return jsonb_build_object('saved', (select count(*) from profile_prompts_v2 where user_id = v_uid));
end;
$$;

-- Photos: the client uploads to profile-photos-private/{uid}/… first; this
-- registers an uploaded object. Rejects objects that don't exist, aren't
-- the caller's, or would exceed 6.
create or replace function public.add_profile_photo_v2(p_path text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_pos smallint; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_ensure_me();
  perform public.v2_assert_editable();
  if split_part(coalesce(p_path, ''), '/', 1) <> v_uid::text then
    raise exception 'not_your_photo' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'profile-photos-private' and o.name = p_path) then
    raise exception 'photo_not_uploaded' using errcode = '22023';
  end if;
  perform 1 from account_state_v2 where user_id = v_uid for update; -- serialise per user
  select id into v_id from profile_photos_v2 where storage_path = p_path;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;
  select coalesce(max(position), 0) + 1 into v_pos from profile_photos_v2 where user_id = v_uid;
  if v_pos > 6 then raise exception 'too_many_photos' using errcode = '23514'; end if;
  insert into profile_photos_v2 (user_id, storage_path, position) values (v_uid, p_path, v_pos) returning id into v_id;
  return jsonb_build_object('id', v_id, 'position', v_pos);
end;
$$;

-- Reorder: the full ordered list of the caller's photo ids.
create or replace function public.reorder_profile_photos_v2(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_have uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_assert_editable();
  perform 1 from account_state_v2 where user_id = v_uid for update;
  select array_agg(id order by id) into v_have from profile_photos_v2 where user_id = v_uid;
  if v_have is distinct from (select array_agg(x order by x) from unnest(p_ids) x)
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'photo_set_mismatch' using errcode = '22023';
  end if;
  update profile_photos_v2 f set position = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where f.id = x.id and f.user_id = v_uid;
  return jsonb_build_object('reordered', cardinality(p_ids));
end;
$$;

-- Delete: removes the row and compacts positions. Returns the storage path
-- so the client can delete the object (own-folder storage policy).
create or replace function public.delete_profile_photo_v2(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_path text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_assert_editable();
  perform 1 from account_state_v2 where user_id = v_uid for update;
  delete from profile_photos_v2 where id = p_id and user_id = v_uid returning storage_path into v_path;
  if v_path is null then raise exception 'photo_not_found' using errcode = '22023'; end if;
  update profile_photos_v2 f set position = r.rn
  from (select id, row_number() over (order by position) rn from profile_photos_v2 where user_id = v_uid) r
  where f.id = r.id;
  return jsonb_build_object('deleted', true, 'path', v_path);
end;
$$;

-- Private selfie: uploaded to verification-selfies/{uid}/… (clients can
-- upload but never read it); only the path is stored server-side.
create or replace function public.set_verification_selfie_v2(p_path text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.v2_ensure_me();
  perform public.v2_assert_editable();
  if split_part(coalesce(p_path, ''), '/', 1) <> v_uid::text then
    raise exception 'not_your_selfie' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'verification-selfies' and o.name = p_path) then
    raise exception 'selfie_not_uploaded' using errcode = '22023';
  end if;
  update account_state_v2 set selfie_path = p_path, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('saved', true);
end;
$$;

-- What is still missing for submission (same rules as the V2 client).
create or replace function public.v2_missing_for(p_uid uuid)
returns text[] language sql stable security definer set search_path = public, pg_temp
as $$
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
    case when (select count(*) from profile_prompts_v2 p where p.user_id = p_uid) < 2 then 'yourProfile.prompts' end,
    case when s.selfie_path is null then 'yourProfile.selfie' end,
    case when u.email_confirmed_at is null then 'account.email' end
  ], null)
  from onboarding_v2 o
  join account_state_v2 s on s.user_id = o.user_id
  left join auth.users u on u.id = o.user_id
  where o.user_id = p_uid
$$;
revoke all on function public.v2_missing_for(uuid) from public, anon, authenticated;

-- Submit: idempotent and race-safe. Repeated taps / retries after a dropped
-- connection return the SAME submission (no duplicate); nothing is created
-- when something is missing.
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
    submitted_at = now(), submit_request_id = p_request_id, updated_at = now()
  where user_id = v_uid returning * into s;
  return jsonb_build_object('status', s.application_status, 'submitted_at', s.submitted_at, 'already', false);
end;
$$;

-- Where the app should send the signed-in user.
create or replace function public.get_my_access_v2()
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then jsonb_build_object('gate', 'signed_out')
    when s.user_id is null and coalesce(p.setup_completed, false) then jsonb_build_object('gate', 'legacy_member')
    when s.user_id is null then jsonb_build_object('gate', 'onboarding')
    when s.application_status in ('draft', 'changes_requested') then jsonb_build_object('gate', 'onboarding',
      'application_status', s.application_status)
    when s.application_status = 'accepted' and s.verification_status = 'verified' and s.membership_status = 'active'
      then jsonb_build_object('gate', 'member')
    else jsonb_build_object('gate', 'waiting', 'application_status', s.application_status,
      'verification_status', s.verification_status)
  end
  from (select auth.uid() as id) me
  left join account_state_v2 s on s.user_id = me.id
  left join profiles p on p.id = me.id
$$;

-- ---------------------------------------------------------------------------
-- 4. Reviewer RPCs — service role only (Studio / Edge Function), never clients
-- ---------------------------------------------------------------------------
create or replace function public.review_application_v2(p_user uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare s account_state_v2;
begin
  if p_decision not in ('accept', 'reject', 'request_changes') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  select * into s from account_state_v2 where user_id = p_user for update;
  if s.user_id is null or s.application_status <> 'submitted' then
    raise exception 'not_submitted' using errcode = '22023';
  end if;
  update account_state_v2 set
    application_status = case p_decision when 'accept' then 'accepted' when 'reject' then 'rejected' else 'changes_requested' end,
    verification_status = case p_decision when 'accept' then 'verified' when 'reject' then 'rejected' else 'none' end,
    membership_status = case p_decision when 'accept' then 'active' else 'none' end,
    reviewed_at = now(), review_note = p_note, updated_at = now()
  where user_id = p_user returning * into s;
  return to_jsonb(s) - 'selfie_path';
end;
$$;

revoke all on function public.v2_is_one_of(text, text[]) from public, anon;
revoke all on function public.v2_is_subset(text[], text[], int) from public, anon;
revoke all on function public.v2_is_taste_item(jsonb, text) from public, anon;
revoke all on function public.v2_is_taste_list(jsonb, text) from public, anon;
revoke all on function public.v2_ensure_me() from public, anon, authenticated;
revoke all on function public.v2_assert_editable() from public, anon, authenticated;
revoke all on function public.review_application_v2(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_application_v2(uuid, text, text) to service_role;
do $$
declare f text;
begin
  foreach f in array array[
    'get_my_onboarding_v2()', 'save_onboarding_v2(text, jsonb, smallint)', 'save_prompts_v2(jsonb)',
    'add_profile_photo_v2(text)', 'reorder_profile_photos_v2(uuid[])', 'delete_profile_photo_v2(uuid)',
    'set_verification_selfie_v2(text)', 'submit_application_v2(uuid)', 'get_my_access_v2()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

commit;
