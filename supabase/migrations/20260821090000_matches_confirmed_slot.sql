-- Pick-time confirmation (CLAUDE.md §4, 2026-08-21): the invitee picks ONE of
-- the inviter's 3 proposed time-slot labels when accepting — this is that
-- final choice. Free-text label (matches the existing slot-label system,
-- e.g. "Saturday afternoon"), NOT a real timestamp — `meeting_at` stays
-- unused until slots carry real dates, a separate/bigger change.
alter table public.matches
  add column if not exists confirmed_slot text;
