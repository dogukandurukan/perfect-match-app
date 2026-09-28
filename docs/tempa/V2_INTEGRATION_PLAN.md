# V2 integration plan (P07 R1) — 🔵 PROPOSAL

Date 2026-09-28. Companion to `V2_BACKEND_SCORING_AUDIT.md` (evidence and
field mapping). **Nothing here is approved or implemented.** Each work
package (WP) needs owner approval before it starts; DDL goes through the CLI
(`supabase db query --linked -f`, never `db push`), one migration per
change, with `NOTIFY pgrst, 'reload schema'` after new columns.

## 0. Pre-work (small, independent)
- **Commit the V2 design drafts** that currently live only uncommitted in `~/dating-app-recovered` (`docs/v2-schema-spec.md`, `supabase/migrations/20260921100000_v2_schema_proposed.sql`, `docs/matching-engine-v2.md`, `docs/onboarding-v2-gap-analysis.md`) to a docs branch. Rename the migration so it cannot be applied by accident (e.g. `.sql.draft`).
- **Revision 3 of the draft** against D15–D59:
  - Remove `self_describe`, the dinner style and the old prompt/availability/environment columns.
  - Add the Section 3 columns, `values` incl. `respect`, pet attitude + kind, `activity`, `work_status`, taste items, `date_types`, one favorite spot, days/time, and prompt keys (catalog table).
  - Align enum spellings to the code keys (audit §2.1).

## 1. Work packages

### WP1 — Persistent V2 profile draft + resume
- **Scope:**
  - Apply the Revision 3 core tables: private/profile split, answers, taste items, photos (metadata), prompts, account state.
  - RPCs to save each section (`save_basics_v2`, `save_compat_v2`, …) are idempotent upserts that validate enums server-side and record `last_completed_step` + `questionnaire_version`.
  - The client loads the draft on start and resumes at the last unfinished step, on any device (the server is the source of truth, with a local cache only for offline typing).
  - Show honest save states (saving… / saved / retry) (D5).
  - The V2 flow stays behind a DEV/feature flag.
- **Acceptance:**
  - Kill the app mid-section → reopen → same step, same answers.
  - Sign in on another device → same.
  - An invalid enum is rejected by the RPC with a clear error.
  - No V2 answer is readable by other users (RLS test as a second user via `request.jwt.claims`).
- **Risks:**
  - Double writes if both V1 and V2 flows are live for one user.
  - Schema cache staleness.
  - Accidentally widening `profiles` SELECT.
- **Rollback:** additive tables only. Drop the flag, and the tables can stay empty. No V1 column is changed.

### WP2 — Auth, media, application & access states
- **Scope:**
  - Phone OTP as the primary identity (needs an SMS provider — cost decision, D11).
  - Email attached to the same user with a real email OTP (D8).
  - Photo upload to storage + `profile_photos` rows via RPC (3–6, atomic reorder by an ordered id list).
  - Selfie upload to the private bucket, with its path stored server-side only.
  - `submit_application` validates everything and is idempotent: a second submit returns the same state.
  - Account-state machine (draft → submitted → under_review → accepted/changes_requested/rejected; verification pending/verified/retry; membership none → active).
  - Reviewer actions via service-role Edge Function / Studio only.
  - Replace the post-login gate:
    - onboarding incomplete → resume V2;
    - submitted / under review → "You're on the list" status screen;
    - accepted + verified + active → Home.
    - Read from the server state, **not** from the client-writable `setup_completed`.
  - Fix the P0 over-exposure (`profiles` public columns) in the same package.
- **Acceptance:**
  - An interrupted upload leaves no counted photo.
  - Retrying Submit after a network drop does not duplicate.
  - A user cannot set their own state (RLS/grant tests).
  - A selfie is not readable by any client.
  - A rejected verification removes discovery eligibility at once.
- **Risks:**
  - SMS cost and delivery.
  - Media retention/KVKK (selfie = biometric-adjacent; consent text and retention period needed).
  - Locking out the owner's current email-only test accounts.
- **Rollback:**
  - The gate is behind a flag, so the V1 gate stays available.
  - Keep storage objects; the state rows are independent.

### WP3 — V2 profile in the main app
- **Scope:**
  - Discover/Matches/profile cards read V2 fields (the P07 R1 preview layout is the reference).
  - Remove the percentage display if the 🔴 decision says so.
  - Contextual photo/prompt notes (D45) use the existing `likes` (target_type/target_key/note) — no new messaging.
- **Acceptance:**
  - A V2 user's card shows exactly the approved public fields.
  - Private fields never appear.
  - V1 users still render (legacy fields read-only).
- **Risks:** about 10 files render `match_percentage`/badges (audit §1.4).
- **Rollback:** per-screen flag or keep the V1 components.

### WP4 — Approved V2 scoring
- **Scope:**
  - New `get_top_matches_v2` (SQL, SECURITY DEFINER, `auth.uid()` guard). It applies the eligibility gate (state + mutual gender + mutual age range + city + blocks + cooldown) and then the approved soft points, and returns reasons from real shared facts plus coverage.
  - Store `score_version`.
  - Persist Discover passes (cooldown).
  - Stop freezing scores into `matches.match_score`, or recompute on read.
  - Delete the client copies of scoring once live.
- **Acceptance:**
  - SQL tests for the `SCORING.md` §4 scenarios, plus audit §3.2 (intent outranks shared taste; missing optional ≠ penalty; own smoking ≠ filter; age range enforced both ways).
  - EXPLAIN ANALYZE < 50 ms for 10 k test profiles.
