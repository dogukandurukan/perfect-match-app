-- Profile settings, discovery prefs, notification toggles, soft delete

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_location boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS discovery_age_min int NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS discovery_age_max int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS discovery_max_distance text NOT NULL DEFAULT 'whole_city',
  ADD COLUMN IF NOT EXISTS notify_new_match boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_meeting_invite boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_discovery_age_range_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_discovery_age_range_check
  CHECK (discovery_age_min >= 18 AND discovery_age_max <= 60 AND discovery_age_min <= discovery_age_max);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_discovery_max_distance_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_discovery_max_distance_check
  CHECK (discovery_max_distance IN ('same_neighborhood', 'same_district', 'whole_city'));
