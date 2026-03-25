-- Align profiles table with Setup-3 / Setup-4 fields from master logic docs

alter table public.profiles add column if not exists morning_night text;
alter table public.profiles add column if not exists recharge_style text;
alter table public.profiles add column if not exists hobbies text[];
alter table public.profiles add column if not exists vibe text;
alter table public.profiles add column if not exists drinking text;
alter table public.profiles add column if not exists smoking text;
alter table public.profiles add column if not exists pets text;
alter table public.profiles add column if not exists education text;
alter table public.profiles add column if not exists religion text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists availability_days text[];
alter table public.profiles add column if not exists availability_hours text[];
alter table public.profiles add column if not exists meeting_environment text[];
alter table public.profiles add column if not exists favorite_spots jsonb;
alter table public.profiles add column if not exists first_date_expectation text;
