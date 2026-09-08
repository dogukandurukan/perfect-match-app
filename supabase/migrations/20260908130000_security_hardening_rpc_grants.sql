-- Security hardening pass (2026-09-08, Supabase advisor findings):
--
-- 1) try_send_invite / increment_daily_views were SECURITY DEFINER + granted
--    to PUBLIC (anon included) with no ownership check on p_user. An
--    unauthenticated caller could hit them directly via PostgREST with any
--    UUID: increment_daily_views would burn a stranger's daily-view quota,
--    and try_send_invite trusted the client-supplied p_is_premium boolean
--    outright — anyone could pass p_is_premium:true to get the 3-invite
--    premium limit instead of 1, a real monetization bypass. Fixed by
--    requiring auth.uid() = p_user, and by having try_send_invite look up
--    is_premium from profiles itself instead of trusting the parameter
--    (parameter kept in the signature, now ignored, so the existing client
--    call in lib/matchInvite.ts doesn't need to change).
-- 2) EXECUTE revoked from PUBLIC/anon on all SECURITY DEFINER functions;
--    re-granted to authenticated only where the app actually calls them
--    client-side. auto_hide_after_reports/handle_match_notification are
--    trigger-only functions with no legitimate direct-call use — revoking
--    PUBLIC execute doesn't affect trigger firing (trigger invocation isn't
--    subject to EXECUTE ACL checks).
-- 3) search_path pinned on the 6 functions the advisor flagged as mutable
--    (none are SECURITY DEFINER, so this is low-severity, but free to fix).

CREATE OR REPLACE FUNCTION public.try_send_invite(p_user uuid, p_is_premium boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_limit int; v_count int; v_reset timestamptz; v_is_premium boolean;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user THEN
    RETURN false;
  END IF;

  SELECT daily_invites_count, daily_invites_reset_at, COALESCE(is_premium, false)
    INTO v_count, v_reset, v_is_premium
    FROM profiles WHERE id = p_user
    FOR UPDATE;

  IF v_count IS NULL THEN
    RETURN false;               -- profil bulunamadı
  END IF;

  IF v_reset IS NULL OR v_reset < now() - interval '24 hours' THEN
    v_count := 0;                -- 24 saat geçmiş, sıfırla
    UPDATE profiles SET daily_invites_reset_at = now() WHERE id = p_user;
  END IF;

  v_limit := CASE WHEN v_is_premium THEN 3 ELSE 1 END;

  IF v_count >= v_limit THEN
    RETURN false;                -- limit dolu
  END IF;

  UPDATE profiles SET daily_invites_count = v_count + 1 WHERE id = p_user;
  RETURN true;                   -- davet hakkı verildi
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_daily_views(p_user uuid)
 RETURNS TABLE(daily_views_count integer, daily_views_reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int;
  v_reset timestamptz;
begin
  IF auth.uid() IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

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
$function$;

REVOKE EXECUTE ON FUNCTION public.try_send_invite(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_send_invite(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_daily_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_daily_views(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_likers(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_likers(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_hide_after_reports() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_match_notification() FROM PUBLIC;

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_match_status() SET search_path = public;
ALTER FUNCTION public.handle_mutual_accept() SET search_path = public;
ALTER FUNCTION public.get_top_matches(uuid, integer) SET search_path = public;
ALTER FUNCTION public.handle_match_notification() SET search_path = public;
ALTER FUNCTION public.upsert_match(uuid, uuid, numeric) SET search_path = public;
