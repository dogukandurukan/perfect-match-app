# V2 onboarding — real auth, persistence and application (result)

Date 2026-09-30 · Branch `tempa/v2-persist` (from `tempa/p0-privacy-r3` `185c8ce`) · Author: Claude Code.

**Nothing applied anywhere:** no live migration, no key or bucket change, no data deleted, no merge. The separate test project **does not exist yet**. So every test below ran on the local live-schema replica. The real Auth/DB/Storage run (`scripts/test-backend/smoke_v2.mjs`) is ready but **not run** (§4).

Owner decision this round: **Section 1 uses an email code** (Supabase email OTP). Phone OTP waits for the SMS-provider decision.

## 1. What was built

| Area | Done | Where |
|---|---|---|
| Schema (fresh, current V2 code keys; archived Revision 2 SQL **not** used) | owner-only draft (all V2 answers), prompt catalog (the 20 local ids), prompts, photos, account state; every write via a validating SECURITY DEFINER RPC; no client DML on these tables | `supabase/proposed/20260930120000_v2_onboarding_persistence.sql` |
| Sign-in | email code: enter email → code → verified session (user created on first sign-in); required KVKK consent before any code is sent, stored as `privacy_consent_at` | `app/v2/welcome.tsx` |
| Answers + resume | every Continue saves that section; on failure the user stays on the step with an error; the resume position is stored server-side (clamped; never resumes on "received" without a submission) | `components/onboarding-v2/PreviewFlow.tsx` (`live` mode), `lib/onboardingV2/remote.ts`, `serverMapping.ts` |
| Photos | upload to the private bucket, register, reorder (atomic full list), delete (+ object removal); a failed upload is never counted; each success is recorded, so a retry resumes | `remote.ts` `syncPhotos`, RPCs `add/reorder/delete_profile_photo_v2` |
| Private selfie | uploaded to `verification-selfies` (clients can write, never read); only its path is stored server-side; clients learn only "has selfie" | `uploadSelfie`, `set_verification_selfie_v2` |
| Real verification | the email is verified by the code sign-in (Auth `email_confirmed_at`); the selfie review is a **server-side reviewer action** (`review_application_v2`, service role only) | SQL §4 |
| Submission | idempotent and race-safe (row lock + per-user state); repeated taps or a retry after a dropped connection return the **same** submission; missing items are returned instead of submitting; answers/photos lock after submission | `submit_application_v2` |
| "You're on the list!" | shown **only** after the server returned `submitted` | `PreviewFlow` `submitLive` |
| Gate | server state (`get_my_access_v2`): pending → status screen (no Home); draft → V2 flow; accepted + verified + active → Home; existing V1 accounts → unchanged; backend without the migration → unchanged V1 behaviour | `app/(tabs)/index.tsx`, `app/v2/status.tsx`, `app/v2/onboarding.tsx` |
| Client can't change approval | no grant on `account_state_v2`; reviewer RPC not executable by clients; a pending applicant cannot self-set `profiles.setup_completed` (V1 Home gate); pending applicants are invisible to others and get no discovery | SQL §2–§4 |
| Existing accounts protected | a V1 member is never turned into a V2 applicant (`legacy_account`), keeps its gate and discovery | tested |
| Entry | the V2 live entry is shown only in DEV builds **and** only against the TEST backend. V1 Log In / Sign Up stay the default until V2 is validated (§5) | `app/(tabs)/index.tsx` |
| R2 | the accepted onboarding screens are reused unchanged; the DEV preview (no `live` prop) behaves exactly as before — R2 checks 56/56 | — |

## 2. Tests (local)

| Suite | Result |
|---|---|
| `supabase/proposed/tests/http_v2.test.mjs` — V2 flow over PostgREST on the replica, asserting **stored rows** | **98 / 98** (4 consecutive runs) |
| `http_p0.test.mjs` (P0, re-run after hardening) | 325 / 325 |
| `scripts/p0-checks/v2_mapping.check.mjs` (every answer survives save → reload) | 21 / 21 |
| photo URL cache · backend selection | 14 / 14 · 14 / 14 |
| onboarding V2 checks (R2 unchanged) | 45/45 · 69/69 · 56/56 |
| `npx tsc --noEmit` | clean |

