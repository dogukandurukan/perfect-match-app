-- Phase 0 security fix (2026-09-20), part 2 — docs/phase-0-security-report.md.
--
-- Verification selfies were being uploaded into the PUBLIC `user-photos`
-- bucket at a predictable path (`{userId}/verification_selfie.jpg`),
-- confirmed downloadable with zero authentication by anyone who knows a
-- user's uuid (`storage.buckets.public = true`, verified before this
-- migration). Every authenticated screen in this app already shows other
-- users' uuids constantly (Discover, Matches, Chat), so this was a live
-- exposure of a sensitive verification photo.
--
-- Fix: a new, PRIVATE bucket. RLS mirrors the existing `user-photos`
-- upload/delete pattern (own-folder-only, via storage.foldername(name)[1] =
-- auth.uid()), but deliberately grants NO select policy to anon/
-- authenticated at all — "service role/reviewer dışında selfie okuma
-- yetkisi verme" was explicit. Reading a selfie (for a future reviewer
-- queue) will go through a service-role Edge Function issuing short-lived
-- signed URLs, never a direct client SELECT.

begin;

insert into storage.buckets (id, name, public)
values ('verification-selfies', 'verification-selfies', false)
on conflict (id) do nothing;

create policy "own folder upload only"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'verification-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own folder delete only"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'verification-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No SELECT/UPDATE policy for anon or authenticated on this bucket, by
-- design — default-deny. service_role bypasses RLS entirely and is the
-- only way to read these objects (a future reviewer Edge Function).

commit;
