-- V2 Discover: do not show again people the caller has already liked
-- (2026-10-01, phone test). Same function as 20261001120000 plus one
-- exclusion — eligibility rules are unchanged (nothing is loosened). Fixed
-- order, no score.
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
    and not exists (select 1 from matches m
                    where least(m.user_a_id::text, m.user_b_id::text) = least(me.user_id::text, c.user_id::text)
                      and greatest(m.user_a_id::text, m.user_b_id::text) = greatest(me.user_id::text, c.user_id::text)
                      and m.status in ('accepted', 'passed'))
    -- NEW (2026-10-01 R3): someone you already liked is not shown again while
    -- they haven't answered (Discover used to repeat them after a reload).
    and not exists (select 1 from likes l where l.liker_id = me.user_id and l.likee_id = c.user_id)
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
