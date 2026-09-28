-- P0-A privacy remediation — ADDITIVE, compatible with the current app.
-- PROPOSED, NOT APPLIED. Lives in supabase/proposed/ so no CLI command can
-- apply it by accident. To apply after approval: move to supabase/migrations/
-- and run `supabase db query --linked -f <file>` (never `db push`), then
-- `NOTIFY pgrst, 'reload schema';`.
-- Design + order + rollback: docs/tempa/P0_PRIVACY_REMEDIATION.md.
--
-- What this closes immediately (no client change needed):
--   1. INSERT bypass of the 2026-09-20 column lockdown: `authenticated` had
--      table-level INSERT on public.profiles, so a user whose profile row did
--      not exist yet could create it with photo_verified / is_premium /
--      waitlist_* / deleted_at / daily_* set to anything.
--   2. Trivial self-completion of V1 onboarding: setup_completed=true is now
--      only accepted when the core required fields are present.
--   3. verification_selfie_path can only point into the caller's own folder.
--   4. Anonymous (and cross-user) LISTING of the public `user-photos` bucket.
-- What it prepares (used by the client update, enforced later by P0-B):
--   5. public.profile_cards — the only way to read OTHER users' profiles:
--      public columns + computed age, no private/account columns.
--   6. get_discovery_cards / get_my_liker_cards — same as get_top_matches /
--      get_my_likers but with `age` instead of the full date of birth.

begin;

-- 1. INSERT: same column allowlist as UPDATE (20260920090000) -------------
-- Also drop table-level TRUNCATE/TRIGGER/REFERENCES that Supabase's default
-- grants gave anon + authenticated (TRUNCATE ignores RLS; not reachable via
-- PostgREST, but no client role needs it).
revoke truncate, trigger, references on public.profiles from anon, authenticated;
revoke insert on public.profiles from anon, authenticated;
grant insert (
  id,
  first_name, last_name, full_address, city, district, discovery_max_distance,
  lat, lng, gender, meeting_preferences, languages, date_of_birth, zodiac_sign,
  photos, phone_number, dial_code, country_code, instagram_handle,
  verification_selfie_path, current_step,
  morning_night, recharge_style, hobbies, drinking, smoking, education,
  education_detail, occupation, height_cm, pets,
  availability_days, availability_hours, meeting_environment, favorite_spots,
  preferred_locations, first_date_expectation, bio, setup_completed,
  favorite_music, favorite_movie, favorite_book, favorite_activity,
  core_value, impressed_by, dealbreaker,
  discovery_age_min, discovery_age_max, notify_new_match, notify_messages,
  notify_meeting_invite, is_hidden, hide_location, discovery_verified_only,
  discovery_nonsmokers_only, discovery_height_min, discovery_height_max,
  discovery_zodiac_signs, discovery_pets, discovery_education,
  discovery_active_today,
  expo_push_token, quick_icebreaker_answers, privacy_consent_at, last_active_at
) on public.profiles to authenticated;
-- Not insertable by clients: photo_verified, is_premium, waitlist_number,
-- waitlist_boost, daily_views_*, daily_invites_*, deleted_at, phone_verified,
-- setup1_completed, username, religion, discovery_religion, neighborhoods,
-- vibe, created_at, updated_at (defaults / server only).

-- 2 + 3. Guard server-meaningful transitions made by end users -------------
-- SECURITY INVOKER on purpose: current_user is the caller's role, so
-- service_role / postgres (reviewers, migrations, Edge Functions) are exempt.
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

  -- V1 onboarding gate: completion needs the core step-1 fields.
  if coalesce(new.setup_completed, false)
     and (tg_op = 'INSERT' or coalesce(old.setup_completed, false) = false) then
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

  -- The private selfie path must live in the caller's own folder.
  if new.verification_selfie_path is not null
     and (tg_op = 'INSERT' or new.verification_selfie_path is distinct from old.verification_selfie_path)
     and split_part(new.verification_selfie_path, '/', 1) <> coalesce(auth.uid()::text, '') then
    raise exception 'invalid_selfie_path' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_client_writes on public.profiles;
create trigger profiles_guard_client_writes
  before insert or update on public.profiles
  for each row execute function public.guard_profile_client_writes();

-- 4. user-photos: no anonymous or cross-user LISTING -----------------------
-- The bucket stays public for now, so a known object URL still loads (all
-- app photo URLs are public URLs — lib/resolveProfilePhotoUrl.ts); only the
-- list/select API is restricted. Private bucket + signed URLs = phase 2.
drop policy if exists "photos are public" on storage.objects;
drop policy if exists "Anyone can view photos" on storage.objects;
create policy "user-photos read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Exact duplicates of "Users can upload their own photos" /
-- "Users can delete their own photos" (same bucket, role and expression).
drop policy if exists "users can upload own photos" on storage.objects;
drop policy if exists "users can delete own photos" on storage.objects;

