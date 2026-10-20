# V2 chat — intermittent Realtime timeout: root cause and fix (result)

Date 2026-10-20 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `bcd4ee0` (clean) · Author: Claude Code.
**Target:** tempa-local only. Nothing on shared DEV / production or other local projects; no reset, merge or deploy; no service restart used as a fix.

## Root cause (measured, timestamped)

The local Realtime server shuts its tenant / replication down about **every 10 minutes after it starts**:
- `Rebalancing Tenant database connection for a closer region` → `Tenant realtime-dev has been terminated: {:shutdown, :rebalancing}`, or
- `Rebalancing Postgres Changes replication for a closer region`.

Observed at 12:01:52, 12:32:20, 12:43:02 and 12:53:02 UTC; each is ~10 min after a start.

The next join **re-creates the logical replication slot** and starts streaming. A row committed before the slot exists is never in it, so it is **never delivered**.

`SUBSCRIBED` (the phx join reply) is **not** the moment the stream runs. The server's system message `postgres_changes · ok · "Subscribed to PostgreSQL"` is.

**1. First subscription on a cold tenant** (`probe_realtime_local.mjs immediate`, 12:33:03 UTC):

| Time | Who | Event |
|---|---|---|
| .799 | client | `SUBSCRIBED` |
| .891 | server | `Tenant realtime-dev is initializing` |
| .962 | DB | message committed (`created_at`) |
| .985 | server | `Create replication slot …` (after the commit) |
| .994 | server | `Starting stream replication` |
| 06.250 | client | system `postgres_changes ok` (2.4 s after SUBSCRIBED) |
| — | client | **not received** within 12 s |

The same probe on a **warm** tenant: system ok 4–16 ms after SUBSCRIBED, **3/3 received**.

**2. Disconnect / reconnect while subscribed** (`rt_long`, A subscribed for 13 min, B sending every 5 s):

| Time | Event |
|---|---|
| 12:43:02.064 | server: tenant terminated (rebalancing) while A was connected |
| 12:43:04.702 | message #105 committed |
| 12:43:06.326 | client: system `postgres_changes ok` again (automatic re-join) |
| — | **#105 never delivered**: 155 sent, 154 received, the only miss is #105 |

The client saw **no error status**: the channel stayed "SUBSCRIBED". The only signal of the gap is the repeated `postgres_changes ok`.

**3. Waiting for the real readiness signal on a cold tenant** (`probe_realtime_local.mjs system`, 12:58 UTC):

| Time | Who | Event |
|---|---|---|
| 11.775 | server | initializing |
| 11.873 | server | slot created |
| 11.885 | server | stream started |
| 12.726 | client | system ok |
| 12.900 | DB | message committed |
| — | client | **received** |

The Mac and container clocks differ by ≈ 80 ms.

**4. App-style catch-up on a cold tenant:** see "Verification" below.

**Classification:**

| Kind | Finding |
|---|---|
| **Test** | Both smokes (`smoke_activity_local` "A receives it over Realtime", `smoke_matches_local`) inserted right after `SUBSCRIBED`. On the first run after a pause (cold tenant) that row was lost: the "1 in ~5 runs" flake. The earlier A/B (2026-10-15, 10/10) ran on a warm tenant, so it could not show it. |
| **Client** (`app/chat.tsx`) | `.subscribe()` without status / system handling, and messages loaded **once** when the screen opens. Missed: the cold-start gap, every rebalancing gap (cases 1, 2), and messages sent while the app was in the background (nothing is replayed after a reconnect). They stayed invisible until the chat was reopened. |
| **Service** | The ~10-min tenant / replication rebalancing and the lazy slot creation are local Realtime behaviour (the region rebalancing of the CLI image). Not changed: the client must be robust to it, and a hosted project can drop sockets too. The earlier Auth / Storage → Postgres timeouts (2026-10-19) are a separate, still unexplained issue. |

**Not the cause:** the chat-photos `messages` insert policy change. Realtime authorises with the unchanged SELECT policy, and the flake predates it (2026-10-14).

## Fix

**Client, `app/chat.tsx` (V1 and V2 chat screen):**
- **Catch-up from the server** on every `postgres_changes ok` system message: the first join **and** every automatic re-join.
- Also when the app returns to the foreground (`AppState` → `active`).
- Catch-ups never overlap: one more run if triggered meanwhile.
- Fetches **merge, never replace** (`lib/chat/merge.ts`, pure):
  - de-duplicated by id, time order;
  - an unchanged list returns the same array, so no re-render and no scroll;
  - a known row is updated in place (e.g. `read_at`).
- New rows scroll into view **only if the reader is already at the end** (the existing `scrollToEndIfFollowing` rule). Someone reading older messages is not pulled down.
- A failed catch-up keeps the visible chat; only the first load shows the error state.
- The realtime handler still de-duplicates by id.
- Photo and date-suggestion flows are unchanged.

**Tests:**
- `smoke_activity_local` and `smoke_matches_local` now wait for the server's `postgres_changes ok`, not `SUBSCRIBED`, before sending.

