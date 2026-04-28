-- Run in Supabase SQL Editor or via CLI migrate.
-- Tracks onboarding progress and excludes incomplete profiles from matching.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false;

-- Backfill: users who already finished Setup-4 in `preferences` (if table/column exist)
DO $migrate$
BEGIN
  IF to_regclass('public.preferences') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'preferences'
        AND column_name = 'setup4_completed'
    ) THEN
      UPDATE public.profiles p
      SET current_step = 4, setup_completed = true
      FROM public.preferences pr
      WHERE pr.user_id = p.id
        AND pr.setup4_completed = true;
    END IF;
  END IF;
END
$migrate$;
