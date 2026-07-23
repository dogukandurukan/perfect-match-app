-- Settings + map fix: profiles tablosunda eksik olan 9 kolon.
-- lib/profileSettings.ts ve app/(tabs)/map.tsx bunları sorguluyordu → PostgREST 400.
alter table profiles
  add column if not exists discovery_age_min int default 18,
  add column if not exists discovery_age_max int default 60,
  add column if not exists discovery_max_distance text default 'whole_city',
  add column if not exists notify_new_match boolean default true,
  add column if not exists notify_messages boolean default true,
  add column if not exists notify_meeting_invite boolean default true,
  add column if not exists is_hidden boolean default false,
  add column if not exists hide_location boolean default false,
  add column if not exists deleted_at timestamptz;

notify pgrst, 'reload schema';
