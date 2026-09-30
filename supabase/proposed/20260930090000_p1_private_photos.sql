-- P1-photos — private profile photo bucket + 15-minute signed URLs.
-- PROPOSED, NOT APPLIED. Needs P0-A (can_view_profile_as_me). Apply together
-- with P0-A and BEFORE the R-P0 client (which uploads to and signs from this
-- bucket). Existing objects are moved by the resumable runbook in
-- docs/tempa/P0_PRIVACY_REMEDIATION.md §3.3 (live has 0 objects today).
--
-- Access model:
--   INSERT / DELETE: only into your own folder `{uid}/…`.
--   SELECT (= what createSignedUrl(s) needs): only objects whose owner folder
--   is a person you may see right now (can_view_profile_as_me): yourself, a
--   discoverable person, or an accepted match — never hidden strangers,
--   blocked (either way) or deleted users.
--   No UPDATE (no overwrite / move by clients). anon: nothing.
-- Limits that remain (documented, not solvable here): a signed URL already
-- handed out keeps working until it expires (15 min); images already on a
-- device stay until the cache evicts them.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos-private', 'profile-photos-private', false, 10485760,
        array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder segment → uuid, NULL for anything malformed (no cast errors in RLS).
create or replace function public.storage_owner_id(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid end
$$;
revoke all on function public.storage_owner_id(text) from public, anon;
grant execute on function public.storage_owner_id(text) to authenticated;

drop policy if exists "profile-photos-private read visible owners" on storage.objects;
drop policy if exists "profile-photos-private upload own folder" on storage.objects;
drop policy if exists "profile-photos-private delete own folder" on storage.objects;

create policy "profile-photos-private read visible owners"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos-private'
         and public.can_view_profile_as_me(public.storage_owner_id(name)));

create policy "profile-photos-private upload own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos-private'
              and public.storage_owner_id(name) = auth.uid());

create policy "profile-photos-private delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos-private'
         and public.storage_owner_id(name) = auth.uid());

-- Bookkeeping for the resumable move of existing objects (service role only).
create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;
create table if not exists ops.photo_migration (
  old_bucket text not null,
  old_path text not null,
  new_path text not null unique,
  owner_id uuid not null,
  copied_at timestamptz,
  db_updated_at timestamptz,
  old_deleted_at timestamptz,
  primary key (old_bucket, old_path)
);

commit;
