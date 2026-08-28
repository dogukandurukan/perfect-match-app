-- Security fix (2026-08-29): profiles_select_all / onboarding_select_all had
-- `qual: true` for role `public`, which in Postgres/Supabase includes
-- unauthenticated (anon) requests — anyone with the app's public anon key
-- (extractable from the client bundle) could read every user's full profile
-- (phone_number, date_of_birth, full_address, lat/lng, ...) and onboarding
-- answers with no login at all. Every signed-up account still needs to read
-- other users' profiles/onboarding for discovery, so we scope to
-- `authenticated` rather than remove the broad read — enforcing
-- is_hidden/deleted_at at the RLS level (not just client-side) is a bigger,
-- separate follow-up (CLAUDE.md §3 "Kalan not").
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "onboarding_select_all" on public.onboarding_answers;
create policy "onboarding_select_authenticated" on public.onboarding_answers
  for select to authenticated using (true);

-- notifications_insert had `with_check: true` for role `public` — anyone
-- with the anon key could write an arbitrary notification row into ANY
-- user's Buzz feed (spoofed "X wants to meet you" etc.). Client code never
-- inserts into `notifications` directly (grepped app/ + lib/, confirmed) —
-- all inserts come from Edge Functions using the service role key, which
-- bypasses RLS entirely and is unaffected by dropping this policy.
drop policy if exists "notifications_insert" on public.notifications;
