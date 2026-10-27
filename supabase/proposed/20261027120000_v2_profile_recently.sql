-- V2: "Recently" on the profile (owner decision 2026-10-27, D106) — one book
-- (title — author) and one song (title — artist, optional music link), both
-- optional, kept until the member changes or removes them. Shown under the
-- name on the profile others see (get_profile_v2), in the own preview and on
-- My Profile. No story, ring, expiry, notification, autoplay or new photo.
-- LOCAL (tempa-local) first; not wired into apply-dev.mjs.
--
--   • profile_recently_v2: one row per member; RLS on, no policies, no direct
--     access — RPCs only.
--   • save_my_recently_v2: active members only (v2_assert_member_profile_edit),
--     only their own row; the general onboarding lock is unchanged.
--     Limits (after trimming): book title 1–120, book author 0–80, song title
--     1–120, song artist 0–80, link 0–500; no line breaks / control chars;
--     an author needs a book, an artist or link needs a song.
--     Link: https only, no user:password@, host on a short music-service
--     allow-list (or its subdomains), no spaces.
--     Concurrency: p_expected_updated_at = the row version the screen loaded
--     (null = none); a different version → profile_changed, nothing written.
--     Everything empty → the row is removed.
--   • get_profile_v2: same as before plus 'recently' (null when empty) —
--     visibility rules unchanged (v2_can_view_public_profile).
create table if not exists public.profile_recently_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  book_title text,
  book_author text,
  song_title text,
  song_artist text,
  song_url text,
  updated_at timestamptz not null default now(),
  constraint profile_recently_v2_book_title_len check (book_title is null or char_length(book_title) between 1 and 120),
  constraint profile_recently_v2_book_author_len check (book_author is null or char_length(book_author) between 1 and 80),
  constraint profile_recently_v2_song_title_len check (song_title is null or char_length(song_title) between 1 and 120),
  constraint profile_recently_v2_song_artist_len check (song_artist is null or char_length(song_artist) between 1 and 80),
  constraint profile_recently_v2_song_url_len check (song_url is null or char_length(song_url) between 12 and 500),
  constraint profile_recently_v2_author_needs_book check (book_author is null or book_title is not null),
  constraint profile_recently_v2_song_parts check ((song_artist is null and song_url is null) or song_title is not null),
  constraint profile_recently_v2_not_empty check (book_title is not null or song_title is not null)
);
alter table public.profile_recently_v2 enable row level security; -- no policies: RPCs only
revoke all on public.profile_recently_v2 from anon, authenticated;

-- https + a known music service (or its subdomain), no credentials, no spaces.
create or replace function public.v2_is_music_url(p_url text)
returns boolean language sql immutable as $$
  select p_url is not null
     and char_length(p_url) between 12 and 500
     and p_url !~ '[[:space:][:cntrl:]]'
     and p_url ~* '^https://([a-z0-9-]+\.)*(spotify\.com|apple\.com|youtube\.com|youtu\.be|soundcloud\.com|deezer\.com|tidal\.com|music\.amazon\.com|bandcamp\.com|fizy\.com)(:443)?(/[^@]*)?$'
$$;

create or replace function public.v2_recently_public(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when r.user_id is null then null else jsonb_build_object(
    'book', case when r.book_title is null then null else jsonb_build_object('title', r.book_title, 'author', r.book_author) end,
    'song', case when r.song_title is null then null else jsonb_build_object('title', r.song_title, 'artist', r.song_artist, 'url', r.song_url) end) end
  from (select 1) one left join profile_recently_v2 r on r.user_id = p_user
$$;

create or replace function public.get_my_recently_v2()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); r profile_recently_v2;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into r from profile_recently_v2 where user_id = v_uid;
  return jsonb_build_object('book_title', r.book_title, 'book_author', r.book_author, 'song_title', r.song_title,
    'song_artist', r.song_artist, 'song_url', r.song_url, 'updated_at', r.updated_at);
end;
$$;

