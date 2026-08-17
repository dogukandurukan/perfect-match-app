-- Premium stub (no real payment system yet). Backs Buzz Faz B "who liked you" unlock gate
-- and future premium-gated features. Default false so all existing rows stay non-premium.
alter table public.profiles
  add column if not exists is_premium boolean not null default false;
