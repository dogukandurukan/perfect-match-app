# Test environments

## A. Local full Supabase (current choice, free — 2026-10-09)

The owner chose **not** to create a paid cloud test project. Tempa's tests run on a **local** Supabase started by the Supabase CLI in Docker:
- Postgres 17, Auth, Storage, Realtime;
- folder `local-backend/`, project id **`tempa-local`**, ports **554xx** (API 55421, DB 55422, mail 55424);
- Studio, analytics, edge runtime and vector are off.
- It doesn't touch other local projects (e.g. `terapi-yerel` on 543xx) and never the shared DEV/live project.

| Step | Command | What it does |
|---|---|---|
| 1 | `node scripts/local-backend/setup.mjs` | generates migrations (sanitized live-schema snapshot + every package in the live order + the Matches package; **no data**), `supabase start`, `db reset`; writes `.env.local-backend.local` (git-ignored, mode 600, local URL / keys only) |
| 2 | `node scripts/local-backend/seed.mjs` | synthetic accounts only, through the normal V2 path (real Auth email code, Storage uploads, onboarding RPCs, reviewer accept); one mutual match for the tester |
| 3 | `node scripts/local-backend/smoke_matches_local.mjs` | Matches on real services: parallel first pick, Discover, photo access, like → match → first message over Realtime, last-unit race |
| 4 | `scripts/local-backend/start-app.sh` | Metro for the dev client with `TEMPA_BACKEND=local` and the Mac's **Wi-Fi address** (the phone must be on the same Wi-Fi); prints a one-time code for `tempa-matches-tester@tempa-test.example.com` |
| — | `node scripts/local-backend/setup.mjs --stop` | stops only `tempa-local` |

**Guards:**
- The scripts accept only `http://127.0.0.1:55421`.
- The app's `TEMPA_BACKEND=local` accepts only loopback / private LAN addresses and a non-live anon key, otherwise it refuses to start.
- A production build stays pinned to live.
- Checks: `scripts/p0-checks/backend_config.check.mjs`, `scripts/p0-checks/local_launcher.check.mjs`.

## B. Separate Supabase cloud test project (not used — kept for reference)


Branch `tempa/v2-persist-r2` (working folder `~/tempa-p0`). Everything here
targets a **separate** test project. The scripts refuse the live project's
URL, keys and DB string, and never print secret values.

### 0. Status (2026-09-30)

The Supabase account has only two projects:
- `perfect-match-dev` = **live**;
- `ai-hq` = **not Tempa**, must not be used.

Both are refused by the scripts and the app. **A new project for Tempa's tests has to be created first**:
- Dashboard → New project → name it e.g. `tempa-test`. `setup.mjs` checks that the name contains "tempa".
- If the plan's project limit blocks a new free project, that is an account/billing choice for you. Do not repoint any existing project.

### 1. What you fill in (once)

File: **`~/tempa-p0/.env.test.local`**. It is already created, empty, git-ignored and mode 600.

| Variable | Where in the TEST project's Dashboard |
|---|---|
| `TEST_SUPABASE_URL` | Settings → API → Project URL (`https://<ref>.supabase.co`) |
| `TEST_SUPABASE_ANON_KEY` | Settings → API → anon / publishable key |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role / secret key (local scripts only) |
| `TEST_DB_URL` | Connect → Connection string → Session pooler URI, with the DB password |

Two Dashboard settings in the test project:
1. **Auth → Email Templates → "Magic Link"**: include `{{ .Token }}` in the body. Otherwise the email carries only a link, and the app's 6-digit code screen can't be used on the phone.
2. **Auth → Providers → Email**: enabled (the default). The built-in mailer sends very few emails per hour. For more phone attempts, set a custom SMTP; the scripts don't need email at all.

### 2. Order (why this order)

| # | Step | Command | Depends on |
|---|---|---|---|
| 1 | Sanitized live schema (no data, webhook, cron or keys) | `apply.mjs base` | — |
| 2 | **P0-A** + **P1 private bucket** (`profile-photos-private`, 15-min signed URLs) | `apply.mjs p0a` | 1 |
| 3 | **V2** persistence, review loop, V2 eligibility, orphan listing | `apply.mjs v2` | 2: V2 redefines P0-A's visibility rule / discovery wrapper / profile guard, and stores photos in the P1 bucket |
| 4 | Synthetic people + 2 phone accounts | `seed.mjs` | 2 |
| 5 | P0 smoke on real Auth / REST / Storage / Realtime | `smoke.mjs --stage p0a` | 4 |
| 6 | V2 end-to-end on real services (2 synthetic accounts; evidence file) | `smoke_v2.mjs` | 3 |
| 7 | **Phone test** with the **R-P0 client** (this branch) | `start-app.sh` | 1–6 |
| 8 | **P0-B** (own-row-only `profiles`) | `apply.mjs p0b` → `smoke.mjs --stage p0b` → `smoke_v2.mjs` | 7 (only after the R-P0 client is the one in use) |
| 9 | Orphan clean-up (dry run, then `--delete`) | `cleanup_orphans.mjs` | 3 |

Steps 1–6 in one go: **`node scripts/test-backend/setup.mjs`**.
- Resumable: finished steps are skipped.
- Stops at the first failure.
- Evidence goes to `.test-backend/`.

The local replica (no project needed) runs the same packages in the same order:
- `http_p0.test.mjs`
- `http_v2.test.mjs`, which ends by applying P0-B and re-checking V2.

### 3. One command for the phone

From a terminal:

```
~/tempa-p0/scripts/test-backend/start-app.sh
```

It starts Metro for the dev client against the test project. The app shows a green `TEST · <ref>` badge on every screen. If the settings are missing or point at live, the app refuses to start.

### 4. Short phone checklist

The test logins are in `~/tempa-p0/.test-backend/accounts.local.json`. The full P0 list is in `P0_PHONE_TEST.md`.

**P0 (seeded accounts Deniz / Ada)**
1. The badge reads `TEST · <ref>`.
2. Home and profiles show the city only: no surname, no district, no "Nearby".
3. Hidden or blocked people don't appear. Zeynep's accepted chat stays.
4. Invite: Ada invites Deniz → Deniz accepts → the chat opens.
5. Block → the person disappears from Chats, Home and Activity. The unblock list shows an initial only.

**V2 (new account — "TEST · Join with new onboarding" on the signed-out screen)**
1. Consent box is required → email → the 6-digit code from the email → Basics.
2. Answer a few steps, **close the app**, reopen → it continues at the same step with the same answers.
3. Add 3 photos. Tiles show "Not saved yet" briefly, then "All photos saved". Close the app right after picking → reopen → the saved photos are there.
4. Reorder and delete a photo → reopen → the order and deletion are kept.
5. Selfie → Continue → close and reopen → "Selfie received" + Retake.
6. With airplane mode on, Submit → error, no "You're on the list!". Airplane mode off → Submit → "You're on the list!". Reopen → status screen, no Home.
7. Reviewer (I run it on the test project): request changes → the app reopens the flow with the note → retake the selfie → submit again → accept → Home.