- **Risks:**
  - Weights not calibrated (no real data).
  - Two engines live at once.
- **Rollback:** the client switches RPC by flag; V1 `get_top_matches` stays until WP6.

### WP5 — Synthetic test profiles + end-to-end date test
- **Scope:** described in §2 below.
- **Acceptance:** from a clean slate, one script creates the cohort, the owner's test account sees the expected order, a full like → mutual → chat → plan → check-in loop works, and the cleanup script removes everything (0 rows / 0 objects left with the cohort tag).

### WP6 — Retire V1 (later, not now)
- **Trigger:** V2 has been live for all new sign-ups for ≥ 2 weeks without rollback, and every remaining V1 account has either completed the V2 re-questionnaire or been contacted.
- **Order:**
  1. Stop writing V1 columns.
  2. Hide V1 onboarding routes (they stay deployable).
  3. Snapshot / export.
  4. Drop V1-only RPC paths (`get_top_matches`, `profileMatching`, dead `*Matching.ts`).
  5. Drop V1-only columns in a final, separately approved migration.
- **Never** delete V1 data in the same release that ships V2.

## 2. Test data and the owner's own access (WP5 detail)

### 2.1 Synthetic cohort
- **Clearly synthetic:**
  - Emails `test+<n>@tempa-test.invalid` (a reserved `.invalid` TLD — cannot receive mail).
  - First names drawn from an obviously-test list (e.g. "Test Ada", "Test Deniz").
  - Photos are **illustrations or abstract placeholders, never real people** (no pravatar-style services — see the P07 finding).
  - Every row is flagged: `is_seed_data = true` in the account-state table (draft column), plus a `test_cohort` tag.
- **Deterministic:**
  - UUIDv5 from a fixed namespace + index, so re-running the script upserts the same ids.
  - A fixed seed for any randomness.
- **Coverage (~24 profiles around the owner's test account):**

| Group | Purpose |
|---|---|
| Same intent + similar lifestyle | high score |
| Opposite intent (long_term × casual) with lots of shared taste | intent must outrank taste |
| figuring_out mixes | partial intent credit |
| Smoker / non-smoker, pets rather-not × owner | lifestyle gaps without hard filtering |
| Minimum data (only required fields, no taste/school) | missing ≠ penalty |
| Interested-in not reciprocal (e.g. candidate only interested in women while the owner is a man) | must be **excluded** |
| Outside the owner's age range, and the owner outside theirs | excluded both ways |
| Other city | excluded |
| Blocked / hidden / deleted / application pending / verification not verified | excluded by the gate |
| Boundary cases (exactly 18, age-gap thresholds, 1 interest, 10 interests, 6 photos, 3rd prompt blank) | edge rendering |

- **Isolation:**
  - Preferably a **separate Supabase project or branch** for testing.
  - If only production exists:
    - `get_top_matches_v2` excludes `is_seed_data` rows unless the *viewer* is also flagged as a tester (server-side check, never a client flag).
    - Test accounts are excluded from analytics queries.
- **Create / clean:**
  - A Node/SQL script run with the service role key **locally** (never shipped in the app) that is idempotent.
  - Cleanup deletes by `is_seed_data` / cohort tag: auth users via the admin API (cascade), then storage prefixes, then asserts zero remain.
  - Dry-run mode prints counts only.

### 2.2 Reaching Home with the owner's own test account (no client bypass)
Today the only gate is `profiles.setup_completed`, which is client-writable (audit §1.2). A client-side "skip" must **not** be added.
- **Now (V1 app):** mark the owner's test account complete once, as an admin, in Supabase Studio SQL for that exact UUID. Record which UUID, and never do it for real users. This is a data change, so it needs explicit approval at that time.
- **After WP2:**
  - The owner completes V2 onboarding once with that account.
  - A reviewer action (service-role Edge Function, or a Studio SQL call to the reviewer RPCs `review_verification` → `review_application` → `activate_membership`) moves it to verified / accepted / active.
  - From then on, a normal login goes straight to Home, because the gate reads the server state.
  - A `tester` role/flag (server-side) can additionally unlock seeing the synthetic cohort.
- A DEV-only "reset my V2 draft" action may call an RPC that clears only the caller's own draft. It must not change application or verification state.

## 3. Recommended order
0 (drafts committed + Revision 3) → **WP1** → **WP2** (the P0 privacy fix goes here or earlier) → **WP5 cohort v1** (needed to test WP3/WP4) → **WP3** → **WP4** → end-to-end date test → WP6 later.

The V1 bugs in audit §4 (age range ignored, pass not stored) can be fixed independently at any time if V1 stays in use for a while.

## 4. Decisions waiting for the owner
1. Approve Revision 3 scope (tables, enum spellings = code keys, `respect`, prompt catalog vs CHECK).
2. SMS provider + budget for phone OTP (D11) — or email-first for the closed beta?
3. Test environment: separate Supabase project/branch vs flagged data in production.
4. V2 scoring weights, hard-filter policy, age model, proximity bands, coverage use (audit §3.3).
5. Percentage display vs qualitative explanation (🔴).
6. Selfie retention period and KVKK consent text (lawyer review already recommended).
7. Legacy V1 accounts: re-questionnaire flow copy and deadline.
8. Recommendation vs match separation (new table) and the discover/pass cooldown length.
