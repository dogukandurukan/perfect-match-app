-- P0-A: revert to the exact pre-P0 live state (2026-09-29 snapshot).
-- NOT A SAFE DEFAULT: this reopens every hole P0-A closes (INSERT bypass of
-- server-owned profile fields, forged match acceptance / chat opening,
-- message/notification rewriting, anonymous photo listing). Preferred
-- recovery is FIX-FORWARD (plan §5.3): drop only the guard that blocks a
-- legitimate flow, fix it, re-create it. Use this file only with an explicit
-- owner decision, and only if P0-B is NOT applied.
begin;
drop function if exists public.get_date_venue_suggestions(uuid);
drop function if exists public.get_my_liker_cards(integer);
drop function if exists public.get_discovery_cards(integer);
drop view if exists public.profile_cards;
drop trigger if exists profiles_guard_client_writes on public.profiles;
drop trigger if exists matches_guard_client_writes on public.matches;
drop trigger if exists likes_guard_client_writes on public.likes;
drop function if exists public.guard_profile_client_writes();
drop function if exists public.guard_match_client_writes();
drop function if exists public.guard_like_client_writes();
drop function if exists public.can_like_internal(uuid);
drop function if exists public.match_gender_internal(uuid);
drop function if exists public.can_view_profile_as_me(uuid);
drop function if exists public.can_view_profile(uuid, uuid);

drop policy if exists "user-photos read own folder" on storage.objects;
create policy "photos are public" on storage.objects for select to public
  using (bucket_id = 'user-photos');
create policy "Anyone can view photos" on storage.objects for select to authenticated
  using (bucket_id = 'user-photos');
create policy "users can upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists messages_update_read_receipt on public.messages;
create policy messages_update_own on public.messages for update to public
  using ((auth.uid() = sender_id) or (auth.uid() = receiver_id))
  with check ((auth.uid() = sender_id) or (auth.uid() = receiver_id));

-- Table grants as they were (Supabase defaults; events: authenticated INSERT only).
grant select, insert, update, delete, truncate, references, trigger
  on public.blocks, public.likes, public.matches, public.messages, public.notifications,
     public.onboarding_answers, public.reports, public.venues, public.profiles
  to anon;
grant select, insert, update, delete, truncate, references, trigger
  on public.blocks, public.likes, public.matches, public.messages, public.notifications,
     public.onboarding_answers, public.reports, public.venues
  to authenticated;
grant select, insert, delete, truncate, references, trigger on public.profiles to authenticated;
revoke insert on public.events from authenticated;
grant insert on public.events to authenticated;
grant execute on function public.upsert_match(uuid, uuid, numeric) to public, anon;
grant execute on function public.pair_is_blocked(uuid, uuid) to anon;
commit;