Test-harness notes (honest):
- On the local bridge (pglite-socket), an error raised inside an RPC comes back as a generic 503. PGlite is also a single session shared with PostgREST.
- So **RPC rejections are asserted in SQL as the same role + user** (what PostgREST executes), with the exact error text. Successful calls go over HTTP. The harness waits until no other transaction is open before each direct SQL statement.
- Earlier P0 RPC-rejection checks only asserted "not ok". They now assert the exact error.

<details><summary>Per-check list (V2 suite)</summary>

<details><summary>ACCESS — 7/7</summary>

- ✅ anon cannot load a draft (permission denied)
- ✅ anon cannot submit (permission denied)
- ✅ new user → gate onboarding
- ✅ existing V1 member → legacy_member (kept)
- ✅ accepted+verified+active → member
- ✅ V1 member is never turned into a V2 applicant (legacy_account)
- ✅ no V2 state row created for the V1 member

</details>

<details><summary>SAVE+RESUME — 26/26</summary>

- ✅ first load creates an empty draft
- ✅ save basics step 1
- ✅ save basics step 2 (partial)
- ✅ reopen: earlier answers kept (partial saves merge)
- ✅ reopen: resume position = next unfinished step
- ✅ DB row holds the saved values
- ✅ resume position can cross into the next section
- ✅ the same save re-sent after a dropped connection is harmless (idempotent)
- ✅ rejected: bad enum
- ✅ rejected: everyone mixed with others
- ✅ rejected: under 18
- ✅ rejected: unknown field
- ✅ rejected: field of another section
- ✅ rejected: 3 values
- ✅ rejected: pet kind without pets
- ✅ rejected: 11 interests
- ✅ rejected: bad taste item
- ✅ rejected: 4 taste items
- ✅ rejected: 3 date types
- ✅ rejected: unknown section
- ✅ save basics
- ✅ save compatibility
- ✅ save yourLife
- ✅ save yourWorld
- ✅ save yourDates
- ✅ changing pets away from "have pets" clears the kind

</details>

<details><summary>DIRECT WRITES — 6/6</summary>

- ✅ no direct UPDATE of the draft
- ✅ no direct INSERT
- ✅ client cannot change application status
- ✅ client cannot activate membership
- ✅ client cannot call the reviewer RPC (permission denied)
- ✅ pending applicant cannot self-unlock the V1 Home gate (DB unchanged)

</details>

<details><summary>PHOTOS — 23/23</summary>

- ✅ failed upload: nothing registered (photo_not_uploaded)
- ✅ failed upload leaves 0 photos
- ✅ upload 1 into own folder
- ✅ register photo 1 at position 1
- ✅ upload 2 into own folder
- ✅ register photo 2 at position 2
- ✅ upload 3 into own folder
- ✅ register photo 3 at position 3
- ✅ upload 4 into own folder
- ✅ register photo 4 at position 4
- ✅ upload 5 into own folder
- ✅ register photo 5 at position 5
- ✅ upload 6 into own folder
- ✅ register photo 6 at position 6
- ✅ registering the same upload twice (retry) does not duplicate
- ✅ 7th photo refused (too_many_photos)
- ✅ cannot upload into another user's folder
- ✅ reorder (atomic, full list)
- ✅ DB order matches the new order
- ✅ partial reorder list refused (photo_set_mismatch)
- ✅ delete returns the object path for storage clean-up
- ✅ positions compacted after delete
- ✅ owner deletes the storage object

</details>

<details><summary>PROMPTS — 4/4</summary>

- ✅ unknown prompt id refused (foreign key)
- ✅ same prompt twice refused (duplicate key)
- ✅ 201-char answer refused (check constraint)
- ✅ prompts saved; blank optional third ignored

</details>

<details><summary>SELFIE — 5/5</summary>

- ✅ selfie not uploaded → refused (selfie_not_uploaded)
- ✅ selfie uploaded to the private bucket (own folder)
- ✅ selfie path recorded server-side
- ✅ even the owner cannot read the selfie back
- ✅ client sees "has selfie", never the path

</details>

<details><summary>OTHER ACCOUNT — 10/10</summary>

