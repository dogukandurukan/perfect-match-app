-- Two more Advanced filters (user request, 2026-09-11) — same pattern as
-- zodiac/pets: education and religion are already collected in onboarding
-- (EDUCATION_OPTIONS/RELIGION_OPTIONS, lib/onboardingStep3Context.tsx), no
-- new onboarding screens needed. education already contributes a soft
-- scoring bonus (education_score, +8 for exact match) — this filter is a
-- separate, independent hard-filter layer on top, doesn't touch scoring.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_education text[];
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_religion text[];

NOTIFY pgrst, 'reload schema';
