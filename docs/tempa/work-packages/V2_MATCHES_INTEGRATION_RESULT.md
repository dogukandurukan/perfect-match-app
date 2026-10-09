# V2 Matches — real integration (daily picks) — result

Date 2026-10-08 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `a301654` (clean, same as origin) · Author: Claude Code.

**Not done:**
- **No migration applied to the shared remote project**: DEV and live are the same Supabase project, `fyqwjduzpnjuxqsloxih`.
- No production deploy, no merge.
- No real accounts, likes, matches or messages changed.
- AI HQ and `~/tempa-p06` not touched.

**Remote access:** read only, twice:
- whether `get_daily_picks_v2` exists there: **no**;
- the state of the synthetic DEV tester.

Decisions recorded: `docs/tempa/DECISIONS.md` **D67–D74**. D61–D66 unchanged.

## 1. Test environment

**Local, fully separate replica — no shared project, no cloud.**
- **Database:** PGlite (Postgres in WASM) built from the read-only live schema snapshot (`supabase/proposed/tests/live_snapshot_2026-09-29.json`).
- **Packages applied in the live order:** P0-A, P1, V2 persistence, review / discovery, public profile, match / chat / date, skip-liked, P0-B, Discover targeted likes, and the **new package**.
- **API:** **PostgREST 13.0.8** from the official Docker image. A small local wrapper maps the harness config to `PGRST_*` variables; it lives only in the scratchpad and isn't committed. Requests run with real JWTs.
- **Data:** synthetic users only (`…@tempa-test.invalid`).
- **Baseline check:** the existing `http_v2.test.mjs` passes **210 / 210** in the same environment.
- **Not used:**
    - local `supabase start`: needs ~GBs of images; this replica is lighter and already the project's established method;
    - any separate cloud project: none exists — `TEST_ENVIRONMENT.md` §0.

## 2. Migration status

`supabase/proposed/20261009090000_v2_matches_daily_picks.sql` — **proposed, NOT applied** to the shared project.
- It is deliberately **not** wired into `scripts/dev-backend/apply-dev.mjs` (a check enforces this).

What it contains:
1. **Suspension:**
    - `membership_status = 'suspended'` is the explicit signal (`v2_is_suspended`, `v2_pair_has_suspended` for RLS);
    - `v2_chat_state` → `active` / `unavailable` / `ended`;
    - `v2_chat_active` now also requires no suspended participant;
    - the messages insert policy refuses messages to / from a suspended account;
    - `get_my_matches_v2` keeps such chats with `unavailable = true` (no photo).
    - Hidden is unchanged: out of discovery / picks, chats continue.
2. **Period:**
    - `v2_pick_period(ts)` = `((ts at time zone 'Europe/Istanbul') − 12 h)::date`;
    - `v2_pick_refresh_at(period)`.
3. **`daily_picks_v2`** (`user_id`, `period`, `pick_user_id`, `mutual_user_id`, PK `(user_id, period)`):
    - RLS on, no client grants;
    - created once per user and period by `v2_ensure_daily_picks` under a per-user advisory lock;
    - **pick:** `v2_pair_eligible` minus any match row, anyone I liked, anyone ever featured to me, the featured mutual; ordered by `md5(user ‖ candidate ‖ period)` — **temporary random, not a score**;
    - **mutual:** chat-active, not hidden, active-member matches with no message in the pair; never-featured → least recently featured → older match;
    - `v2_daily_card` gives live state (`new` / `like_sent` / `matched` / `conversation_started`) or `null` when no longer available — the person is never replaced inside the period;
    - `get_daily_picks_v2()` is the only client entry point;
    - `v2_daily_picks_json(user, at)` is internal: service role only, used by the tests to simulate 11:59 / 12:00 / other days without touching any clock.
4. **Discover:**
    - `get_discovery_candidates_v2` first ensures today's row, then **excludes today's pick**, so tab order doesn't matter;
    - the order is otherwise unchanged (`order by user_id`).
5. **Like source:**
    - `likes.source` (`discover` / `daily_pick`, `NULL` = unknown / old) + `likes.pick_period`;
    - `send_like_v2(…, p_source)`: `daily_pick` only for the **current** pick; a Discover-source like on today's pick and any older pick → `stale_pick` **before** any like or quota;
    - the 5-argument call (installed builds) = Discover.
    - Replay, quota, target ownership and one-like-per-person are unchanged.
