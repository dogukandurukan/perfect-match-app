-- Setup-3 updates:
-- - recharge_style becomes multi-select (text[] in both profiles & preferences)
-- - drinking + smoking combined into drinking_smoking (profiles & preferences)

-- Add new drinking_smoking fields
alter table public.profiles
  add column if not exists drinking_smoking text;

alter table public.preferences
  add column if not exists drinking_smoking text;

-- Convert recharge_style from text -> text[] (only if it's currently text)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'recharge_style' and data_type = 'text'
  ) then
    alter table public.profiles
      alter column recharge_style type text[]
      using case
        when recharge_style is null or btrim(recharge_style) = '' then null
        else array[recharge_style]
      end;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'recharge_style' and data_type = 'text'
  ) then
    alter table public.preferences
      alter column recharge_style type text[]
      using case
        when recharge_style is null or btrim(recharge_style) = '' then null
        else array[recharge_style]
      end;
  end if;
end $$;

-- Backfill drinking_smoking from old drinking/smoking fields if present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'drinking'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'smoking'
  ) then
    update public.profiles
    set drinking_smoking =
      case
        when drinking = 'No' and smoking = 'No' then 'Neither'
        when drinking = 'Yes' and smoking = 'Yes' then 'Both'
        when drinking = 'Yes' and smoking = 'No' then 'Only drinking'
        when drinking = 'No' and smoking = 'Yes' then 'Only smoking'
        when drinking = 'Socially' or smoking = 'Sometimes' then 'When socializing'
        else null
      end
    where drinking_smoking is null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'drinking'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'smoking'
  ) then
    update public.preferences
    set drinking_smoking =
      case
        when drinking = 'No' and smoking = 'No' then 'Neither'
        when drinking = 'Yes' and smoking = 'Yes' then 'Both'
        when drinking = 'Yes' and smoking = 'No' then 'Only drinking'
        when drinking = 'No' and smoking = 'Yes' then 'Only smoking'
        when drinking = 'Socially' or smoking = 'Sometimes' then 'When socializing'
        else null
      end
    where drinking_smoking is null;
  end if;
end $$;

-- Drop old columns (code no longer writes/reads them)
alter table public.profiles
  drop column if exists drinking;

alter table public.profiles
  drop column if exists smoking;

alter table public.preferences
  drop column if exists drinking;

alter table public.preferences
  drop column if exists smoking;

