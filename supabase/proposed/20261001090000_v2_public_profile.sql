-- V2 public profile (what another member sees) — 2026-10-01.
--
-- One SECURITY DEFINER read that selects the allowed fields EXPLICITLY. The raw
-- onboarding draft is never sent to anyone but its owner. Field list = the
-- approved "This is how others will see you" preview (DECISIONS.md D59 (3)):
-- first name + age; city, height, zodiac, work, school, hometown; intent,
-- values, interests; artists, books, movies/series; smoking, drinking, pets,
-- activity; date types, days/time, favorite spot; prompts; photos in order.
-- NEVER returned: surname, date of birth, gender / interested-in, district,
-- location id/label, coordinates, email, phone, selfie, the six compatibility
-- answers (not part of the approved public preview), review / account state.
--
-- Access (all must hold, otherwise NULL — same answer as "no such profile"):
--   * the caller is signed in;
--   * the caller is the owner, OR
--     - the caller is an active V2 member, and
--     - the target is an active V2 member, and
--     - public.can_view_profile(caller, target) — the P0 rule that also gates
--       photo signing: no block either way, not deleted, not hidden (unless an
--       accepted match exists), and
--     - the pair is mutually V2-eligible (same rule as
--       get_discovery_candidates_v2) OR a matches row already links them.
-- No score, ranking or percentage is produced here.

-- Zodiac from a date — same ranges as lib/zodiac.ts getZodiacFromDate.
create or replace function public.v2_zodiac(p_dob date)
returns text language sql immutable set search_path = public, pg_temp
as $$
  select case
    when p_dob is null then null
    when md >= 1222 or md <= 119 then 'Capricorn'
    when md <= 218 then 'Aquarius'
    when md <= 320 then 'Pisces'
    when md <= 419 then 'Aries'
    when md <= 520 then 'Taurus'
    when md <= 620 then 'Gemini'
    when md <= 722 then 'Cancer'
    when md <= 822 then 'Leo'
    when md <= 922 then 'Virgo'
    when md <= 1022 then 'Libra'
    when md <= 1121 then 'Scorpio'
    else 'Sagittarius' end
  from (select (extract(month from p_dob) * 100 + extract(day from p_dob))::int as md) x
$$;
revoke all on function public.v2_zodiac(date) from public, anon, authenticated;

-- Mutual V2 eligibility of a pair: the predicate of get_discovery_candidates_v2,
-- evaluated for two given users (checked equal by the tests).
create or replace function public.v2_pair_eligible(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from onboarding_v2 a join profiles ap on ap.id = a.user_id,
         onboarding_v2 b join profiles bp on bp.id = b.user_id
    where a.user_id = p_a and b.user_id = p_b and p_a <> p_b
      and public.is_active_v2_member(p_a) and public.is_active_v2_member(p_b)
      and coalesce(bp.is_hidden, false) = false and bp.deleted_at is null
      and coalesce(ap.is_hidden, false) = false and ap.deleted_at is null
      and not exists (select 1 from blocks k
                      where (k.blocker_id = p_a and k.blocked_id = p_b)
                         or (k.blocker_id = p_b and k.blocked_id = p_a))
      and public.v2_wants(a.interested_in, b.gender)
      and public.v2_wants(b.interested_in, a.gender)
      and date_part('year', age(b.date_of_birth)) between coalesce(ap.discovery_age_min, 18) and coalesce(ap.discovery_age_max, 120)
      and date_part('year', age(a.date_of_birth)) between coalesce(bp.discovery_age_min, 18) and coalesce(bp.discovery_age_max, 120)
      and lower(btrim(a.location_city)) = lower(btrim(b.location_city)))
$$;
revoke all on function public.v2_pair_eligible(uuid, uuid) from public, anon, authenticated;

create or replace function public.v2_can_view_public_profile(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select p_viewer is not null and p_target is not null and (
    p_viewer = p_target
    or (public.is_active_v2_member(p_viewer)
        and public.is_active_v2_member(p_target)
        and public.can_view_profile(p_viewer, p_target)
        and (public.v2_pair_eligible(p_viewer, p_target)
             or exists (select 1 from matches m
                        where least(m.user_a_id::text, m.user_b_id::text) = least(p_viewer::text, p_target::text)
                          and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(p_viewer::text, p_target::text)))))
$$;
revoke all on function public.v2_can_view_public_profile(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_profile_v2(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
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
    'prompts', coalesce((select jsonb_agg(jsonb_build_object('slot', p.slot, 'prompt_id', p.prompt_id, 'answer', p.answer)
                                          order by p.slot)
                         from profile_prompts_v2 p where p.user_id = o.user_id), '[]'::jsonb),
    'photo_paths', coalesce((select jsonb_agg(f.storage_path order by f.position)
                             from profile_photos_v2 f where f.user_id = o.user_id), '[]'::jsonb))
  from onboarding_v2 o
  where o.user_id = p_user
    and public.v2_can_view_public_profile(auth.uid(), p_user)
$$;
revoke all on function public.get_profile_v2(uuid) from public, anon;
grant execute on function public.get_profile_v2(uuid) to authenticated;
