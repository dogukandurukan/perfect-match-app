-- Fix (2026-09-01): `reports` was a write-only table — nothing ever read it,
-- no moderation action ever followed a report. No admin panel exists (solo
-- dev, small beta), so instead of building one: after 3 DISTINCT reporters
-- report the same person, auto-hide their profile (is_hidden = true). Counts
-- distinct reporter_id, not raw report rows, so one person can't force a
-- hide by reporting the same target repeatedly. is_hidden already removes a
-- profile from new discovery (get_top_matches) via profiles RLS while
-- leaving existing chats/matches untouched (2026-08-29 fix) — same effect
-- here, just triggered automatically instead of manually.
create or replace function public.auto_hide_after_reports()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_distinct_reporters int;
begin
  select count(distinct reporter_id) into v_distinct_reporters
  from reports
  where reported_id = new.reported_id;

  if v_distinct_reporters >= 3 then
    update profiles set is_hidden = true where id = new.reported_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_hide_after_reports on public.reports;
create trigger trg_auto_hide_after_reports
after insert on public.reports
for each row
execute function public.auto_hide_after_reports();
