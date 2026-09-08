-- Follow-up to 20260908130000: REVOKE ... FROM PUBLIC did not touch these
-- functions' actual ACLs — pg_proc.proacl showed explicit
-- `anon=X/postgres, authenticated=X/postgres` grants (from whatever
-- migration originally created them), which are separate ACL entries from
-- the PUBLIC pseudo-role and survive a REVOKE FROM PUBLIC untouched.
-- Advisor re-check after the first migration confirmed anon could still
-- execute all 5 — revoking the actual named-role grants this time.

REVOKE EXECUTE ON FUNCTION public.try_send_invite(uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_send_invite(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_daily_views(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_views(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_likers(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_likers(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_hide_after_reports() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_match_notification() FROM anon, authenticated;
