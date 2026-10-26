# V2 — Profile → Edit profile, Package 1 (2026-10-27, D105)

Author: Claude Code. **LOCAL (tempa-local) only**; not pushed, not merged, not deployed; nothing on the shared project.

## What an approved member can now change

From Profile → **Edit profile**.

| Detail | Visibility | Rule |
|---|---|---|
| **Looking for** | Public | Old three options: long-term, casual, not sure. Optional; "Don't show this on my profile" clears it. The old value is loaded. Never derived from the private D104b answers. |
| **Height** | Public | Required, 90–250 cm. |
| **Work status** | Public | Optional. The job title is kept; the profile shows the job title when there is one, otherwise the work status — the same rule as onboarding and `buildPublicProfileBlocks`. |
| **Lifestyle** (smoking, drinking, pets, activity) | Public | All required. Pet kind is required with "I have pets"; any other pets answer clears the old kind. |
| **First dates** (1–2 types, days, time) | Public | Required. The favorite spot is not edited here. |

**Edit profile list:**
- Every detail is shown with its real visibility: Public = in `get_profile_v2`.
- Gender and Interested in are marked **Private**, are not shown and stay locked.
- Locked rows say "This detail can't be changed yet"; there is no support link.
- **Photos** and **Interests & conversation starters** open the existing editors. These shortcuts moved off the Profile tab, which keeps **View profile**.

**Not in this package:**
- free text (job title, favorite spot, prompts, school, hometown) and values;
- private preferences;
- adding, deleting or replacing photos;
- identity and matching fields;
- the onboarding "Looking for" card.

## Behaviour

Same as Photos and Interests:
- The draft stays local until **Save**. Save sends only the changed fields plus the values the screen loaded.
- "Saved" appears only after the server confirms. A failure keeps the draft for a retry.
- A change made elsewhere → "Your profile changed on another screen or device" with **Reload**. Reload asks first when the draft has unsaved changes.
- Leaving with unsaved changes asks "Discard changes?".
- The Edit profile list reloads on focus, so a saved value shows there at once. View profile reads `get_profile_v2` live.

## Server

`supabase/proposed/20261027090000_v2_member_profile_edit.sql` adds `update_member_profile_v2(p_changes, p_expected)`:
- **Caller:** active members only, via `v2_assert_member_profile_edit`. The general onboarding lock `v2_assert_editable` is unchanged.
- **Fields:** an allow-list of 11 fields; any other key → `field_not_editable`.
- **Validation:** runs on the merged final values; a stale pet kind is cleared.
- **Conflicts:** field-level `p_expected` check on a row locked with `for update`. A mismatch returns `profile_changed` and writes nothing.
- **Write:** one UPDATE.
- **Not touched:** account / review state, `profiles`, the job title, the favorite spot and the private answers.

Applied to tempa-local:
- local migration `00000000000030`, in one transaction;
- listed in `setup.mjs` (setup not run), not in `apply-dev.mjs`;
- backup `~/tempa-backups/2026-10-27-before-member-profile-edit/` (76 TABLE DATA);
- data fingerprints (incl. a hash of the edited onboarding fields) identical before and after.

`completeness` (`v2_missing_for`) is only used by `submit_application_v2`, so a member without "Looking for" keeps access. The smoke test checks this.

## Verified locally (not on a phone)

**`smoke_member_profile_edit_local.mjs` — 42/42**, real local services, fresh `tempa-local-mpe-*` accounts:
- **Looking for:** clear → not public, membership / discovery / daily picks still work; add → public; private intention ids refused.
- **Saved values:** height, work status (job title kept and still shown), pets with / without kind (stale kind cleared), lifestyle and first dates are saved and public.
- **Reopen:** a fresh session reads the values; the favorite spot is unchanged.
- **Refused, row unchanged (14 cases):**
  - locked fields: first name, job title, favorite spot, gender;
  - invalid values: height 300, 170.5 and text, cleared smoking, 0 / 3 / duplicate date types, unknown time;
  - malformed requests: mismatched expected keys, empty change.
- **Conflicts:**
  - a stale expected value → `profile_changed`, nothing written;
  - an unrelated interests save → no conflict;
  - two simultaneous saves → one wins, the other gets `profile_changed`.
- **Permissions:**
  - draft, submitted and suspended accounts are refused;
  - the general onboarding lock still refuses a submitted applicant;
  - a member changes only their own profile;
  - signed out → refused; the helper is not callable by apps.
- **Unchanged:** application / verification / membership / review fields; the private version-3 answers (not used for Looking for, not on the profile).

**`v2_member_profile_edit` — 35/35:**
- pure logic: mapping, changed fields + expected values, pet-kind clearing, validity, summaries, error copy;
- static wiring and SQL shape. These only show the code is wired; they are **not** UI behaviour tests.

**Regression:**
- `run.js` all 23 suites pass (the `v2_member_photos` entry check now follows Photos into Edit profile);
- `p0-checks` 28 · 12 · 14 · 21; `smoke_takes_local` 25/25; `smoke_shared_local` 13/13;
- `tsc` clean; LOCAL iOS `expo export` exit 0 (new screen strings in the bundle, the old Profile caption absent).
- `smoke_member_photos_local` was **not** run: it rewrites the phone pointer `.test-backend/member-photos.json`. The photo package was not changed.

## Waiting for the phone

Not verified, because they are interactions:
- taps on the list and the editors;
- the Discard / Reload prompts;
- the height ruler;
- the pet-kind row appearing;
- the layout at 393×852.

Account: `tempa-local-mphoto-mvik8slv-m@tempa-test.example.com` (approved member; checked read-only).
