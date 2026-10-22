# V2 onboarding — "How do you connect?" (2026-10-22, D104, first draft)

Author: Claude Code. **LOCAL (tempa-local) only**; no merge, no deploy, nothing on the shared project. No new theme; branding worktree not touched.

## Integration point

`components/onboarding-v2/PreviewFlow.tsx`, the **live first-submit screen**: step `code`, email verified (`liveCode === 'verified'`), not an update (`!live.review`), not yet submitted (`!profile.applicationPreview`).
- The questions are an **interstitial inside that step**, not new numbered steps, so `PROFILE_STEP` and the server resume position are unchanged.
- When it ends (Skip for now, or the last question), the normal "Email verified" + **Submit application** screen shows.
- The header back moves between the stages; on the invite it works as before.
- **Shown only if** `get_my_connection_answers_v2` exists on the server and the application is still a **draft** (`can_edit`). Otherwise the flow is exactly as before (servers without the package, updates after "changes requested", approved members).

## Flow

1. **Invite:** "How do you connect?" / "A few optional questions about what feels right for you in a relationship." / private note. Buttons: **Explore** · **Skip for now**.
2. **Four questions** (owner copy, existing `OnboardingOptionCard`), each with the private note.
   - Primary button: **Continue**, or **Done** on the last one. Unanswered, it reads **Skip question**.
   - Secondary: **Skip for now** goes straight to submit.
3. **Saving:**
   - Each pick is saved immediately, in order: version 1 + `{question_id: option_id}`.
   - A failed save shows "Couldn’t save that answer. You can still continue." and never blocks.
   - On reopen, the saved answers are preselected. Nothing is stored on the device.

## Server package

`supabase/proposed/20261022120000_v2_connection_answers.sql`:
- table `connection_answers_v2` (user_id PK → profiles, cascade; version; answers jsonb; RLS on, no policies, revoked from anon / authenticated);
- `v2_connection_catalog(version)`: the fixed ids;
- `save_connection_answers_v2(p_version, p_answers)`:
  - `v2_assert_editable()` + status `draft`;
  - version 1 only;
  - unknown question / option / non-string → `invalid_answers`;
  - partial and empty are allowed;
- `get_my_connection_answers_v2()` → `{version, answers, can_edit}`.

Untouched: `v2_missing_for`, `submit_application_v2`, `get_top_matches` and `get_profile_v2`.

**Applied to tempa-local:**
- local migration `00000000000027`;
- added to `setup.mjs`, not `apply-dev.mjs`;
- backup at `~/tempa-backups/2026-10-22-before-connection-answers/` (`pg_dump -Fc`, `pg_restore --list`: 75 TABLE DATA);
- data fingerprint before and after: identical.

## Changed onboarding files

- `components/onboarding-v2/PreviewFlow.tsx`: stage state, title / helper / footer / back overrides, content.
- **New:**
  - `components/onboarding-v2/yourProfile/ConnectionFields.tsx`
  - `lib/onboardingV2/connection.ts` (copy, ids, version, stages; pure)
  - `lib/onboardingV2/connectionRemote.ts`
- **Also:** `scripts/local-backend/setup.mjs`, `scripts/local-backend/smoke_connection_answers_local.mjs`, `scripts/onboarding-v2-checks/v2_connection_questions.check.js`, `docs/tempa/DECISIONS.md` (D104).

## Verified (code / tests, not on a phone)

- `smoke_connection_answers_local.mjs` on real local services, **22/22**:
  - empty start; partial saves; a fresh session reads them with the version; the empty set is valid;
  - wrong ids, value types, shapes and versions → refused, data unchanged;
  - another account reads only its own; the table can't be read or written directly; signed out → refused;
  - submit with partial answers and with none → submitted; afterwards the answers are kept and locked;
  - D93 unchanged (1 prompt + 4 answers is still incomplete);
  - approved member can't save; the public profile doesn't contain the answers.
- `run.js`: all 22 suites pass, incl. `v2_connection_questions` 25/25:
  - copy;
  - stable ids;
  - no test / type / compatibility wording;
  - shown only on the first-submit screen;
  - skippable;
  - no new step;
  - only the onboarding flow uses the answers;
  - no other server package reads them.
- `p0-checks` 28 · 12 · 14 · 21. `tsc` clean. LOCAL iOS `expo export` exit 0; the strings are in the bundle.

## Not seen yet

All screens; nothing has been looked at on a phone.

## Phone test

Account: `.test-backend/connection.json` (`draft`, every section filled, no answers).

1. Sign in with the email code. Go to the end, to the submit screen. Expect "How do you connect?". Tap Explore.
2. Answer question 1. Skip question 2. Kill the app and reopen it, then get back to the submit screen. Expect the invite again; Explore should show question 1 preselected.
3. Tap Skip for now. Expect "Email verified" + Submit application. Submit; it should succeed.
