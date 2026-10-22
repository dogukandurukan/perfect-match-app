# V2 Activity — profile visits (2026-10-22, D103)

Author: Claude Code. **LOCAL (tempa-local) only**; no merge, no deploy, nothing on the shared project. Branding worktree not touched.

## What it does

- **What counts as a visit:** another member's full profile loaded successfully, opened from Activity → profile, Matches → profile, or chat → profile.
  - The app records the visit only after the profile's ready state (`PublicProfileView.onLoaded`, `activity-profile` / `match-profile` after `setLoad('ready')`).
  - Not recorded: Discover cards (the card stream itself), preloading, failed loads, the own profile, `app/dev` design previews.
- **One row per person** (`profile_visits_v2`, PK visitor + visited).
  - Within **24 h** of the last counted visit, a reopen changes nothing (server `within_window`). The client also records at most once per person per screen.
  - After 24 h, it counts again and reads **"Visited again"**. The first one reads **"Viewed your profile"**.
  - The exact number is never returned.
  - The window is one named constant: `v2_profile_visit_window()` (redefine it to change).
- **Notice:** before the visitor's first recorded visit, the server answers `notice_required`. The app then asks "Profile visits are visible …":
  - **Go back:** records nothing.
  - **OK:** acknowledges (`account_state_v2.visits_notice_ack_at`), then records.
- **Activity:** a small "Profile visits" row above the like cards ("No visits yet" / "N people"), which opens `app/v2/profile-visits.tsx`.
  - **Premium:** rows with photo, name, age, label and time; a tap opens their profile. That opening is itself a visit, after the notice.
  - **Non-premium:** "N people visited your profile" + "See who visited" → `/premium` (the D84 rule, owner's choice).
  - An info line says visits are visible both ways; there is an empty state.
- **Excluded from the list:** blocked, deleted, suspended or no-longer-visible people (`v2_can_view_public_profile`).
- **Not a like, match or notification; not in the Activity badge** (the badge still counts only likes).
- **No history back-fill:** 0 rows at apply time.

## Server package

`supabase/proposed/20261022090000_v2_profile_visits.sql`:
- table `profile_visits_v2` (RLS on, no policies, revoked from anon / authenticated);
- `account_state_v2.visits_notice_ack_at`;
- `v2_profile_visit_window()`;
- `ack_profile_visits_notice_v2()`;
- `record_profile_visit_v2(p_user)`: the visitor is always `auth.uid()`;
- `get_my_profile_visits_v2()`: only my visitors; identities premium-only.

Grants go to authenticated only.

**Applied to tempa-local:**
- local migration `00000000000026`;
- added to `setup.mjs`, not `apply-dev.mjs`;
- backup at `~/tempa-backups/2026-10-22-before-profile-visits/` (`pg_dump -Fc`, `pg_restore --list` OK);
- data fingerprint before and after: identical.

## Files

**New:**
- `lib/visits/visitsCore.ts`, `lib/visits/visits.ts`
- `hooks/useProfileVisit.ts`
- `app/v2/profile-visits.tsx`
- `scripts/local-backend/smoke_profile_visits_local.mjs`
- `scripts/onboarding-v2-checks/v2_profile_visits.check.js`

**Changed:**
- `components/onboarding-v2/PublicProfileView.tsx` (optional `onLoaded`)
- `app/v2/profile.tsx`, `app/v2/activity-profile.tsx`, `app/v2/match-profile.tsx`
- `components/activity/V2ActivityScreen.tsx`
- `scripts/local-backend/setup.mjs`
- `docs/tempa/DECISIONS.md` (D103)

## Verified (code / tests, not on a phone)

- `smoke_profile_visits_local.mjs` on real local services, **25/25**:
  - notice required first;
  - first visit;
  - 3 parallel repeats within 24 h → unchanged;
  - a non-premium host sees the count only; a premium host sees the person;
  - no count field per person;
  - after 24 h (test setup moves the last visit back) → "Visited again", still one row;
  - own profile, an ineligible pair and a draft applicant → not recorded;
  - no like, match or notification; Activity likes 0;
  - another member can't read the visits; the table can't be read or written directly; signed out → refused;
  - block → not listed and can't record;
  - a deleted visitor → not listed.
- `run.js`: all suites pass, incl. `v2_profile_visits` 24/24. `p0-checks` 28 · 12 · 14 · 21. `tsc` clean. LOCAL iOS `expo export` exit 0.

## Not seen yet

- The notice, the Activity entry and the visits screen on the phone.

## Phone test

Accounts are in `.test-backend/profile-visits.json`: visitor `P` (premium, has a like from host `H`) and host `H` (premium).

1. As **P**, open Activity, then H's card. Expect the "Profile visits are visible" notice. Tap OK.
2. Close the profile and open it again. No new notice.
3. Sign in as **H**, open Activity, then Profile visits. Expect P with "Viewed your profile · Just now". The like cards should be unchanged, and the badge should count no visit.
