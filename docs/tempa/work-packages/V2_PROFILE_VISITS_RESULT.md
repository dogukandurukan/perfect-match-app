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
- **Notice:** before the visitor's first recorded visit, the server answers `notice_required`. The app shows a small inline area under the header (since 2026-10-23, see below; it was a system alert with "Go back" / "OK"):
  - text: "People whose profiles you visit can see you in their profile visitors."
  - **Got it:** acknowledges (`account_state_v2.visits_notice_ack_at`), then records.
  - **Close (×) or going back:** records nothing, saves no acknowledgement; the next eligible profile open shows it again.
- **Activity:** a small "Profile visits" row above the like cards ("No visits yet" / "N people"), which opens `app/v2/profile-visits.tsx`.
  - **Premium:** rows with photo, name, age, label and time; a tap opens their profile. That opening is itself a visit, after the notice.
  - **Non-premium:** "N people visited your profile" + "See who visited" → `/premium` (follows the D84 likes rule — **a proposal and the current implementation, not a final owner decision**; see D103).
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

## Phone result (2026-10-23, owner, at `c572da5` — the old alert notice)

Confirmed by the owner on the phone, tempa-local:
- As **Pars** (P): Activity → Hale's profile opened.
- The "Profile visits are visible" notice appeared on the first open; after OK, the second open showed no notice.
- As **Hale** (H): Activity showed **2 visitors**, Pars and Vedat.
  - Pars = the real phone visit.
  - Vedat = the synthetic repeat-visit row left by the smoke test (expected).

**Not confirmed on the phone (open):**
- The exact labels under Pars / Vedat ("Viewed your profile" / "Visited again").
- That a visit doesn't change the like badge.
- A real repeat visit after waiting 24 h.
- That nothing is recorded before the notice is acknowledged, and backing out without acknowledging.
- The new "Got it" notice (below) — not seen on a phone at all.

The 25/25 service smoke (above) is a local test on real services, separate from this phone result.

## Notice simplified (2026-10-23, owner-approved change)

- The system alert ("Profile visits are visible" + Go back / OK) became a small inline area under the header on the three profile screens (`components/visits/VisitsNotice.tsx`): one line of text, one primary **Got it**, a small close icon.
- Logic moved to a pure flow, `createVisitFlow` in `lib/visits/visitsCore.ts`; `hooks/useProfileVisit.ts` now returns `{ recordVisit, notice }`.
  - The visit is recorded only after the profile fully loaded (unchanged call sites) and only after "Got it" succeeded.
  - Close / back: no visit, no acknowledgement → shown again on the next eligible open.
  - A failed acknowledgement keeps the notice ("Couldn’t save that. Try again."), records nothing; a double tap acknowledges once.
- Server unchanged (no new package). Accounts that already acknowledged are not reset (Pars keeps his acknowledgement, so on his phone the notice won't show again — a fresh visitor is needed to see it).
- Premium visitor identities: **unchanged, still a proposal** (D103).

**Local tests (not a phone test):**
- `v2_profile_visits.check.js` 37/37 — incl. the flow with stubbed server calls: first open → notice, nothing recorded; close → no visit / no ack; reopen → notice again; Got it → ack then record (call order `record, ack, record`); once per person per screen; already acknowledged → no notice; failed ack; double tap.
- New `scripts/local-backend/smoke_visit_notice_local.mjs` on real local services (fresh synthetic accounts, doesn't touch `.test-backend/`), **8/8**: open before Got it → `notice_required`, no row, no ack; reopen → asks again; ack alone records nothing; then recorded; ack time kept on a second ack; after ack an ineligible profile and the own profile are still not recorded.
- `run.js` all 22 suites pass; `p0-checks` 28 · 12 · 14 · 21; `tsc` clean; iOS `expo export` exit 0 (new copy in the bundle, old title absent).

## Phone test

Accounts are in `.test-backend/profile-visits.json`: visitor `P` (premium, has a like from host `H`) and host `H` (premium).

1. As **P**, open Activity, then H's card. Expect the visits notice (done 2026-10-23 with the old alert; P has acknowledged, so P won't see the new "Got it" area again — it needs a visitor who hasn't acknowledged yet).
2. Close the profile and open it again. No new notice.
3. Sign in as **H**, open Activity, then Profile visits. Expect P with "Viewed your profile · Just now". The like cards should be unchanged, and the badge should count no visit.
