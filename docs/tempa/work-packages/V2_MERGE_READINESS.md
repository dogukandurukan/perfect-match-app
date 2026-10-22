# V2 product branch — merge readiness (2026-10-21)

Author: Claude Code. Read-only review plus small clean-ups; **no merge, no deploy, no remote backend access**. Branding worktree (`~/tempa-collab-prep`, `tempa/collab-design-prep`) not touched or included.

## Source and target

**Source:** `tempa/v2-persist-r2`, pushed. The exact commit is the commit that adds this report; see the final hand-off. The review was done at `20290d0`.

**Target (from the history): `main`.**
- The branch forked from `main` at `95814a6`.
- Every earlier tempa code branch is already inside it: p01 → p07, p0-privacy, p0-privacy-r3, v2-persist.
- None of them was ever merged into `main`. `main` only received docs commits written directly on it ("hand off" notes).
- No other integration branch exists; no PRs.

**`origin/main` has 2 commits since the fork:** docs only (`P06_YOUR_DATES_UI.md`, `P07_YOUR_PROFILE_UI.md`). A dry-run `git merge-tree origin/main tempa/v2-persist-r2` merges with **no conflicts**.

**Note:** the local `main` checkout (`~/dating-app-recovered`, `393bf11`) is **22 commits behind `origin/main`**. Merge from an up-to-date `origin/main`, not from that checkout.

## What the merge brings (everything since `95814a6`, not just the last commits)

**Size:** about 129 commits; 338 files, +45,121 / −909.

**Areas:**
- **V2 onboarding (P01–P07):** basics, compatibility, your life / world / dates, profile, photos / prompts, D93 starters, email-code sign-in; `components/onboarding-v2`, `lib/onboardingV2`, `app/v2/*`.
- **P0 privacy:** private photos, restricted profile reads, delete-account, key plan; `supabase/proposed/2026092813*`, `20260930*`.
- **V2 discovery, public profile, likes, daily picks / Matches, mutual-like match → chat → date suggestions, unmatch.**
- **V2 Activity:** like cards, Match & chat, read state, **unseen-like tab badge**.
- **Interests and conversation starters, "Both into this".**
- **Chat:**
  - redesign (V2 styles; V1 styles kept);
  - + sheet, Suggest a date tidy-up;
  - **photo messages**;
  - Realtime catch-up, newest-page load, older history paging, opening at the newest message;
  - the LOCAL code-screen command fix.
- **Edge functions:** `delete-account`, `cleanup-orphan-media`, `send-meetup-reminders`, `send-push-notification`, `_shared/webhookAuth`.
- **Test / tooling (not shipped in the app):**
  - `scripts/local-backend/*` (local Supabase, smokes, probes);
  - `scripts/dev-backend/*`, `scripts/test-backend/*`, `scripts/p0-checks/*`, `scripts/onboarding-v2-checks/*`;
  - `local-backend/` config;
  - `docs/tempa/*` (50 files).
- **DEV-only screens** (`app/dev/*`), redirected away in release builds.

**Unrelated changes:** none found outside the V2 / P0 / tooling scope. The branding work is on a separate branch / worktree and is not part of this branch.

## Release clean-up

**Removed now (`20290d0`):** the temporary `chat-rt1` / window size / font scale marks on the DEV badge. The badge itself is `__DEV__`-only and still shows LOCAL / DEV / TEST / LIVE · project ref.

**Checked, already safe in release builds** (verified by bundling with `EAS_BUILD_PROFILE=production`; no backend contacted). In the release bundle, "DEV · Test account sign-in", "Join with new onboarding", "DEV · Input lab", `chat-rt1` and `chat-r3` occur **0** times.