create or replace function public.save_my_recently_v2(
  p_book_title text, p_book_author text, p_song_title text, p_song_artist text, p_song_url text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  v_bt text := nullif(btrim(coalesce(p_book_title, '')), '');
  v_ba text := nullif(btrim(coalesce(p_book_author, '')), '');
  v_st text := nullif(btrim(coalesce(p_song_title, '')), '');
  v_sa text := nullif(btrim(coalesce(p_song_artist, '')), '');
  v_su text := nullif(btrim(coalesce(p_song_url, '')), '');
  r profile_recently_v2;
begin
  -- Serialise this member's saves (also when no row exists yet).
  perform 1 from account_state_v2 where user_id = v_uid for update;
  select * into r from profile_recently_v2 where user_id = v_uid for update;
  if r.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'profile_changed');
  end if;
  if (v_bt is not null and (char_length(v_bt) > 120 or v_bt ~ '[[:cntrl:]]')) then return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'book_title'); end if;
  if (v_ba is not null and (char_length(v_ba) > 80 or v_ba ~ '[[:cntrl:]]' or v_bt is null)) then return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'book_author'); end if;
  if (v_st is not null and (char_length(v_st) > 120 or v_st ~ '[[:cntrl:]]')) then return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'song_title'); end if;
  if (v_sa is not null and (char_length(v_sa) > 80 or v_sa ~ '[[:cntrl:]]' or v_st is null)) then return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'song_artist'); end if;
  if (v_su is not null and (v_st is null or not public.v2_is_music_url(v_su))) then return jsonb_build_object('ok', false, 'error', 'invalid_value', 'field', 'song_url'); end if;

  if v_bt is null and v_st is null then
    delete from profile_recently_v2 where user_id = v_uid;
    return jsonb_build_object('ok', true, 'recently', jsonb_build_object('book_title', null, 'book_author', null, 'song_title', null,
      'song_artist', null, 'song_url', null, 'updated_at', null));
  end if;
  insert into profile_recently_v2 as x (user_id, book_title, book_author, song_title, song_artist, song_url, updated_at)
  values (v_uid, v_bt, v_ba, v_st, v_sa, v_su, clock_timestamp())
  on conflict (user_id) do update set book_title = excluded.book_title, book_author = excluded.book_author,
    song_title = excluded.song_title, song_artist = excluded.song_artist, song_url = excluded.song_url, updated_at = excluded.updated_at
  returning * into r;
  return jsonb_build_object('ok', true, 'recently', jsonb_build_object('book_title', r.book_title, 'book_author', r.book_author,
    'song_title', r.song_title, 'song_artist', r.song_artist, 'song_url', r.song_url, 'updated_at', r.updated_at));
end;
$$;

-- get_profile_v2: the current definition (local replica) + 'recently'.
create or replace function public.get_profile_v2(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'user_id', o.user_id,
    'first_name', btrim(o.first_name),
    'age', date_part('year', age(o.date_of_birth))::int,
    'zodiac', public.v2_zodiac(o.date_of_birth),
    'city', o.location_city,
    'height_cm', o.height_cm,
    'work_status', o.work_status,
    'job_title', nullif(btrim(o.job_title), ''),
    'school', o.school,
    'hometown', o.hometown,
    'intent', o.intent,
    'core_values', coalesce(to_jsonb(o.core_values), '[]'::jsonb),
    'interests', coalesce(to_jsonb(o.interests), '[]'::jsonb),
    'activities', coalesce(to_jsonb(o.activities), '[]'::jsonb),
    'smoking', o.smoking,
    'drinking', o.drinking,
    'pets', o.pets,
    'pet_kind', o.pet_kind,
    'activity', o.activity,
    'artists', coalesce(o.artists, '[]'::jsonb),
    'books', coalesce(o.books, '[]'::jsonb),
    'screen', coalesce(o.screen, '[]'::jsonb),
    'date_types', coalesce(to_jsonb(o.date_types), '[]'::jsonb),
    'favorite_spot', nullif(btrim(o.favorite_spot), ''),
    'days_pref', o.days_pref,
    'time_pref', o.time_pref,
    'prompts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slot', p.slot, 'prompt_id', p.prompt_id, 'answer', p.answer)
                                          order by p.slot)
                         from profile_prompts_v2 p where p.user_id = o.user_id), '[]'::jsonb),
    'photo_paths', coalesce((select jsonb_agg(f.storage_path order by f.position)
                             from profile_photos_v2 f where f.user_id = o.user_id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path) order by f.position)
                        from profile_photos_v2 f where f.user_id = o.user_id), '[]'::jsonb),
    'takes', coalesce((select jsonb_agg(jsonb_build_object('subject_kind', t.subject_kind, 'subject_id', t.subject_id,
                                                           'subject_title', t.subject_title, 'question_id', t.question_id,
                                                           'answer', t.answer) order by t.position)
                       from profile_takes_v2 t where t.user_id = o.user_id), '[]'::jsonb),
    -- NEW (D106): optional "Recently" (book / song); null when empty.
    'recently', public.v2_recently_public(o.user_id))
  from onboarding_v2 o
  where o.user_id = p_user
    and public.v2_can_view_public_profile(auth.uid(), p_user)
$function$;

revoke all on function public.v2_recently_public(uuid) from public, anon, authenticated;
revoke all on function public.v2_is_music_url(text) from public, anon, authenticated;
revoke all on function public.get_my_recently_v2() from public, anon;
grant execute on function public.get_my_recently_v2() to authenticated;
revoke all on function public.save_my_recently_v2(text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.save_my_recently_v2(text, text, text, text, text, timestamptz) to authenticated;
revoke all on function public.get_profile_v2(uuid) from public, anon;
grant execute on function public.get_profile_v2(uuid) to authenticated;
