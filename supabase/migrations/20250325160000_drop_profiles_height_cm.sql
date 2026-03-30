-- Remove height from profiles (Setup-1 no longer collects height).
alter table public.profiles
  drop column if exists height_cm;
