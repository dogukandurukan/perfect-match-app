-- P1-photos revert. Only safe BEFORE the R-P0 client ships (that client
-- reads/writes only the private bucket). Does not touch objects: the private
-- bucket stays private; it only drops the new policies/helper/bookkeeping.
begin;
drop policy if exists "profile-photos-private read visible owners" on storage.objects;
drop policy if exists "profile-photos-private upload own folder" on storage.objects;
drop policy if exists "profile-photos-private delete own folder" on storage.objects;
drop function if exists public.storage_owner_id(text);
drop table if exists ops.photo_migration;
commit;
