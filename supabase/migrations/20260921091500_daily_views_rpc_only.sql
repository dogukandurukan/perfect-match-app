-- Phase 0.1 security fix (2026-09-21), part 2 — docs/phase-0-1-security-report.md.
--
-- Found during the Phase 0 audit (docs/phase-0-security-report.md §2.6):
-- `lib/dailyViews.ts`'s peek/reset path did a DIRECT client-side
-- `UPDATE profiles SET daily_views_count=0, daily_views_reset_at=now()`
-- whenever its own in-memory 24h check said a reset was due. Since that
-- check runs entirely in JS, any authenticated user could PATCH those two
-- columns via a raw REST call at any time, resetting their own like-quota
-- on demand regardless of whether 24h had actually passed — the exact
-- opposite of `lib/dailyInvites.ts`'s pattern, which never writes directly
-- and goes through `try_send_invite` for everything.
--
-- Fix: a new `get_daily_views_state` RPC — same row-locked, auth.uid()-
-- checked shape as the existing `increment_daily_views` (which already did
-- the right thing and needed no changes), used for the "peek, resetting if
-- 24h has passed" case that `increment_daily_views` alone doesn't cover
-- (incrementing every time you just want to *display* the remaining count
-- would be wrong). Both RPCs lock the same row with `FOR UPDATE`, so a
-- peek and an increment racing each other serialize correctly instead of
-- reading stale data.
--
-- `daily_views_count`/`daily_views_reset_at` are removed from the
-- `authenticated` UPDATE allowlist (supabase/migrations/
-- 20260920090000_lockdown_profiles_column_grants.sql originally included
-- them specifically to avoid breaking the direct-update path being
-- replaced here — now that the path is gone, the grant is too).

begin;

create or replace function public.get_daily_views_state(p_user uuid)
returns table(daily_views_count integer, daily_views_reset_at timestamptz, is_premium boolean)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count int;
  v_reset timestamptz;
  v_premium boolean;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;

  select p.daily_views_count, p.daily_views_reset_at, coalesce(p.is_premium, false)
    into v_count, v_reset, v_premium
    from profiles p
    where p.id = p_user
    for update;

  if v_count is null then
    v_count := 0;
  end if;

  if v_reset is null or v_reset + interval '24 hours' < now() then
    v_count := 0;
    v_reset := now();
    update profiles
      set daily_views_count = v_count,
          daily_views_reset_at = v_reset
      where id = p_user;
  end if;

  return query select v_count, v_reset, v_premium;
end;
$$;

revoke all on function public.get_daily_views_state(uuid) from public, anon, authenticated;
grant execute on function public.get_daily_views_state(uuid) to authenticated;

revoke update (daily_views_count, daily_views_reset_at) on public.profiles from authenticated;

commit;