| Item | Why it is safe |
|---|---|
| Home DEV buttons (test sign-in, new-onboarding join, input lab, build label) | `__DEV__` |
| `devTestEmail` | `null` unless `__DEV__ && v2Enabled` |
| `app/dev/*` previews | `if (!__DEV__) return <Redirect href="/" />` |
| `DevStepNav` | `__DEV__` |
| Hard-coded local / LAN URLs in app code | none (only `lib/backendConfig.ts`, which refuses non-local values for `local`) |
| Synthetic-content fallbacks outside `app/dev`, `components/dev`, `lib/dev` | none |
| `tempa-test.example.com` | appears once in the release bundle: the allow-list regex in `backendConfig` (not a fallback) |
| Test-account auto sign-in | none (`signInWithPassword` is V1's own login) |
| `register.tsx` step logs | names only, no personal data (left as is) |

**Not changed, deliberately:** `app/v2/*` routes have no release guard.
- Home's server access gate (`get_my_access_v2`, **not** tied to `v2Enabled`) routes pending V2 applicants to `/v2/status` / `/v2/onboarding` on purpose, including on live.
- Guarding the group with `v2Enabled` would make those users loop.
- This belongs to the production V1 / V2 selection decision below.

## Release configuration (read-only; not resolved)

- `app.config.js`: `EAS_BUILD_PROFILE === 'production'` → `extra.backend = { env: 'live' }`.
- `lib/backendConfig.ts`: `live` and `dev` → the **same** project `fyqwjduzpnjuxqsloxih`.
- `lib/supabaseClient.ts`: `v2Enabled = env ∈ {dev, test, local}` → **false in every production build**.
- **So a production build today ships the V1 product against live.** V2 screens (incl. this branch's chat / Activity / photo work) are not used, except the server-routed `/v2/status` / `/v2/onboarding` path above.
- This blocker, first reported in `V2_CHATS_ALIGNMENT_RESULT.md` §2, **is not fixed**.

**Shared code also changes V1 behaviour (V1 visuals kept):**
- The chat screen is shared: V1 chats get the catch-up, newest-500 load, older-history paging, the opening position and the read-back of own messages. V1 styles are byte-identical to before the redesign.
- The Activity badge and photo messages are V2-only.

## Server pieces the merged code needs — a git merge applies NONE of them

| Package / function | Needed by | Applied where (from the reports) |
|---|---|---|
| `20260928130000_p0a_privacy_additive`, `…130100_p0b_privacy_restrict`, `20260930090000_p1_private_photos` | P0 privacy, private photos | shared project (DEV = live) via `apply-dev.mjs`; LOCAL |
| `20260930120000_v2_onboarding_persistence`, `20260930140000_v2_review_discovery_media`, `20261001090000_v2_public_profile`, `20261001120000_v2_match_chat_date`, `20261001140000_v2_discovery_skip_liked`, `20261008090000_v2_discover_targeted_likes` | V2 onboarding, review, profile, chat dates, discovery | shared project via `apply-dev.mjs`; LOCAL |
| `20261009090000_v2_matches_daily_picks` | V2 Matches | **LOCAL only** |
| `20261012090000_v2_activity_accept` (`likes.seen_at`, `get_my_activity_v2`, `mark_like_seen_v2`, `accept_like_v2`) | V2 Activity + badge | **LOCAL only** |
| `20261014090000_v2_interests_takes`, `20261015090000_v2_takes_multi`, `20261016090000_v2_onboarding_takes` | interests / starters / D93 | **LOCAL only** |
| `20261020090000_v2_chat_photos` (messages columns, insert RLS, **`chat-photos` private bucket + Storage policies**, `send_photo_message_v2`) | chat photos | **LOCAL only** |
| `20260930100000_db_webhooks_vault` | push webhook / reminder cron without keys | key-rotation plan (`P0_KEY_ROTATION_PLAN.md`); not part of this check |
| Edge functions `delete-account`, `cleanup-orphan-media`, `send-meetup-reminders`, `send-push-notification` (+ `_shared/webhookAuth`) | account deletion, media clean-up, reminders, push | deploy state per the P0 reports; **`delete-account` redeploy was listed as pending** |

**Client compatibility:**
- **Message reads:** use `select('*')` (works with or without the photo columns).
- **Activity / photos / Matches daily picks / starters on servers without their package:**
  - V2 Activity falls back to the legacy screen on a missing function.
  - The photo send shows "Photos aren't available on this server yet".
  - Other V2 calls show their errors.

  Per the earlier reports, the packages up to `20261008090000` (rows 1–2 of the table) **were** applied to the shared project via `apply-dev.mjs` (`V2_DEV_APPLY_RESULT`, `V2_PROFILE_INTEGRATION_RESULT`, `V2_MATCH_CHAT_DATE_RESULT`, `V2_DISCOVER_INTEGRATION_RESULT`). The packages from `20261009090000` on (Matches daily picks, Activity, interests / starters / D93, chat photos, member photo order, profile visits, connection questions) are documented as **LOCAL only** — no report applies them to the shared project, and `apply-dev.mjs` doesn't list them.
  **Correction (2026-10-23):** an earlier hand-off said "none of the V2 server packages are on the shared project". That was too broad. The shared project's *current* state was not checked again after those reports (no remote access in these packages), so it is **unknown**: whether the 20261009+ packages are absent, and whether the earlier ones are still exactly as applied.

## Open items: merge vs. release

| Item | Blocks merge? | Blocks release? | Why |
|---|---|---|---|
| Phone test: foreground message during a real Realtime re-establishment | No | **Should pass before release** | Recovery is covered by local real-service tests (cold join, a message inside the gap, catch-up, 0 missing / 0 duplicates), not yet seen on a phone |
| Phone test: photo signed-URL refresh | No | **Should pass before release** (V2 photos) | Code-reviewed + pure tests; needs a > 1 h chat or a broken URL to see |
| More than ~2000 missed messages → possible gap between the newest page and older history | No | No (documented limit) | Bounded catch-up by design; very unlikely; older paging still works |
| Unsent-photo clean-up; pixel downscaling | No | **Yes for a V2 photo release** (Storage hygiene / size), no for V1 | Orphan uploads stay private but accumulate; large photos are only JPEG-re-encoded |
| Production V1 / V2 selection; V2 packages since 20261009 not on the shared / live project | No | **Yes, hard blocker for releasing V2** | A production build would run V1; V2 servers lack the packages |
| Non-premium Activity badge (0) | No | Product decision | Follows "likes the user can see" (D84 interim) |

## Checks run (this review)

- `node scripts/onboarding-v2-checks/run.js`: all 19 suites pass.
- `scripts/p0-checks`: 28 · 12 · 14 · 21, all pass.
- `tsc --noEmit`: clean.
- `expo export` with the release profile: exit 0; DEV strings absent (see above).
- Earlier in these packages, on tempa-local: the chat / photo / history / badge / Activity / Matches smokes passed. Not re-run here; no code they cover changed in this review.

## Merge method after approval

1. `git fetch origin`.
2. In a clean checkout of `main` that is **up to date with `origin/main`** (not the stale `~/dating-app-recovered`, or bring it up first with `git pull --ff-only`): `git merge --no-ff origin/tempa/v2-persist-r2 -m "Merge tempa/v2-persist-r2: V2 onboarding, privacy, discovery, matches, Activity, chat"`.
   - The dry run showed no conflicts.
   - `--no-ff` keeps the branch history and one revertable merge commit.
3. Run `run.js`, `p0-checks` and `tsc` on the merge result, then `git push origin main`.
4. This does **not** apply any migration, Storage bucket or function, and does not change which product production builds ship. Those are separate, explicitly approved steps.
