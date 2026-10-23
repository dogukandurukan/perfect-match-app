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

---

# Revision (2026-10-23, D104a) — "How do you like to connect?", version 2

Author: Claude Code. **LOCAL (tempa-local) only**; no merge, no deploy, nothing on the shared project. Mockup (4 screens: invite → questions → summary → submit) built with the existing onboarding tokens and components; no global theme or branding change.

## Questions

Checked against the required onboarding (`lib/onboardingV2/compatibility.ts`, `yourDates.ts`, `yourLife.ts`). Two owner questions repeat a required question and are **not** included:

| Owner question | Required question it repeats |
|---|---|
| "When there’s mutual interest, before meeting in person I prefer…" | Compatibility "When would you like to meet?" (Soon / After some chatting / When I feel ready) |
| "When getting to know someone, I prefer…" | Compatibility "How often do you like to text?" |

Included (version 2, new stable ids; version-1 ids are not reused):

| Question (`id`) | Option (`key`) → summary sentence |
|---|---|
| When planning a first date, I like… (`plan_first_date`) | Deciding together (`decide_together`) → "You like deciding on a first date together." · Having a few options to choose from (`few_options`) → "You like having a few options to choose from." · Making the first suggestion (`suggest_first`) → "You like making the first suggestion." · Any of these works for me (`any`) → "Any way of planning a first date works for you." |
| On a first date, I feel more comfortable with… (`first_date_comfort`) | Something short and casual (`short_casual`) → "Something short and casual feels most comfortable to you." · A quiet place where we can talk (`quiet_place`) → "A quiet place where you can talk feels most comfortable to you." · A small activity together (`small_activity`) → "A small activity together feels most comfortable to you." · Having chatted a little beforehand (`chatted_before`) → "You feel more comfortable having chatted a little beforehand." |

## Flow (same integration point: the live first-submit screen, draft only)

1. **Invite** "How do you like to connect?" / "A few optional questions to put your dating preferences into words." + summary card + "Private: your answers aren’t shown on your profile and aren’t used for matching." **Explore** / **Skip for now**.
2. **Questions** — header progress "Optional questions · N of 2" (real count). A choice does not advance. **Continue** saves, then advances; disabled without a choice; "Saving…" while saving. **Skip question** (secondary) keeps an already saved answer. **Skip remaining questions** ends the section with saved answers kept. **Clear answer** (only when saved) removes it. Back edits. A failed save stays on the question: "Couldn’t save your answer. Check your connection and try again."; Continue retries; nothing is shown as saved.
3. **Summary** "Your dating preferences" — one fixed sentence per answered question; skipped when nothing is answered. **Continue** → submit screen (never submits) · **Edit answers** → question 1.
4. **Submit screen** — card "Your dating preferences · Private · Saved · View" only when answers are saved on the server; View opens the summary, back returns. **Submit application** is the only submit.

## Turning it off

`CONNECTION_ENABLED = false` in `lib/onboardingV2/connection.ts` → no invite, questions, summary or card; the normal submit screen shows directly. Saved answers are not deleted. (Also hidden, as before, when the server lacks the package or the application is not a draft.)

## Server package

`supabase/proposed/20261023090000_v2_connection_answers_versions.sql`: primary key `(user_id, version)` (answers kept per version); catalog version 2 added, version 1 kept; save upserts per version; `get_my_connection_answers_v2(p_version default 1)` reads one version. Rules unchanged (private, RPCs only, draft only, not used by matching / profile / completeness / acceptance).

Applied to tempa-local as local migration `00000000000028` (psql in one transaction; listed in `setup.mjs`, not `apply-dev.mjs`; setup was **not** run). Backup `~/tempa-backups/2026-10-23-before-connection-versions/` (`pg_dump -Fc`, 76 TABLE DATA). Data fingerprint before / after: identical.

## Verified locally (not on a phone)

- `v2_connection_questions` **48/48**: ids/copy, no test/type/call wording, summary mapping, stages (partial → summary, all skipped → submit), save stub (partial, edit, failed save keeps confirmed answers, retry, clear), wiring (setting gate, Continue disabled, pick doesn’t save/advance, Skip question keeps answer, Skip remaining, summary never submits), SQL shape.
- `smoke_connection_answers_local.mjs` on real local services **29/29** (fresh `tempa-local-connv2-*` accounts): partial, edit, clear, all skipped, reload persistence, version-1 answers kept and separate, old no-version call still reads v1, refused writes leave both versions unchanged, isolation / anon, submit with partial and with no answers, submitted = locked, completeness unchanged, member not asked, public profile without answers.
- `run.js` all 22 suites pass; `p0-checks` 28 · 12 · 14 · 21; `tsc` clean; LOCAL iOS `expo export` exit 0 (new copy in the bundle, version-1 copy absent).

## Phone test (not done yet)

Account: `tempa-local-connect-mvk0pgkx-a@tempa-test.example.com` — draft, every section filled, 3 photos, **version-1 answers only** (all four), no version-2 answers. Checked read-only; nothing changed. The previous phone account (`…-p`) is **submitted** and was left as it is.
