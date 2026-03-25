-- Setup-1 spec: photos text[], height_cm integer (canonical storage)

alter table public.profiles
  add column if not exists photos text[];

alter table public.profiles
  add column if not exists height_cm integer;

-- Backfill from legacy columns when they exist (older app versions)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'photo_urls'
  ) then
    update public.profiles
    set photos = coalesce(photos, photo_urls)
    where photos is null and photo_urls is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'height'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'height_unit'
    ) then
      update public.profiles
      set height_cm = round(height::numeric)
      where height_cm is null and height is not null and coalesce(height_unit, 'cm') = 'cm';

      update public.profiles
      set height_cm = round(height::numeric * 30.48)
      where height_cm is null and height is not null and height_unit = 'ft';
    else
      update public.profiles
      set height_cm = round(height::numeric)
      where height_cm is null and height is not null;
    end if;
  end if;
end $$;

comment on column public.profiles.photos is 'Public URLs (or paths) for profile photos; min 1 required in app';
comment on column public.profiles.height_cm is 'Height in centimeters; optional';
