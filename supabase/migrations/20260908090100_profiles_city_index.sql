CREATE INDEX IF NOT EXISTS idx_profiles_city_norm
  ON public.profiles (lower(trim(city)))
  WHERE setup_completed = true;
