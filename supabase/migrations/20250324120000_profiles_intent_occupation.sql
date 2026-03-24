-- Profile setup: intent mirror + occupation + education detail (optional follow-up from Setup-3)
-- Run in Supabase SQL editor or via CLI if you use migrations.

alter table public.profiles
  add column if not exists intent text;

alter table public.profiles
  add column if not exists occupation text;

alter table public.profiles
  add column if not exists education_detail text;

comment on column public.profiles.intent is 'just_friends | keeping_it_casual | open_to_relationship | not_sure_yet (synced from preferences at end of Setup-2)';

comment on column public.profiles.occupation is 'Optional, from Setup-3';

comment on column public.profiles.education_detail is 'Optional school/university/field detail from Setup-3';
