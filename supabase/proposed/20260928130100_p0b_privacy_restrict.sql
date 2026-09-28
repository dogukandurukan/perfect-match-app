-- P0-B privacy remediation — RESTRICTIVE. PROPOSED, NOT APPLIED.
-- Apply ONLY after the client release that reads other users through
-- public.profile_cards / get_discovery_cards / get_my_liker_cards is live
-- (see docs/tempa/P0_PRIVACY_REMEDIATION.md §5). Applying it earlier breaks
-- Home, Matches, Chats, Activity and profile screens for older app builds.
--
-- Closes: any signed-in user reading OTHER users' private columns
-- (last_name, date_of_birth, phone_number, full_address, lat/lng,
-- expo_push_token, verification_selfie_path, preferences …) from
-- public.profiles via REST, and full DOB through the two RPCs.

begin;

-- profiles: a user can read ONLY their own row (all columns, incl. private).
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (auth.uid() = id);

-- Defence in depth: no anonymous table access at all.
revoke all on public.profiles from anon;

-- Full-DOB RPCs are no longer callable by clients; the age-only wrappers
-- (SECURITY DEFINER, owned by postgres) keep calling them internally.
revoke execute on function public.get_top_matches(uuid, integer) from authenticated;
revoke execute on function public.get_my_likers(integer) from authenticated;

commit;
