-- Advanced filters tab was too empty (user feedback, 2026-09-10, Bumble
-- reference screenshots) — these are the two REAL, easy-to-back additions:
-- verified-only and non-smokers-only, both backed by existing profile data
-- (photo_verified, smoking) rather than fields we don't actually collect
-- (height, family plans — Bumble has these, we don't, so they're skipped
-- rather than faked).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_verified_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_nonsmokers_only boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
