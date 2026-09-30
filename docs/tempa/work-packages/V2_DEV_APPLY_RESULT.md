# P0 + private photos + V2 applied to perfect-match-dev (result)

Date 2026-09-30 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` · Author: Claude Code.

**Owner decision (2026-09-30):** the app is unreleased and has no real users. There is no separate test project and no Docker; **perfect-match-dev (`fyqwjduzpnjuxqsloxih`) is the V2 development target.** AI HQ is not touched and is refused by every script and by the app. No merge.

## 1. Pre-checks

| Check | Result |
|---|---|
| Accounts | 4 auth users. **All four emails are the owner's own** (checked by pattern only; no addresses printed). None of the older documented test UUIDs exist any more (clean start). No unexpected real user → proceeded |
| Data | 4 profiles, 1 onboarding answer, 5 events, 10 venues, 0 matches / messages / likes / notifications / blocks / reports, 2 storage objects (owner's photo + selfie) |
| Backup | `~/tempa-backups/2026-09-30-before-p0-v2/` (mode 700, outside the repo): every public table's rows, `auth.users` + `auth.identities`, storage buckets/objects metadata **and both object files**, cron jobs (key redacted), full schema catalog, all public function definitions. Row counts match the live counts; no key in the backup |
| Drift | the live catalog was **identical** to the 2026-09-29 snapshot the packages were tested against (0 added, 0 removed, 13/13 functions unchanged) |

## 2. Applied, in dependency order (linked CLI, each file in its own transaction)

1. **P0-A** + **P1 private photo bucket** — verified:
   - the new functions, 3 guard triggers and the `profile_cards` view exist;
   - `profile-photos-private` is private with 3 policies;
   - the public listing policies are gone and anon can no longer insert profiles;
   - the push webhook was left as it was.
2. **V2** persistence + review / discovery / media — verified:
   - 6 tables, 12 RPCs, 20 prompt catalog rows;
   - clients cannot review or change their state;
   - profiles and auth users unchanged.
3. **Photo move** (resumable runbook, plan §4.3): the owner's one legacy photo was copied to the private bucket and its reference switched. A re-run did nothing (idempotent). **The old object in `user-photos` is kept**; deleting it needs approval.
4. **P0-B** (own-row-only `profiles`, original DOB RPCs closed).

Not applied:
- the Vault webhook migration and the Edge Function changes (key rotation — see §5);
- the `delete-account` redeploy: the automatic permission check refused the deploy, so it's for you to decide (§5).

## 3. Environment controls (new target recorded, guards kept)

- App: `TEMPA_BACKEND=dev` selects perfect-match-dev **explicitly**.
    - Amber `DEV · fyqwjduzpnjuxqsloxih` badge on every screen.
    - V2 entry + V2 Home are enabled only for `dev` / `test`, never for `live`.
    - A missing or unknown selection still refuses to start.
- Scripts: the dev project is usable only with `TEMPA_TARGET=dev`, from `.env.dev.local` (git-ignored, mode 600; the keys were written there by the CLI and never printed), and only for that one ref.
    - Schema changes go only through `scripts/dev-backend/apply-dev.mjs`, which checks that the CLI link is perfect-match-dev.
    - The separate-test-project path and all its refusals stay in place.

## 4. Real Auth / DB / Storage / Realtime tests (synthetic accounts)

| Suite | Result |
|---|---|
| `smoke.mjs --stage p0b` — P0 visibility, 15-min signed URLs (expiry + re-sign), no public URL, invite → accept → **realtime** message, block (13 synthetic people from `seed.mjs`, `@tempa-test.example.com`) | **37 / 37** (first run 36/37; realtime was a test timing issue — see note) |
| `smoke_v2.mjs` — see the list below | **71 / 71** |
| Orphan media (dry run) | 0 orphans older than 24 h |

`smoke_v2.mjs` covered, with 2 synthetic accounts:
- real email-code verification;
- saves, an offline error, retry;
- re-login + resume;
- real uploads, a failed upload, reorder, delete;
- private selfie;
- cross-account denials;
- offline submit, rapid taps (one submission);
- request changes → resubmit → accept;
- mutual V2 eligibility with photo loading;
- block.

Stored-data evidence: `.test-backend/evidence-v2-3aa0aa.json` (git-ignored). Its `account_state` snapshot was taken right after the first submission; the review round-trip is in its `application_events` list.
- Answers: intent `long_term`, values `trust, respect`, favorite spot, resume position.
- Photos: positions 1-2-3 with exactly 3 objects.
- Prompts: 2.
- Selfie stored (private).
- Events: `submitted → changes_requested → submitted → accepted` and `submitted → accepted`.
- Discovery: A ↔ B.

Note (realtime): the first run failed because the test sent the message before the server confirmed the subscription. A separate diagnostic run received the message live. The test now waits for `SUBSCRIBED` and passes.

Unchanged local suites: V2 137/137, P0 325/325, backend selection 16/16, photo cache 14/14, mapping 21/21, onboarding 45/69/56, tsc clean.

## 5. For you

1. **Key rotation (owner, Dashboard; values never shown):** the legacy `service_role` JWT is embedded in the `matches-push-notification` webhook. This project already has new-style keys (`default/publishable`, `default/secret`). Follow `P0_KEY_ROTATION_PLAN.md` §3:
   1. Vault webhook secret + `TEMPA_WEBHOOK_SECRET` function secret.
   2. Deploy the push/reminder functions from this branch with the transition flag.
   3. Apply `20260930100000_db_webhooks_vault.sql`.
   4. Remove the transition flag.
   5. Point the app at the publishable key.
   6. **Disable the legacy JWT keys** (this revokes the leaked key).

   After step 6, refresh `.env.dev.local` with the new keys (I can do it via the CLI without printing).
2. **Delete-account redeploy:** the updated function also removes files from the private photo and selfie buckets. Deploying it was refused by the automatic permission check. If you want it, run `npx supabase functions deploy delete-account --project-ref fyqwjduzpnjuxqsloxih` from `~/tempa-p0`, or allow me to.
3. Old public-bucket object (1 file) and synthetic test users: kept. Delete only when you ask.