- ✅ U2 cannot read U1's onboarding_v2
- ✅ U2 cannot read U1's profile_photos_v2
- ✅ U2 cannot read U1's profile_prompts_v2
- ✅ U2 cannot read U1's account_state_v2
- ✅ U2 cannot reorder U1's photos (photo_set_mismatch)
- ✅ U2 cannot delete U1's photo (photo_not_found)
- ✅ U2 cannot register U1's upload (not_your_photo)
- ✅ U2 cannot claim U1's selfie (not_your_selfie)
- ✅ U2 cannot sign U1's photos (pending applicant is not visible)
- ✅ pending applicant has no public card

</details>

<details><summary>SUBMIT — 13/13</summary>

- ✅ submit with unconfirmed email → not submitted, "missing" returned
- ✅ DB: still draft after refused submit
- ✅ no KVKK consent → not submitted
- ✅ consent recorded by the user (allowed column)
- ✅ 5 rapid taps all report submitted
- ✅ exactly one of them performed the submission
- ✅ DB: one row, submitted / pending / not a member
- ✅ retry after reconnect returns the same submission
- ✅ answers locked after submission (application_locked)
- ✅ photos locked after submission (application_locked)
- ✅ gate after submit: waiting (no Home)
- ✅ pending applicant gets no discovery
- ✅ incomplete applicant cannot submit

</details>

<details><summary>REVIEW — 3/3</summary>

- ✅ after reviewer acceptance: member
- ✅ V1 member discovery still works
- ✅ active V2 member can call discovery

</details>

<details><summary>SCHEMA — 1/1</summary>

- ✅ no key or live ref in the migration

</details>

</details>

## 3. Scoring and filters

See `docs/tempa/V2_SCORING_FILTER_REVIEW.md`. In short:
- **No V2 answer reaches scoring or eligibility today.** An activated V2 member would reach Home but not be discoverable (V1-label gender check, `setup_completed`).
- Several filters are broken today:
    - the age range is ignored;
    - "non-smokers only" lets "Socially" through and would pass everyone with V2 keys;
    - the frozen religion filter is still applied;
    - education and pets filters don't fit V2;
    - passes are not stored.
- No weights were invented. A mapping table marks what carries over directly and what needs an owner decision.

## 4. Remaining blockers

1. **Separate test project** — create it, then run in `~/tempa-p0`:
   ```
   node scripts/test-backend/apply.mjs base
   node scripts/test-backend/apply.mjs p0a
   node scripts/test-backend/apply.mjs v2
   node scripts/test-backend/smoke_v2.mjs
   ```
   `smoke_v2.mjs` exercises two synthetic accounts over real services:
   - real email-code verification (code from the admin API; no mail sent);
   - saves, reconnect, re-login + resume;
   - real uploads, a failed upload, reorder, delete;
   - private selfie;
   - cross-account denials;
   - offline submit, 5 rapid taps.

   It writes the stored rows to `.test-backend/evidence-v2-<run>.json`.
2. **Email code on the phone:** the test project's Auth "Magic Link" email template must contain `{{ .Token }}` (otherwise the email carries only a link). The built-in mailer is heavily rate-limited, so use a custom SMTP or few attempts for phone tests.
3. **Discovery for V2 members (WP3/WP4):** a projection into `profiles` or `get_top_matches_v2` with approved weights (§3). Until then, "member → Home" works, but the member is not discoverable.
4. **Owner decisions:**
   - server height range: proposed 90–250 cm (the UI accepts 1–999);
   - intent partial credit for `figuring_out`;
   - V2 weights and filters;
   - the consent-screen placement (Q5; implemented on the email step);
   - selfie retention (KVKK).
5. **Not yet on a device:**
   - photo sync at Continue;
   - resumed-selfie display (shows an empty frame, but it is stored);
   - status screen.
6. **Small follow-ups:**
   - retaking a selfie leaves the previous private object (clean-up job);
   - orphaned photo objects after a failed registration are removed best-effort;
   - no reviewer UI (Studio SQL / service role).

## 5. Retiring the old onboarding (plan — only after V2 is validated)

1. Test project: `smoke_v2.mjs` green + phone test green.
2. Live: P0 package → V2 migration.
3. Point **Sign Up** at `/v2/welcome` (one line in `app/(tabs)/index.tsx`). Keep **Log In** for existing email+password accounts.
4. V1 onboarding routes stay deployable but unreachable for new users.
5. Existing accounts keep `legacy_member` access. No V1 data is changed or deleted (WP6, separate approval).
