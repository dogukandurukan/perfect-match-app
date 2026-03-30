-- Setup-4: preferred neighborhoods
alter table public.profiles
  add column if not exists preferred_locations text[];

comment on column public.profiles.preferred_locations
  is 'Preferred neighborhoods (max 3) for meeting suggestions.';

