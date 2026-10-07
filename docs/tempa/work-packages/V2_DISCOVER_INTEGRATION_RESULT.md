# V2 Discover — real integration (targeted likes + inline comments) — result

Date 2026-10-08 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `43a8257` (clean, same as origin) · Author: Claude Code.
Target: **perfect-match-dev (`fyqwjduzpnjuxqsloxih`) only**; AI HQ and `~/tempa-p06` not touched.

**Not done in this round:**
- no production deploy, no key revocation;
- no account or file deletion, no merge;
- no new scoring or percentage, no change to the Discover order or the quota / premium rules.

**Accounts:**
- Synthetic accounts only were used.
- The phone account `13adb65c-…` was read only; it has 0 used likes, so 5 are available today under the existing free rule.
- Its matches and messages were not touched.

Read first: `V2_DISCOVER_DESIGN_PREVIEW_RESULT.md` (rounds 1–5), `V2_BACKEND_SCORING_AUDIT.md`, `V2_CHATS_ALIGNMENT_RESULT.md`, `V2_PROFILE_INTEGRATION_RESULT.md`. The live definitions were also read from the database (`likes`, its guard / mutual triggers, `get_profile_v2`, `get_my_liker_cards`, `increment_daily_views`, …).

## 1. What was wrong before (found, then fixed)

- **Like quota only on the client:**
    - `increment_daily_views` just counts;
    - the client compared the count with 5 / 10;
    - `likes` had column-level INSERT / UPDATE for `authenticated`.
  So a member could write likes straight through the REST API with no quota.
- **Targets were not real content ids:**
    - photo / prompt likes stored free-text `target_key` with no server check;
    - prompts had no row id at all;
    - `get_profile_v2` returned only paths.
- **Simultaneous mutual likes could miss the match:** if both people liked each other at the same moment, each transaction could miss the other's like.

## 2. Server (migration `supabase/proposed/20261008090000_v2_discover_targeted_likes.sql`)

Applied with `node scripts/dev-backend/apply-dev.mjs discover`, then re-applied once (the file is idempotent) after the guard fix below.

1. **Stable prompt ids:** `profile_prompts_v2.id` (uuid, unique; all 53 existing rows filled). Photos already have ids.
    - `save_prompts_v2` replaces rows, so changed content gets a new id. An old like is **never re-bound** to different content.
2. **`get_profile_v2`** also returns `photos: [{id, path}]` and `prompts[].id`.
    - **No district:** there is no explicit share choice, and a filled district is not consent. The hero shows the city.
    - The other fields are unchanged; no raw draft, surname, DOB, district or coordinates.
3. **`send_like_v2(likee, target_type, target_id, note, request_id)`** — the only write path for active V2 members. In one transaction it checks, in order:
    1. signed in and an active V2 member;
    2. a request id is present;
    3. it locks the caller's `profiles` row, then the pair;
    4. one like per person (`already_liked`) — **the same request id returns the original result** (retry / double tap safe);
    5. the person is visible to the caller: the same rule as `get_profile_v2` (blocks either way, hidden, deleted, eligibility; otherwise `not_available`);
    6. **the photo / prompt id belongs to that person** (otherwise `invalid_target`);
    7. note ≤ 240;
    8. **quota under the existing rule:** free 5 / premium 10 per rolling 24 h, the same counter as before (otherwise `quota_exhausted`).

   It then consumes one unit, inserts the like and logs `like_sent`.
    - The existing `handle_mutual_like` trigger still turns a mutual like into the one match and seeds each note once.
    - A comment alone opens nothing.
    - New column `likes.client_request_id`, unique per liker.
4. **`get_my_like_quota_v2()`** — the header counter (used / limit / remaining / resets_at).
5. **Guard:** active V2 members can no longer insert / update `likes` directly (`use_send_like_v2`). V1 accounts keep their legacy path.
    - The first version called `is_active_v2_member`, which clients may not execute. That made **every** client like fail with a permission error, V1 included.
    - It was caught by the real-service test and fixed with a definer helper `v2_caller_is_member()` (answers only for the caller).
    - The V1 path was re-checked in a rolled-back transaction: a V1 account's direct like still succeeds.
