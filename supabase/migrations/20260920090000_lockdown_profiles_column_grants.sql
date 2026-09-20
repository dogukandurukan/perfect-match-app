-- Phase 0 security fix (2026-09-20, docs/phase-0-security-report.md).
--
-- Found during Onboarding V2 gap analysis: `authenticated` had Supabase's
-- default blanket table-level UPDATE grant on `profiles`, and the only
-- UPDATE RLS policy was `USING (auth.uid() = id)` with NO `WITH CHECK` and
-- no column restriction. Confirmed exploitable before this migration:
--   select has_column_privilege('authenticated','public.profiles','photo_verified','UPDATE'); -- true
--   select has_column_privilege('authenticated','public.profiles','is_premium','UPDATE');      -- true
-- Any signed-in user could PATCH their own row via
-- `/rest/v1/profiles?id=eq.<self>` and set `photo_verified`/`is_premium`/
-- `waitlist_number`/`waitlist_boost` to anything, bypassing manual photo
-- review, the premium gate, and waitlist ordering entirely.
--
-- Fix: revoke the blanket grant, re-grant UPDATE only on the exact columns
-- real client code writes today (every `.from('profiles').update/upsert(...)`
-- call site was grepped across app/ + lib/ — see the report for the full
-- list of files and the columns each one writes). Anything NOT in this
-- list — including every future server-controlled field — is safe by
-- default: a client attempt to write it fails with 42501 instead of
-- silently succeeding. To let a NEW legitimate feature write a NEW column
-- later, add that column to the GRANT list below in its own migration;
-- never re-grant blanket UPDATE.
--
-- `daily_views_count`/`daily_views_reset_at` are included even though they
-- are meant to be RPC-gated (`increment_daily_views`) — `lib/dailyViews.ts`
-- has a pre-existing direct client-side reset path for them (found during
-- this same audit) that would otherwise break. This is a known, reported,
-- NOT-fixed-in-this-phase gap — see the report's "Bulunan ama Faz 0
-- dışında bırakılan" section. Excluding them here would be a silent
-- behavior change beyond what was asked for this phase.
--
-- `id` stays in the grant list only because supabase-js's
-- `.upsert(row, {onConflict:'id'})` (used throughout onboarding) issues an
-- `ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, ...` that includes the
-- conflict key itself in the SET list — omitting it would break every
-- onboarding upsert with 42501. The new `WITH CHECK (auth.uid() = id)`
-- below makes sure the value can never actually change to anything other
-- than the caller's own uid, regardless of what a client sends.

begin;

revoke update on public.profiles from authenticated;

grant update (
  -- identity — value is immutable in practice, see WITH CHECK below
  id,

  -- step1 (phone/photos/name/instagram/birthdate/location/gender/languages)
  first_name, last_name, full_address, city, district, discovery_max_distance,
  lat, lng, gender, meeting_preferences, languages, date_of_birth, zodiac_sign,
  photos, phone_number, dial_code, country_code, instagram_handle,
  verification_selfie_path, current_step,

  -- step3 (lifestyle)
  morning_night, recharge_style, hobbies, drinking, smoking, education,
  education_detail, occupation, height_cm, pets,

  -- step4 + profile-edit
  availability_days, availability_hours, meeting_environment, favorite_spots,
  preferred_locations, first_date_expectation, bio, setup_completed,
  favorite_music, favorite_movie, favorite_book, favorite_activity,
  core_value, impressed_by, dealbreaker,

  -- filters.tsx / settings.tsx (lib/profileSettings.ts's ProfileSettingsRow)
  discovery_age_min, discovery_age_max, notify_new_match, notify_messages,
  notify_meeting_invite, is_hidden, hide_location, discovery_verified_only,
  discovery_nonsmokers_only, discovery_height_min, discovery_height_max,
  discovery_zodiac_signs, discovery_pets, discovery_education,
  discovery_active_today,

  -- misc app features (push token, chat icebreaker, KVKK consent, heartbeat)
  expo_push_token, quick_icebreaker_answers, privacy_consent_at, last_active_at,

  -- pre-existing gap, kept working as-is this phase — see docstring above
  daily_views_count, daily_views_reset_at
) on public.profiles to authenticated;

-- Explicitly NOT granted to authenticated (server/reviewer-controlled):
--   photo_verified, is_premium, waitlist_number, waitlist_boost,
--   daily_invites_count, daily_invites_reset_at (RPC-only already, see
--   try_send_invite — never had a direct client write to begin with),
--   is_hidden is granted above (user-controlled "hide my profile" toggle,
--   distinct from the reviewer-controlled fields), deleted_at, created_at,
--   updated_at (trigger-managed), setup1_completed, username, vibe,
--   neighborhoods (all currently unwritten by any client code — grepped,
--   zero call sites — excluded rather than guessed at).

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

commit;
