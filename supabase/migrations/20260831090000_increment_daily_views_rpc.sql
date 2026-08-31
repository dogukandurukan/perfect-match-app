-- Fix (2026-08-31, codebase audit): lib/dailyViews.ts's incrementDailyViews
-- did a client-side read-then-write (SELECT count, compute count+1, UPDATE)
-- across two separate round trips — a race condition. Two near-simultaneous
-- calls (e.g. a fast double-tap) both read the same starting count and both
-- write the same nextCount, under-counting and letting the daily like/view
-- limit be exceeded. Mirrors the existing try_send_invite RPC's pattern
-- (SELECT ... FOR UPDATE row lock, all in one transaction) which is why
-- daily_invites_count never had this problem — only daily_views_count did.
create or replace function public.increment_daily_views(p_user uuid)
returns table(daily_views_count int, daily_views_reset_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count int;
  v_reset timestamptz;
begin
  select p.daily_views_count, p.daily_views_reset_at
    into v_count, v_reset
    from profiles p
    where p.id = p_user
    for update;

  if v_count is null then
    v_count := 0;
  end if;

  if v_reset is null or v_reset + interval '24 hours' < now() then
    v_count := 0;
    v_reset := now();
  end if;

  v_count := v_count + 1;

  update profiles
    set daily_views_count = v_count,
        daily_views_reset_at = v_reset
    where id = p_user;

  return query select v_count, v_reset;
end;
$$;
