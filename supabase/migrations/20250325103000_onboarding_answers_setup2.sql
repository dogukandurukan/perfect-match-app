create table if not exists public.onboarding_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  intent text,
  sub_intent text,
  friendship_type text,
  shared_interests_importance text,
  social_preference text,
  casualness_expectation text,
  exclusivity_view text,
  marriage_view text,
  children_view text,
  living_preference text,
  life_priority text,
  commitment_view text,
  created_at timestamp with time zone default now()
);

alter table public.onboarding_answers
  add column if not exists updated_at timestamp with time zone default now();

create unique index if not exists onboarding_answers_user_id_key
  on public.onboarding_answers(user_id);
