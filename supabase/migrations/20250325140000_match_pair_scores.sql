-- Pair-level match score + percentage (UI: matchPercentage = round((total_score / 360) * 100))

create table if not exists public.match_pair_scores (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  total_score int not null,
  raw_total_score int not null,
  match_percentage int not null,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_pair_scores_ordered_pair check (user_a_id < user_b_id),
  constraint match_pair_scores_unique_pair unique (user_a_id, user_b_id),
  constraint match_pair_scores_percentage_range check (
    match_percentage >= 0 and match_percentage <= 100
  )
);

create index if not exists match_pair_scores_user_a_idx on public.match_pair_scores (user_a_id);
create index if not exists match_pair_scores_user_b_idx on public.match_pair_scores (user_b_id);

comment on table public.match_pair_scores is 'Cached match score between two profiles; user_a_id < user_b_id';

alter table public.match_pair_scores enable row level security;

create policy "Users can read match_pair_scores they are part of"
  on public.match_pair_scores
  for select
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Users can insert match_pair_scores they are part of"
  on public.match_pair_scores
  for insert
  to authenticated
  with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Users can update match_pair_scores they are part of"
  on public.match_pair_scores
  for update
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id)
  with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Users can delete match_pair_scores they are part of"
  on public.match_pair_scores
  for delete
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);