6. **No automatic messages in V2:**
    - `handle_mutual_like` no longer copies notes into `messages` for a V2 pair (both have a V2 account state); V1 is unchanged;
    - `get_chat_v2` now returns `state` and `likes` (which photo / prompt, who sent it, note).
    - Existing messages are untouched.

## 3. App changes

- **`app/(tabs)/matches.tsx`:** V2 backends → `V2DailyMatchesScreen`.
- **`components/main/V2DailyMatchesScreen.tsx`** (new):
    - the approved cards with data from `get_daily_picks_v2`;
    - **separate loading / error / empty states**; empty = "No new pick right now", "No new mutual match to feature today", or "No mutual likes yet";
    - Say hello → the real `/chat` (sends nothing); photo / View profile → profile;
    - no Plans segment: date suggestions live inside each chat;
    - **if the server lacks `get_daily_picks_v2`** (today's shared project) **it shows the previous V2 Matches list unchanged**.
- **`components/matches/v2/DailyMatchCards.tsx`** + **`lib/matches/copy.ts`** (new): the approved card UI and copy, shared by the real screen and the **DEV preview**, which now uses them too and is kept as the reference.
- **`app/v2/match-profile.tsx`** (new): the full profile on the shared Discover components.
    - **Pick, state new:**
        - heart / comment → `send_like_v2(…, 'daily_pick')`;
        - heart → back to Matches (Like sent);
        - comment → stays with the sent note;
        - failure keeps the draft;
        - an unknown result reuses the request id.
    - **Stale pick** → "Today's pick has changed…" + Back to Matches; nothing spent.
    - **Mutual** → read-only.
    - Back always returns to Matches.
- **`lib/matches/dailyPicksV2.ts`** (new): loader with **unsupported-server detection** (PGRST202).
- **Discover:**
    - `sendLikeV2` adds `p_source` **only** for `daily_pick`, so Discover keeps working on servers without the package;
    - a `stale_pick` in Discover → "X is in your Matches today." + Next profile.
- **Chat (`app/chat.tsx`, `components/chat/LikeContext.tsx`):**
    - **like context** above the messages;
    - **suspended →** history stays readable, "Account unavailable" banner, input closed, no photo / profile link.
- **Chats list:** a suspended person's row reads "Account unavailable" (no photo).
- **`scripts/dev-backend/seed-dev-pool.mjs --verify`:** expected profile keys now include `photos`.
    - This fixes a regression from the Discover round, where `get_profile_v2` gained `photos` and the verify would fail.
- **`scripts/dev-backend/prepare-matches-phone.mjs`** (new, **not run**): prepares a **separate** synthetic phone account.
    - It creates or completes `tempa-matches-tester@tempa-test.example.com` through the normal V2 path, makes one mutual match with a synthetic pool member via `send_like_v2` from both sessions, and prints a sign-in code.
    - **It refuses to run** until `get_daily_picks_v2` exists on the target, and never uses the owner's phone account.

## 4. Tests

### Local replica (real PostgREST HTTP, real JWTs, synthetic users) — `supabase/proposed/tests/http_matches.test.mjs`

Result: **74 / 74**, three consecutive runs. The existing `http_v2.test.mjs` passes **210 / 210** in the same environment.

| Stage | Checks | What was verified |
|---|---|---|
| PERIOD | 5 | 11:59:59 vs 12:00:00 Istanbul; refresh_at = 09:00 UTC; same period → same pick; after 12:00 → new period, different pick |
| DAILY | 9 | pick eligible / unmatched (state new); featured mutual = oldest never-featured unmessaged match; pick ≠ mutual; no score / % / district; 3 reopens + 5 concurrent requests → same result, one stored row; signed-out refused; clients can't read the table or call the internal function |
| DISCOVER | 2 | today's pick not in Discover, both when Matches was opened first and when Discover was opened first |
| SOURCE | 11 | `daily_pick` for a non-pick → `stale_pick`, nothing spent; Discover-source like on today's pick → `stale_pick`; unknown source refused; **yesterday's pick → `stale_pick`** (having been featured on any day is not enough); today's pick → source `daily_pick` + period + exact photo id; one unit; same-request retry → original result, no second unit; card shows Like sent + note; Discover like = `discover`; 5-argument call = `discover` |
| MUTUAL | 11 | the pick likes back → match **immediately**; one accepted match; **no automatic message** from either comment; same card → `matched` with match id, mutual unchanged; chat context shows both likes (which photo / which answer + notes); first real message → Conversation started (pick card and featured mutual), kept for the period |
| ROTATION | 10 | talking matches never re-featured; never-featured first (oldest match first); then least recently featured; not-active (membership none) not featured; picks never repeated; no candidate → `pick_reason: none`; liked / matched never picks; a single match repeats the next day |
| HIDDEN | 4 | chat continues; the match can open the profile; others can't see it, not in Discover; never a pick or a featured mutual |
| SUSPENDED | 9 | chat `unavailable`; history readable; neither side can message; Chats row unavailable, no photo; no new likes; not in Discover / featured; **membership `none` ≠ suspended** |
| REMOVED | 8 | blocked pick → card hidden and **not replaced** in the period; blocked featured mutual → hidden; block / delete / unmatch → chat ended, out of Chats; never featured again |
| V1 | 5 | V1 direct likes still work; **V1 notes still become opening messages**; old likes keep `source` NULL; V2 direct writes still refused |

**Limits:**
- PGlite is a single session, so "concurrent" requests are serialised by the bridge. The duplicate guard is the primary key + per-user advisory lock + `on conflict do nothing`. True parallel transactions are not exercised here.
- Replica: Postgres 18 + PostgREST 13 (live: Postgres 17 + PostgREST 14).
- Storage signing isn't part of these checks.

### Local (app)

- `tsc` clean;
- `node scripts/onboarding-v2-checks/run.js`: new **`v2_matches_real` 23 / 23**; Matches preview **45 / 45** (now on the shared cards); Discover preview 85, Discover real 30, others unchanged;
- iOS dev bundle builds.

### Real services and phone

**Not run.** The package isn't on any real project. No phone test was done.

## 5. Open / blockers

1. **A real-service and phone test needs the package on a project:**
    - either a **separate** Supabase project — the owner creates it; `setup.mjs` / `TEST_ENVIRONMENT.md` describe it;
    - or an explicit owner decision to apply it to the shared one.
   Until then the phone keeps showing the previous V2 Matches list (fallback), and Discover / chat behave as before.
2. **Historic auto-seeded messages** (from V2 mutual likes before this package) can't be told apart reliably from real messages. They count as messages, so such pairs show Conversation started and aren't featured.
3. **Pick selection:** a temporary random rule (D67); scoring is still a separate open item.
4. **Activity:** like source is recorded but not shown yet (next round).
5. **Release blockers (unchanged):** production build = V1; DEV = live project; key rotation; `delete-account`; public bucket; advisor items.

## 6. Phone (after the package is on a test project)

**Command:**
1. `TEMPA_TARGET=dev node scripts/dev-backend/prepare-matches-phone.mjs` — refuses unless the package is present;
2. `~/tempa-p0/scripts/dev-backend/start-app.sh`, then sign in with the printed code as `tempa-matches-tester@…`.

Checks (≤ 5):
1. Matches shows "Daily picks · Refresh at 12:00", a real **Picked for you** card and a **You both liked** card (the prepared match). Close and reopen the app: same people.
2. Discover never shows today's pick.
3. Open the pick → comment on a photo → Send. The note stays in place; back on Matches the card says Like sent. Heart on another profile isn't possible (one like).
4. **Say hello** opens the chat with the like context on top and **no message**. Send one → back on Matches: Conversation started.
5. Chat list: no automatic message appears for the new match.

---

# Round 2 — stale_pick distinction, report fixes, LOCAL full Supabase (2026-10-09)

From `c10b18f`. The owner chose **no paid cloud project**: a local Supabase replaces it.

**Not done:** no merge, no deploy, no change to the shared DEV/live database. AI HQ, `~/tempa-p06` and the other local project (`terapi-yerel`) were not touched.

## 1. stale_pick vs Discover — verified, code unchanged

`send_like_v2` already behaved as decided. A new replica check (`http_matches` **76 / 76**) proves the three cases:
- an earlier day's `daily_pick` → `stale_pick`, no like / quota;
- a past pick that wasn't liked is in today's Discover and can be liked with source `discover` (one unit);
- liking today's pick from Discover → `stale_pick`.

D74's text was clarified accordingly (`beace81`).

## 2. Report and dates

The stray `EOF` + shell lines at the end of this file were removed. This report's date and D67–D74 were set to 2026-10-08. The migration file name is unchanged.

## 3. Local full Supabase

- **Setup:** `local-backend/` (project id `tempa-local`, ports 554xx; Studio / analytics / edge runtime / vector off) via `scripts/local-backend/setup.mjs`.
    - All 11 migrations applied cleanly on **real Postgres 17**: the live-schema snapshot plus every package, including the Matches package.
    - Separate containers and volumes; `terapi-yerel` kept running untouched on 543xx.
- **Seed:** `scripts/local-backend/seed.mjs`, synthetic only, the normal V2 path — real Auth codes, Storage uploads, onboarding RPCs, reviewer accept.
    - 6 İstanbul women, 1 Ankara woman, the phone tester and a second man;
    - the tester ↔ Asya mutual match was made via `send_like_v2` from both sessions (source checks applied).
- **App:** new `TEMPA_BACKEND=local` (`lib/backendConfig.ts`).
    - It accepts only `http://` loopback / private-LAN URLs and a non-live anon key; anything missing refuses to start, with no fallback.
    - `v2Enabled` is on; separate session storage key; badge "LOCAL · local:55421".
    - `app.config.js` passes `TEMPA_LOCAL_SUPABASE_URL` / `_ANON_KEY`. Production stays pinned to live.
- **Phone launcher:** `scripts/local-backend/start-app.sh`.
    - It needs the Mac's private Wi-Fi address, checks that the local API answers on 127.0.0.1 **and** on that LAN address (verified: `192.168.1.100:55421` → 200), prints a sign-in code, and starts Metro with `TEMPA_BACKEND=local` (and unsets the test-project variables).

## 4. Tests

| Run | Where | Result |
|---|---|---|
| `smoke_matches_local.mjs` | **local Supabase, real services, real parallel HTTP connections** | **18 / 18** in 8 of 9 runs; one run had 17 / 18 (the failing check wasn't captured — most likely the Realtime delivery wait; not reproduced in 8 further runs) |
| `http_matches.test.mjs` | local PGlite replica | 76 / 76 |
| `backend_config.check.mjs` | local | 28 / 28 (+9 local-target cases) |
| `local_launcher.check.mjs` (new) | local | 8 / 8 |
| `tsc`, onboarding / Discover / Matches checks | local | clean; unchanged counts; iOS dev bundle builds with the local env |

What the local smoke run covers:
- **12 parallel first `get_daily_picks_v2` calls** → all 200, the same pick, **exactly one** stored row;
- `refresh_at` = 09:00 UTC;
- today's pick not in Discover;
- **photo access:** the viewer signs the pick's private photo and downloads real bytes; a signed-out caller is refused;
- daily_pick like + comment;
- **3 parallel retries → one like**;
- like back → match immediately, **no automatic message**, card `matched`, chat context with both likes;
- the receiver **subscribes to Realtime** and **receives the first real message**, then the card shows `conversation_started`;
- **last like unit, two parallel sends → exactly one like**.

**Finding (pre-existing, not from this package; same on the shared project):**
- The private-photo read policy (`profile-photos-private read visible owners` → `can_view_profile_as_me`) uses the **V1** visibility rule, not V2 eligibility.
- So **an active member who is not eligible to see someone (e.g. another city) can still sign that person's photo if they know its path.**
- Paths are random and only handed out by visibility-checked RPCs, so the risk is low. But the rule is wider than the profile rule.
- **Decision needed:** tighten it to `v2_can_view_public_profile` for V2 owners. Check first that Likes you and chat photos keep working. Not changed in this round.

**Not tried on the phone.** In particular, whether the iOS dev client allows plain `http://` to the Mac's LAN address is unconfirmed (Metro itself uses LAN http, so it is expected to work).

## 5. Phone (local)

**Command:** `scripts/local-backend/start-app.sh`.
- Mac and phone must be on the same Wi-Fi.
- The first time, run `node scripts/local-backend/setup.mjs && node scripts/local-backend/seed.mjs` before it.

**On the phone:** if you're signed in, sign out. On the signed-out screen use **DEV · Test account sign-in** with the printed code; the badge must read **LOCAL · local:55421**.

Checks (≤ 5):
1. The badge reads LOCAL. Matches shows the daily line, a Picked for you card and Asya under You both liked. Reopen: same people.
2. Discover doesn't show today's pick; photos load.
3. In the pick's profile, comment on a photo → Send. The note stays; Matches shows Like sent.
4. Asya → **Say hello**: the chat opens with no message. Send one → Matches shows Conversation started.
5. If anything fails to load, note whether it's the first screen (network / http) or a specific step.