6. **`get_my_liker_cards`** (premium visibility unchanged; non-premium still gets the count only) also returns `target_available`, `target_photo_path` (the receiver's own photo), `target_prompt_id` and `target_answer`, looked up **by id only**. Removed content → `target_available = false`, never another item.

## 3. App

- **`app/(tabs)/index.tsx`:**
    - an **active V2 member** gets the new `components/main/V2DiscoverScreen.tsx`;
    - while the check runs, a spinner;
    - everyone else (signed out, onboarding, V1, the live build) gets the previous screen unchanged (`LegacyHomeScreen`).
- **Shared design** — the approved preview, now used by both:
    - `lib/discover/profileLayout.ts`: profile order, About, location rule, screen chrome;
    - `components/discover/DiscoverProfileItems.tsx`: renderer with injected photo sources.
  The DEV preview keeps its fixtures and bundled images in `components/dev/discover/*` and `lib/dev/discoverPreview.ts`; none of them is imported by the real screen (checked).
- **Real screen:**
    - candidates in the **existing server order** (`get_discovery_candidates_v2`, no re-sort, no score);
    - each profile from `get_profile_v2` with its ids, the photo signed from the private bucket;
    - counter from the server;
    - filter icon → Filters;
    - Block / Report kept at the end of the profile (the previous Discover had them).
- **Heart:**
    - `send_like_v2` with the photo / prompt id;
    - **success → next person**;
    - one send at a time (hearts, Send and × disabled while sending).
- **Comment + Send:**
    - **success →** the keyboard closes, the **same profile stays**, the note + "Comment sent" sits in place, and "Next profile" appears in its bar (records nothing, works at 0 likes);
    - **failure →** no success shown, no advance, **the draft stays**, error under the field;
    - **unknown result (network) →** the request id is kept; a retry of the same content re-uses it, so the server returns the original result and never doubles.
- **Other outcomes:**
    - `already_liked` / `not_available` → message + Next profile;
    - `invalid_target` → the profile reloads, the draft stays;
    - `quota_exhausted` → out-of-likes bar, browsing continues.
    - A profile that is no longer visible when opened is skipped.
    - Load failure → "Couldn't load profiles" + Try again (never "no one left"); empty list → the approved empty screen.
- **Activity → Likes you** (`notifications.tsx`, small change only): each card now also shows what was liked:
    - "On your photo" + a thumbnail of that photo, or "On your answer: …";
    - "… no longer on your profile" when removed;
    - the note text.
  Premium rules unchanged.
- The Next-profile stall guard (keyboard + open editor) from preview round 5 is used here too.

## 4. Tests

### Real services (perfect-match-dev, real email-code sessions of synthetic accounts, normal user rights)

| Run | Result |
|---|---|
| **`smoke_discover_v2.mjs` (new)** — sender `cca06005-…` → receiver `67acc178-…`, plus 2 eligible synthetic pool members | **34 / 34** |
| `smoke_match_chat_v2.mjs` (updated: likes now through `send_like_v2`; the profile has `photos`) | **56 / 56** |
| V1 direct like in a rolled-back transaction (V1 path kept) | success, rolled back |

What `smoke_discover_v2` covers:
- **Content ids:** Discover lists the receiver; every photo / prompt has a stable id; no district / label / surname / DOB; raw draft not readable; server quota = 5 for free.
- **Refused before writing:**
    - a direct table write;
    - **another person's photo id and prompt id**;
    - an untargeted type;
    - a comment over 240;
    - **nothing written and no unit used** in any of these cases.
- **Sender → DB:**
    - photo like + comment saved with the **exact photo id** and the trimmed note, one row, 1 unit;
    - **3 concurrent retries with the same request id → same result, still one row, one unit**;
    - a second like to the same person refused (no unit);
    - the liked person leaves Discover;
    - no chat and no message from a comment alone.
- **Receiver:**
    - non-premium → count only;
    - premium → the **comment and which photo**;
    - content removed → marked unavailable, not re-bound;
    - a hidden sender is not shown.
- **Mutual like:** the receiver likes back with a prompt comment → **one accepted match, chat open (existing flow)**; each comment becomes the opening message **once**; a retry adds nothing.
- **Last unit, two concurrent sends → exactly one like.** The server returns the reset time.
- **Not available:**
    - blocked pair → like refused, profile not readable;
    - hidden person → refused;
    - none of these wrote anything or used a unit;
    - missing request id and signed-out caller refused.

Every row a run creates is removed afterwards (only rows created during the run, plus the established test pair). Counters, premium and hidden flags are restored.

### Local

- `tsc` clean;
- `node scripts/onboarding-v2-checks/run.js`: new **`v2_discover_real` 30 / 30**; preview 85 / 85; others unchanged (45 · 69 · 56 · 45 · 6 · 10);
- iOS dev bundle builds.

### Phone

**Not tested.** Nothing here has been seen on a device:
- the real screen;
- the keyboard;
- error paths with a real network;
- "Likes you" with the target line.

## 5. Open items

- **Pass is still not recorded** (as before), so a passed person can reappear after a reload. Unchanged on purpose; recording passes needs a product decision.
- **"Show my district":** needs an explicit choice (onboarding / settings) plus the server returning the district only then. No screen added in this round.
- **V1 legacy likes** (V1 Discover, `app/user-profile.tsx`) still write directly with free-text targets and a client-side quota. They stay closed for V2 members; they go away when V1 is retired.
- **The new RPCs** are in the same advisor class as every other V2 RPC ("signed-in users can execute SECURITY DEFINER"). Intentional; `v2_caller_is_member` answers only for the caller.
- The server returns the quota reset time; the UI doesn't show it yet (approved design).
- `smoke.mjs` (old P0 test for the separate TEST project) still uses direct like inserts — fine there, not touched.

## 6. Release blockers (read-only check, nothing changed)

1. **Production build ships V1:**
    - `app.config.js` pins `EAS_BUILD_PROFILE=production` to `live`;
    - so `v2Enabled = false` (`lib/supabaseClient.ts`);
    - so the legacy Discover / Matches / `get_top_matches` run.
   On the same database, V1 invites are refused and V1 likes keep the client-side quota.
2. **The "live" and "dev" backends are the same project** (`fyqwjduzpnjuxqsloxih`): dev changes, including this one, are live for any build.
3. **Embedded legacy JWT** in a push trigger (1 trigger matches the pattern; not printed). Vault secrets: 0. Key rotation pending.
4. **`delete-account` Edge Function** deployed version 1 (2026-09-15); the branch version (cleans all three buckets) is not deployed.
5. **`user-photos` bucket is still public** (1 object).
6. **Supabase advisor:**
    - `profile_cards` is a SECURITY DEFINER view (ERROR);
    - `application_events_v2` has RLS with no policy (INFO, intended service-only);
    - leaked-password protection is off (WARN).
7. **Push:** none for mutual matches, comments or date events.
8. **Post-approval profile editing** undecided (the `profiles` projection goes stale if it opens).

## 7. Phone

**Command:** `~/tempa-p0/scripts/dev-backend/start-app.sh`.
- JS / server only, no native change.
- If the app is already open, press `r` in Metro.

**Where:** the **Discover** tab, signed in as the phone account (an active V2 member).

Checks (≤ 5):
1. Discover shows the approved design with real people:
    - full-screen photo, compact prompts, About;
    - "5 likes left" from the server;
    - no score.
2. **Heart on a photo or prompt:** it moves to the next person once, even with a double tap, and the counter drops by one.
3. **"Add a comment" → type → Send:**
    - the keyboard closes and the same profile stays with the note and "Comment sent";
    - "Next profile" moves on and the counter doesn't drop again.
4. **Airplane mode → Send a comment:** an error appears, the draft stays and nothing advances. Back online, Send again → it goes through once.
5. **On the receiving side:** a premium synthetic account in Activity → Likes you shows the comment and which photo or answer it was on.
    - The phone account itself is non-premium, so it sees the count only (rule unchanged).
    - If you want this checked on the phone, say so and I'll describe how to use a synthetic premium account.