**Probe kept in the repo:** `scripts/local-backend/probe_realtime_local.mjs` (`setup` / `immediate` / `system`).
- Synthetic pair, kept in `.test-backend/realtime-probe-pair.json` (git-ignored).
- To see whether the tenant was cold, compare its timestamps with `docker logs --timestamps supabase_realtime_tempa-local`.

## Verification

**Cold-window runs**, each started right after a logged `Rebalancing … / terminated`, with the server's `initializing` / `Create replication slot` lines inside the run:

| Run | When (UTC) | Result |
|---|---|---|
| `probe … immediate` (old behaviour) | 12:33:03 | **lost** (slot created 23 ms after the commit) |
| `probe … system` (wait for readiness) | 12:58:11 | **received** |
| app-style catch-up probe (real `lib/chat/merge.ts`, insert right after SUBSCRIBED) | 13:08:30 | Realtime **did not** deliver (commit .925, stream .928). The catch-up on `postgres_changes ok` added it: in the list **exactly once**, sorted. |
| `smoke_activity_local` (now waits for readiness) | 13:18:33 (tenant terminated 13:18:30, re-initialised 13:18:43 during the run) | **45/45** |

One run is not counted: at 13:09 a watcher matched the old 13:08:10 shutdown, so the smoke ran on a warm tenant. It was repeated in the real cold window above.

**Warm runs:**

| Run | Result |
|---|---|
| `smoke_activity_local` | 45/45 |
| `smoke_matches_local` | 18/18 |
| `smoke_chat_photos_local` | 24/24 |

**Static checks:**
- `node scripts/onboarding-v2-checks/run.js`: all pass; new `v2_chat_realtime` **16/16** (merge rules, catch-up wiring, foreground, no overlap, merge-not-replace, scroll only when following, smokes wait for readiness).
- `tsc --noEmit`: clean.

**Test data:**
- One synthetic probe pair (`tempa-local-rt…-a/b`, match `e10808c0-…`, ≈ 170 probe messages "rt-probe …" / "rt-long …" / "rt-app …"), kept.
- The fresh accounts of each smoke run.
- The Mert / Defne phone accounts were not touched.

## Not proven / open

- **App returning from the background:**
  - The catch-up on `AppState → active` is in place, and the reconnect path behaves like case 2 (re-join → `postgres_changes ok` → catch-up).
  - The real iOS suspend / resume can't be simulated in Node: **phone check needed**.
- **The ~10-min rebalancing itself** is a property of the local Realtime image. Not changed; the fix makes the client independent of it.
- **A hosted project** may not rebalance this way, but dropped sockets and late joins happen there too; the same catch-up covers them.
- **Restarting the service** is not a fix and was not used.

## Phone check — background resume (owner, 2026-10-20, one phone, LOCAL)

**Setup:**
- Phone signed in as Defne (`e40b19ac-…`), running the build marked `chat-rt1` (commit `7b0c0d0`, Realtime catch-up included).
- Chat with Mert open and scrolled up to older messages, then the app put in the background.

**Sent by Claude Code** from the existing local Mert account (`3d1525b2-…`, own session, RLS applied; no new account):

| # | Message id | `created_at` | Text |
|---|---|---|---|
| 1 | `c7ca5042-2d5f-4dd9-b5be-de7dfa4e84ed` | 15:57:47.134 UTC (18:57:47 TR) | "BG-TEST 1/2 — Mert’ten arka plan mesajı" |
| 2 | `0ff9205e-a40a-4d53-8a57-6f4e38601a25` | 15:57:50.245 UTC (18:57:50 TR) | "BG-TEST 2/2 — ikinci arka plan mesajı" |

**Owner's result:** "evet geldi test mesajları". Both messages appeared after returning to the app.

**Database, read-only:**
- Both messages got `read_at = 15:58:56.366 UTC` at the same instant, ~66 s after sending.
- That is consistent with the chat loading both at once when it came back to the foreground and marking them read.
- Exactly 2 BG-TEST rows exist.

**Owner's follow-up confirmation:**
- Each message appeared **once** on screen.
- The **scroll position was kept** while reading older messages (no pull-down).
- The badge read **`chat-rt1`**.

**Still inferred, not proven:** whether they arrived through the foreground catch-up or a Realtime re-join. Both were marked read at the same instant, which fits one catch-up fetch.

**Not yet phone-verified:** a message arriving while the chat is in the **foreground** during a real Realtime re-establishment. Local automated tests do not replace this check.

The ≥ 10-min idle check and the two-phone checks below are still open.

## Phone check (remaining)

1. Mert and Defne on two phones, chat open on both.
2. **Background:** Defne puts the app in the background (or locks the phone) for ≥ 1 min. Mert sends 2 messages. Defne returns:
   - both messages appear without leaving the chat;
   - nothing twice;
   - she is not pulled down if she had scrolled up.
3. **Idle ≥ 10 min with the chat open** (the local tenant rebalances): Mert sends a message, and it appears on Defne's open chat within a few seconds.
4. Photo and date-suggestion messages still appear on the other side.
