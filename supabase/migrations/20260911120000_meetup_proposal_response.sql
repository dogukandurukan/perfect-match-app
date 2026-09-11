-- Chat "Suggest a meetup" proposals were write-only: they set matches.meeting_at/
-- confirmed_place but never told the other person anything actionable — the
-- proposer had no way to know if the other side even saw it. This adds a
-- pending/confirmed response cycle so the receiver gets Yes/No/Suggest-another
-- buttons, and the proposer can see whether it was answered.
alter table matches
  add column if not exists meetup_proposed_by uuid references profiles(id),
  add column if not exists meetup_confirmed boolean;

comment on column matches.meetup_proposed_by is
  'Who proposed the current meeting_at/confirmed_place via chat.tsx propose-a-meetup flow. Null when there is no active proposal.';
comment on column matches.meetup_confirmed is
  'null = proposal awaiting response; true = other side said yes. A "no"/"suggest another time" response clears meeting_at/confirmed_place/meetup_proposed_by/meetup_confirmed back to null rather than setting this false.';

NOTIFY pgrst, 'reload schema';
