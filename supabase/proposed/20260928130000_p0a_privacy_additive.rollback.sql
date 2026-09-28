-- Rollback for P0-A. Restores the pre-P0 state exactly (as dumped live on
-- 2026-09-28). Run only if P0-B is not applied (or roll back P0-B first).
begin;
drop function if exists public.get_my_liker_cards(integer);
drop function if exists public.get_discovery_cards(integer);
drop view if exists public.profile_cards;
drop trigger if exists profiles_guard_client_writes on public.profiles;
drop function if exists public.guard_profile_client_writes();
drop policy if exists "user-photos read own folder" on storage.objects;
create policy "photos are public" on storage.objects for select to public
  using (bucket_id = 'user-photos');
create policy "Anyone can view photos" on storage.objects for select to authenticated
  using (bucket_id = 'user-photos');
create policy "users can upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
grant insert, truncate, trigger, references on public.profiles to anon, authenticated;
commit;
