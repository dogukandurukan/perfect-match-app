ALTER TABLE public.onboarding_answers
  ADD COLUMN IF NOT EXISTS friendship_value text,
  ADD COLUMN IF NOT EXISTS hangout_frequency text,
  ADD COLUMN IF NOT EXISTS connection_style text,
  ADD COLUMN IF NOT EXISTS relationship_pace text,
  ADD COLUMN IF NOT EXISTS excitement_factor text,
  ADD COLUMN IF NOT EXISTS connection_energy text;
