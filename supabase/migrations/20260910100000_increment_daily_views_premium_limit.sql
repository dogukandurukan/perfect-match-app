-- increment_daily_views now also returns is_premium so the client can
-- compute the correct daily-like cap (free=5, premium=10 — mirrors
-- try_send_invite's existing free=1/premium=3 pattern) without an extra
-- round-trip on every like. Ownership check / row-lock logic unchanged.
-- Return type is changing (new is_premium column) — Postgres won't let
-- CREATE OR REPLACE change the OUT-parameter row type, has to be dropped
-- first. This also drops its grants, so they're reapplied at the bottom
-- (matches the 2026-09-08 security-hardening pass: authenticated only).
DROP FUNCTION IF EXISTS public.increment_daily_views(uuid);

CREATE FUNCTION public.increment_daily_views(p_user uuid)
 RETURNS TABLE(daily_views_count integer, daily_views_reset_at timestamp with time zone, is_premium boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int;
  v_reset timestamptz;
  v_premium boolean;
begin
  IF auth.uid() IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

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
  end if;

  v_count := v_count + 1;

  update profiles
    set daily_views_count = v_count,
        daily_views_reset_at = v_reset
    where id = p_user;

  return query select v_count, v_reset, v_premium;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_daily_views(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_views(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
