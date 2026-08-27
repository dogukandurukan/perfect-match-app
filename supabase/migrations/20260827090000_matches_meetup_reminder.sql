-- Day-of meetup reminder push (CLAUDE.md §4, 2026-08-27). Tracks whether
-- today's reminder was already sent for a confirmed match, so the daily
-- pg_cron job doesn't re-send if it runs more than once or overlaps.
alter table public.matches
  add column if not exists meetup_reminder_sent_at timestamptz;