-- 5. Public profile cards (other users) -------------------------------------
-- A view owned by postgres (security definer semantics, security_barrier):
-- it can show computed age without exposing date_of_birth, and it never
-- exposes private/account columns. The row predicate replicates today's
-- profiles_select_authenticated exactly, plus "signed in".
create or replace view public.profile_cards
with (security_barrier = true) as
select
  p.id,
  p.first_name,
  case when p.date_of_birth is null then null
       else date_part('year', age(p.date_of_birth))::int end as age,
  p.zodiac_sign,
  p.city,
  p.district,
  p.gender,
  p.languages,
  p.morning_night,
  p.recharge_style,
  p.hobbies,
  p.vibe,
  p.drinking,
  p.smoking,
  p.pets,
  p.education,
  p.education_detail,
  p.occupation,
  p.height_cm,
  p.bio,
  p.availability_days,
  p.availability_hours,
  p.meeting_environment,
  p.favorite_spots,
  p.first_date_expectation,
  p.favorite_music,
  p.favorite_movie,
  p.favorite_book,
  p.favorite_activity,
  p.core_value,
  p.impressed_by,
  p.dealbreaker,
  p.photos,
  p.photo_verified,
  p.setup_completed,
  p.is_hidden,
  p.hide_location,
  -- Whether this person's interested-in includes the viewer's gender —
  -- without exposing their interested-in list itself.
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        'Everyone' = any(p.meeting_preferences)
        or ('Men' = any(p.meeting_preferences) and me.gender = 'Man')
        or ('Women' = any(p.meeting_preferences) and me.gender = 'Woman')
        or ('Non-binary' = any(p.meeting_preferences) and me.gender = 'Non-binary')
      )
  ) as interested_in_viewer
from public.profiles p
where auth.uid() is not null
  and (
    p.id = auth.uid()
    or (coalesce(p.is_hidden, false) = false and p.deleted_at is null)
    or exists (
      select 1 from public.matches m
      where (m.user_a_id = auth.uid() and m.user_b_id = p.id)
         or (m.user_b_id = auth.uid() and m.user_a_id = p.id)
    )
  );

revoke all on public.profile_cards from anon, authenticated;
grant select on public.profile_cards to authenticated;
comment on view public.profile_cards is
  'P0 privacy: the only read path for OTHER users'' profiles. Public columns '
  '+ computed age; never last_name, date_of_birth, phone, address, lat/lng, '
  'push token, selfie path, preferences or account/state columns.';

-- 6. Age-only wrappers for the two RPCs that return date_of_birth ----------
-- Bodies of get_top_matches / get_my_likers (and all scoring) are unchanged.
create or replace function public.get_discovery_cards(p_limit integer default 10)
returns table(
  user_id uuid, first_name text, age integer, city text, district text,
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
         t.city, t.district, t.zodiac_sign, t.photos, t.match_percentage,
         t.match_category, t.reasons, t.favorite_music, t.favorite_movie,
         t.favorite_book, t.hobbies, t.availability_days, t.drinking, t.smoking,
         t.education, t.education_detail, t.morning_night
  from public.get_top_matches(auth.uid(), p_limit) with ordinality as t(
    user_id, first_name, date_of_birth, city, district, zodiac_sign, photos,
    match_percentage, match_category, reasons, favorite_music, favorite_movie,
    favorite_book, hobbies, availability_days, drinking, smoking, education,
    education_detail, morning_night, ord)
  order by t.ord;
$$;

create or replace function public.get_my_liker_cards(p_limit integer default 50)
returns table(
  total_count bigint, liker_id uuid, first_name text, age integer,
  photo_path text, target_type text, target_key text, note text,
  created_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select t.total_count, t.liker_id, t.first_name,
         case when t.date_of_birth is null then null
              else date_part('year', age(t.date_of_birth))::int end,
         t.photo_path, t.target_type, t.target_key, t.note, t.created_at
  from public.get_my_likers(p_limit) with ordinality as t(
    total_count, liker_id, first_name, date_of_birth, photo_path, target_type,
    target_key, note, created_at, ord)
  order by t.ord;
$$;

revoke all on function public.get_discovery_cards(integer) from public, anon;
revoke all on function public.get_my_liker_cards(integer) from public, anon;
grant execute on function public.get_discovery_cards(integer) to authenticated;
grant execute on function public.get_my_liker_cards(integer) to authenticated;
revoke all on function public.guard_profile_client_writes() from public, anon, authenticated;

commit;
