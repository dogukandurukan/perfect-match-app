-- V2 chat photos (first package): one photo per message, private Storage,
-- server-checked upload / view / send. LOCAL (tempa-local) first; not wired
-- into apply-dev.mjs.
--
--   messages            + kind ('text' | 'photo'), media_path, media_width,
--                         media_height, client_request_id (idempotent sends).
--                         Existing rows become kind 'text' (default). The text
--                         fallback of a photo message is '📷 Photo' so Chats
--                         previews / older clients stay readable.
--   messages insert RLS  unchanged rule + "text only": a photo message can only
--                         be written by send_photo_message_v2.
--   chat-photos bucket   private, 10 MB, jpeg / png / heic / webp.
--                         Path: <match id>/<sender id>/<request id>.<ext>
--                         upload: a participant of an ACTIVE chat, own folder;
--                         read:   participants while the chat history is
--                                 readable (active / unavailable), and only a
--                                 file a message points to (or your own upload).
--   send_photo_message_v2 SECURITY DEFINER: active chat, path = this match /
--                         this sender / this request id, the object exists;
--                         the same request id returns the same message
--                         (serialised on the match row: double tap / retry).
--
-- V1 photo rules (user-photos, profile-photos-private) are not touched.

alter table public.messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_width integer,
  add column if not exists media_height integer,
  add column if not exists client_request_id uuid;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'photo'));
alter table public.messages drop constraint if exists messages_photo_shape_check;
alter table public.messages add constraint messages_photo_shape_check check (
  (kind = 'text' and media_path is null and media_width is null and media_height is null)
  or (kind = 'photo' and media_path is not null
      and media_width between 1 and 20000 and media_height between 1 and 20000)
);
create unique index if not exists messages_sender_request_uq
  on public.messages (sender_id, client_request_id) where client_request_id is not null;
create unique index if not exists messages_media_path_uq
  on public.messages (media_path) where media_path is not null;

-- Same insert rule as before, plus: text messages only.
drop policy if exists messages_insert_policy on public.messages;
create policy messages_insert_policy on public.messages for insert to public with check (
  (auth.uid() = sender_id)
  and (not public.pair_is_blocked(sender_id, receiver_id))
  and (not public.v2_pair_has_suspended(sender_id, receiver_id))
  and (exists (select 1 from public.matches
               where matches.status = 'accepted'
                 and ((matches.user_a_id = auth.uid() and matches.user_b_id = messages.receiver_id)
                   or (matches.user_b_id = auth.uid() and matches.user_a_id = messages.receiver_id))))
  and kind = 'text' and media_path is null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- '<match>/<sender>/<request>.<ext>' → its parts, or nulls when malformed.
create or replace function public.v2_chat_photo_parts(p_name text, out match_id uuid, out sender_id uuid)
language plpgsql immutable set search_path = public, pg_temp
as $$
begin
  if p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|heic|webp)$' then
    match_id := split_part(p_name, '/', 1)::uuid;
    sender_id := split_part(p_name, '/', 2)::uuid;
  end if;
end $$;

create or replace function public.v2_chat_photo_can_upload(p_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and p.sender_id = auth.uid()
     and public.v2_chat_active(p.match_id, auth.uid())
  from public.v2_chat_photo_parts(p_name) p
$$;

create or replace function public.v2_chat_photo_can_view(p_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and p.match_id is not null
     and public.v2_chat_state(p.match_id, auth.uid()) in ('active', 'unavailable')
     and (p.sender_id = auth.uid() or exists (select 1 from public.messages m where m.media_path = p_name))
  from public.v2_chat_photo_parts(p_name) p
$$;

revoke all on function public.v2_chat_photo_parts(text) from public, anon;
revoke all on function public.v2_chat_photo_can_upload(text) from public, anon;
revoke all on function public.v2_chat_photo_can_view(text) from public, anon;
grant execute on function public.v2_chat_photo_can_upload(text) to authenticated;
grant execute on function public.v2_chat_photo_can_view(text) to authenticated;

drop policy if exists "chat-photos upload participant" on storage.objects;
create policy "chat-photos upload participant" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and public.v2_chat_photo_can_upload(name));
drop policy if exists "chat-photos read participants" on storage.objects;
create policy "chat-photos read participants" on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos' and public.v2_chat_photo_can_view(name));

create or replace function public.send_photo_message_v2(
  p_match uuid, p_path text, p_width integer, p_height integer, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_row messages;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_match is null then raise exception 'request_id_required' using errcode = '22023'; end if;
  -- Serialise sends on this match first, THEN look for the same request: two
  -- parallel identical calls (double tap / retry after a lost response) both
  -- end with the one message.
  perform 1 from matches where id = p_match for update;
  select * into v_row from messages where sender_id = v_me and client_request_id = p_request_id;
  if found then
    return to_jsonb(v_row) - 'client_request_id' || jsonb_build_object('already', true);
  end if;
  if not public.v2_chat_active(p_match, v_me) then raise exception 'chat_not_active' using errcode = '42501'; end if;
  if p_path is null
     or p_path !~ ('^' || p_match::text || '/' || v_me::text || '/' || p_request_id::text || '\.(jpg|png|heic|webp)$') then
    raise exception 'invalid_photo_path' using errcode = '22023';
  end if;
  if p_width is null or p_height is null or p_width not between 1 and 20000 or p_height not between 1 and 20000 then
    raise exception 'invalid_photo_size' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'chat-photos' and o.name = p_path) then
    raise exception 'photo_not_uploaded' using errcode = '22023';
  end if;
  insert into messages (sender_id, receiver_id, content, kind, media_path, media_width, media_height, client_request_id)
  values (v_me, public.v2_other_of(p_match, v_me), '📷 Photo', 'photo', p_path, p_width, p_height, p_request_id)
  returning * into v_row;
  return to_jsonb(v_row) - 'client_request_id' || jsonb_build_object('already', false);
end $$;

revoke all on function public.send_photo_message_v2(uuid, text, integer, integer, uuid) from public, anon;
grant execute on function public.send_photo_message_v2(uuid, text, integer, integer, uuid) to authenticated;
