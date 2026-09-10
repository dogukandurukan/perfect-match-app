-- Height field (user request, 2026-09-10) — self-reported, NOT scored in
-- get_top_matches (deliberate: adding it to matching weights would be a
-- much bigger algorithm change than what was asked; it's filter-only, same
-- treatment as the verified/non-smokers toggles from the previous
-- migration). discovery_height_min/max are the filter preference (null =
-- no filter, same convention as discovery_verified_only defaulting off).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm integer;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_height_min integer;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_height_max integer;

NOTIFY pgrst, 'reload schema';
