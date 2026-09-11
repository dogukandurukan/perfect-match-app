-- Lightweight product-analytics event log. Zero events exist yet (0 real
-- users) — this is being added NOW so the very first real cohort's funnel
-- behavior isn't lost, per business-strategist market analysis (2026-09-11):
-- funnel/retention/meetup-rate numbers only exist from here forward.
--
-- Reads happen via Supabase Studio / a BI tool (Metabase) using the
-- service role, which bypasses RLS — there is deliberately no SELECT grant
-- for authenticated/anon, so the client can only ever write its own events,
-- never read anyone's (including its own logged history back).
create table if not exists events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_name_created on events (name, created_at desc);
create index if not exists idx_events_user_id on events (user_id);

alter table events enable row level security;

drop policy if exists events_insert_own on events;
create policy events_insert_own on events
  for insert
  with check (auth.uid() = user_id);

revoke all on events from anon, authenticated;
grant insert on events to authenticated;
