-- Setup-4 field names aligned with logic docs

alter table public.preferences
  add column if not exists availability_hours text[];

alter table public.preferences
  add column if not exists meeting_environment text[];

alter table public.preferences
  add column if not exists first_date_expectation text;

alter table public.preferences
  add column if not exists bio text;

-- Optional backfill from older field names
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'availability_times'
  ) then
    update public.preferences
    set availability_hours = coalesce(availability_hours, availability_times)
    where availability_hours is null and availability_times is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'first_date_venues'
  ) then
    update public.preferences
    set meeting_environment = coalesce(meeting_environment, first_date_venues)
    where meeting_environment is null and first_date_venues is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'first_meeting_hope'
  ) then
    update public.preferences
    set first_date_expectation = coalesce(first_date_expectation, first_meeting_hope)
    where first_date_expectation is null and first_meeting_hope is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'about_me'
  ) then
    update public.preferences
    set bio = coalesce(bio, about_me)
    where bio is null and about_me is not null;
  end if;
end $$;
