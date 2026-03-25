alter table public.profiles
  add column if not exists phone_number text;

comment on column public.profiles.phone_number is 'Optional; collected at signup';
