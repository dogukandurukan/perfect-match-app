-- Private bucket for profile photos (keep "Public bucket" OFF in Dashboard).
-- Object path format: {user_id}/{filename}

insert into storage.buckets (id, name, public)
values ('user-photos', 'user-photos', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can upload their own photos" on storage.objects;
drop policy if exists "Users can delete their own photos" on storage.objects;
drop policy if exists "Anyone can view photos" on storage.objects;

-- 1. Kullanıcı kendi fotoğrafını yükleyebilir
create policy "Users can upload their own photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'user-photos' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Kullanıcı kendi fotoğrafını silebilir
create policy "Users can delete their own photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'user-photos' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Oturum açmış kullanıcılar fotoğrafları görebilir (match ekranı vb.)
create policy "Anyone can view photos"
on storage.objects for select
to authenticated
using (bucket_id = 'user-photos');
