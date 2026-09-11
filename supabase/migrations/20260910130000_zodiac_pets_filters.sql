-- Two more Advanced filters (user request, 2026-09-10) — same "already
-- exists, currently unused" pattern as height: zodiac_sign is auto-
-- computed from date_of_birth for every user already (lib/zodiac.ts),
-- never used in scoring or filtering. pets turned out to be a genuinely
-- dead column (displayed if present, but NO onboarding/edit screen has
-- ever written to it) — adding a real input for it alongside the filter.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_zodiac_signs text[];
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_pets text[];

NOTIFY pgrst, 'reload schema';
