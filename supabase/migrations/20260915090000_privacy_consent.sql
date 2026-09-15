-- KVKK consent tracking (2026-09-15) — records when a user accepted the
-- privacy notice, so there's a provable record (KVKK's burden-of-proof
-- expectation on the data controller). Written once at registration by
-- register.tsx, before any other profile data is collected.
alter table public.profiles
  add column if not exists privacy_consent_at timestamptz;

NOTIFY pgrst, 'reload schema';
