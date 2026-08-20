-- Counter-proposal for place, mirroring confirmed_slot (2026-08-21): the
-- invitee can suggest a different venue than the inviter's single proposed
-- place. Null means "the originally proposed place stands".
alter table public.matches
  add column if not exists confirmed_place text;
