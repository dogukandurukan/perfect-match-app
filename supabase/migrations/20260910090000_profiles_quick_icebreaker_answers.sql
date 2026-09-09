-- Persists the quick this-or-that icebreaker answers so a user only ever
-- fills it out once, instead of re-answering the same 5 questions for
-- every new empty chat (user feedback, 2026-09-10). NULL = never answered.
-- Shape: jsonb array of {"id": questionId, "choice": "A"|"B"}.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quick_icebreaker_answers jsonb;
