-- Follow-up fix, same-session catch (2026-09-16): public.pair_is_blocked()
-- was created SECURITY INVOKER. Called from within matches/messages RLS, it
-- runs as the actual requesting user — and blocks' own RLS policy
-- (blocks_own: using auth.uid() = blocker_id) only lets a user see block
-- rows where THEY are the blocker. The blocked person (the exact attacker
-- this whole fix targets) can never see the row where someone else blocked
-- THEM, so pair_is_blocked() silently returned false for them — the
-- previous migration's block check never actually fired for the case that
-- matters. Fix: SECURITY DEFINER (owned by postgres, bypasses RLS on
-- blocks) so the check sees the real block state regardless of who asks.
-- Safe to expose broadly — it returns a bare boolean, never which row or
-- who blocked whom.

-- CREATE OR REPLACE, not DROP+CREATE: the matches/messages RLS policies
-- from the previous migration already reference this function by OID —
-- dropping it would either fail (dependency error) or, with CASCADE, take
-- those policies down with it.
create or replace function public.pair_is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Least-privilege: only answer for a pair the caller is actually part of.
  -- Without this, exposing the function to `authenticated` would let anyone
  -- probe whether two ENTIRELY UNRELATED users have blocked each other —
  -- a minor info-leak oracle this callable-by-anyone RPC doesn't need to be.
  select case
    when auth.uid() is distinct from a and auth.uid() is distinct from b then false
    else exists (
      select 1 from blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$$;

revoke all on function public.pair_is_blocked(uuid, uuid) from public;
grant execute on function public.pair_is_blocked(uuid, uuid) to authenticated;
