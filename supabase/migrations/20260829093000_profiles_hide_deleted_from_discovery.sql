-- Security/product fix (2026-08-29, part 2): the previous migration's
-- profiles_select_authenticated still returned every row unconditionally to
-- any logged-in user, including is_hidden/deleted_at soft-deleted profiles.
-- Worse than just direct-query access: get_top_matches (Home discovery RPC)
-- is NOT security definer, so profiles RLS applies to it directly — a
-- hidden/deleted user could still surface as a brand-new discovery card to
-- strangers who never matched with them (the actual "sızıntı" CLAUDE.md
-- flagged, not just raw table access).
--
-- Fix: hidden/deleted profiles stay visible only to people who already have
-- a `matches` row with them (existing chats/invites/history keep working
-- exactly as before) — everyone else (new discovery, strangers) only sees
-- active profiles.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or (coalesce(is_hidden, false) = false and deleted_at is null)
    or exists (
      select 1 from public.matches m
      where (m.user_a_id = auth.uid() and m.user_b_id = profiles.id)
         or (m.user_b_id = auth.uid() and m.user_a_id = profiles.id)
    )
  );
