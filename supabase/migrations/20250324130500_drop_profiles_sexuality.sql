-- Remove deprecated Setup-1 field (run if a previous migration added sexuality)

alter table public.profiles
  drop column if exists sexuality;
