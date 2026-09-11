-- "Active today" filter (user request, 2026-09-11) — real, common dating-
-- app filter category (Tinder/Bumble/Hinge all have "Recently Active"),
-- unlike hair/eye color which was declined (redundant with photos, purely
-- aesthetic). profiles.last_active_at is a lightweight heartbeat the app
-- writes on open (app/_layout.tsx's LocationBridge, once per session) —
-- there's no existing "last seen" signal in `profiles` to reuse (auth.users.
-- last_sign_in_at isn't reachable from get_top_matches, which runs as the
-- calling user, not SECURITY DEFINER).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_active_today boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
