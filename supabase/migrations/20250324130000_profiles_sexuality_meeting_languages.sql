-- Setup-1: meeting_preferences (required in app), languages (optional array)

alter table public.profiles
  add column if not exists meeting_preferences text[];

alter table public.profiles
  add column if not exists languages text[];

comment on column public.profiles.meeting_preferences is 'Men | Women | Non-binary | Everyone — hard filter for mutual matching';
comment on column public.profiles.languages is 'Spoken languages; soft score bonus for overlap';
