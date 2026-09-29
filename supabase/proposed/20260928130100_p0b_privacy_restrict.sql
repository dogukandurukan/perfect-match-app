-- P0-B privacy remediation — RESTRICTIVE. PROPOSED, NOT APPLIED.
-- Apply ONLY after the R-P0 client release (reads other users through
-- public.profile_cards / get_discovery_cards / get_my_liker_cards /
-- get_date_venue_suggestions) is the minimum supported build, see
-- docs/tempa/P0_PRIVACY_REMEDIATION.md §5. Older builds that read other
-- users from public.profiles will show empty names/photos after this.
--
-- Closes: any signed-in user reading OTHER users' private columns
-- (last_name, date_of_birth, phone_number, full_address, lat/lng, district,
-- instagram_handle, expo_push_token, verification_selfie_path, preferences,
-- account state …) from public.profiles via REST or embedded joins, and the
-- full DOB / district through the two original RPCs.

begin;

-- profiles: a user can read ONLY their own row (all columns, incl. private).
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (auth.uid() = id);

-- The two original RPCs return date_of_birth (and district); clients use the
-- wrappers from P0-A instead. The wrappers are SECURITY DEFINER (owned by
-- postgres) and keep calling the originals internally.
revoke execute on function public.get_top_matches(uuid, integer) from public, anon, authenticated;
revoke execute on function public.get_my_likers(integer) from public, anon, authenticated;

commit;
