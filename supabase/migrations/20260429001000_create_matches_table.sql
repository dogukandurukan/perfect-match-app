create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  matched_user_id uuid not null references auth.users(id) on delete cascade,
  match_percentage int not null check (match_percentage >= 0 and match_percentage <= 100),
  match_category text not null,
  reasons text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, matched_user_id, status)
);

create index if not exists idx_matches_user_id on public.matches(user_id);
create index if not exists idx_matches_expires_at on public.matches(expires_at);

create or replace function public.set_matches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row execute procedure public.set_matches_updated_at();
