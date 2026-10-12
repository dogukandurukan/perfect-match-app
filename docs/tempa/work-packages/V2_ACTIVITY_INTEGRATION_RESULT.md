# V2 Activity — real integration (Activity → profile → Match & chat → chat) — result

Date 2026-10-12 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` · Author: Claude Code.

Decisions: **D82–D86** in `docs/tempa/DECISIONS.md` (on top of D75–D80).

**Not done:**
- Nothing applied to the shared remote project `fyqwjduzpnjuxqsloxih` (DEV = live). No remote reads or writes in this round.
- No merge, no production deploy. Production builds (V1) never reach the new code.
- No DB reset, no bulk delete. The pending local auth user `e0a769ce` (owner's real e-mail, no profile) was **not** touched.
- The phone account `13adb65c`, the Matches tester, the seed pool and AI HQ were not touched. `~/tempa-p06` not touched.
- **Not tried on a phone.** No device restart test was done (see §6).

## 1. Environment (verified before any write)
- Local Supabase **`tempa-local`**: containers `supabase_*_tempa-local`, API `127.0.0.1:55421`, DB `127.0.0.1:55422`, Postgres 17.11. The container's `com.supabase.cli.project` label = `tempa-local`.
- All SQL went through `docker exec supabase_db_tempa-local psql`, so it reached that container and nothing else. `terapi-yerel` (543xx) was left running and untouched.
- Scripts use `scripts/local-backend/_local.mjs`, which refuses anything but `http://127.0.0.1:55421`.

## 2. Server package — `supabase/proposed/20261012090000_v2_activity_accept.sql`
Applied to tempa-local in **one transaction**. It was recorded as local migration `00000000000020` and added to `setup.mjs` so a future local setup includes it. It is not wired into `apply-dev.mjs` (a check enforces this). Existing local data was kept (35 likes before → still there).

Reuses the existing tables and functions — no second match, chat or notification system:

| Piece | What it does |
|---|---|
| `likes.seen_at` (new column) | Read state of an incoming like (D83). |
| `get_my_activity_v2()` | One snapshot: **pending** likes to me (`sent`, liker still visible under V2 rules — `v2_can_view_public_profile`, not suspended, **no active match**), plus **matches** (`get_my_matches_v2`). Both come from one statement, so a person is never both. Identity follows the existing premium rule (D84). |
| `mark_like_seen_v2(like)` | Recipient only; sets `seen_at` once and nothing else. |
| `accept_like_v2(like)` | "Match & chat" (D82): recipient only (others get `not_found`); pair advisory lock (same key as `send_like_v2`); existing active match → returned as `replayed`; else one match row upserted (accepted, chat open, `mutual_like`; never revives `passed`), incoming like → `matched` + `match_id`; the existing `mutual_match` notification + event. **No reverse like, no message, no quota.** Any inconsistency raises and rolls back. |

Grants: all three are revoked from `public`/`anon` and granted to `authenticated`; signed-out calls get HTTP 401.

## 3. App changes
| File | Change |
|---|---|
| `app/(tabs)/notifications.tsx` | On V2 backends it renders `V2ActivityScreen`, falling back to the previous screen (renamed `LegacyNotificationsScreen`, unchanged) when the server lacks the package — e.g. the shared DEV project today. V1 / production unchanged. |
| `components/activity/V2ActivityScreen.tsx` (new) | The approved single feed. It has separate loading, **error with retry** (a failed refresh keeps what is on screen; an error is never shown as an empty list), empty, and locked (non-premium count) states. Large card → profile; match row → existing chat. It hides the native header only while it is in use. |
| `components/activity/ActivityFeedItems.tsx` (new) | `InterestCard`, `MatchRow`, `InterestContext` — the same visual spec as the approved preview. |
| `app/v2/activity-profile.tsx` (new) | Full V2 profile (shared `DiscoverProfileItems`, `readOnly`) with the liked content and full comment after the main photo. Exactly **one** button: **Match & chat** → `accept_like_v2` → the existing `/chat` opens (`replace`, so Back returns to Activity); once matched it reads **Open chat**. Opening the profile marks only this like read. While a request is in flight there is no second one. On failure an inline error appears, nothing looks matched, and the same button retries (the server returns the same match). |
| `lib/activity/activityV2.ts`, `lib/activity/feed.ts`, `lib/activity/copy.ts` (new) | RPC client (unsupported-server detection via PGRST202); pure feed (one person once, match row wins, newest first); shared copy. The DEV preview now re-exports the same copy. |
| `app/chat.tsx`, `components/chat/LikeContext.tsx` | D79 / D85: V2 chat shows **"How it started"** (whole-profile like included) and **"Say hello to {name}" / "Send a message whenever you like."**. V1 text unchanged. Messages still use the existing insert / Realtime / `read_at` path. |
| `scripts/local-backend/*` | `smoke_activity_local.mjs` and `prepare-activity.mjs` are new. `login-code.mjs` and `start-app.sh` take an optional **synthetic** e-mail, with the Matches tester as the default. |
| checks | New `v2_activity_real.check.js` (33 checks). One preview check was updated: it pinned the old untitled chat call, which D85 intentionally changes. |

The DEV design preview (`app/dev/activity-preview.tsx`) stays a separate in-memory preview; no persistence was added to it.

## 4. Tests

### Real services on the local Supabase — `node scripts/local-backend/smoke_activity_local.mjs`
**40 / 40, in 4 consecutive full runs** after one fix in the test itself (see below). Each run uses fresh synthetic accounts: A, D and E like B, and C is an unrelated third account.

| Area | Verified |
|---|---|
| Incoming | photo like + comment and answer like + comment via `send_like_v2`; whole-profile like **without** comment (service role — the whole-profile heart, D81, isn't built yet) |
| Premium rule | non-premium: count 3, no identities; premium (local data): 3 cards, one per person, with liker identity, my liked photo / answer, comment; no comment → `null` |
| Photos | B signs the liker's private photo and downloads real bytes |
| Profile open | full profile; `mark_like_seen_v2` marks **only** that like; loading the list twice marked nothing else; **no match** after open + back |
| Authorization | liker and third account can't accept or mark someone else's like (`not_found`, nothing written); signed-out → 401 |
| Match & chat | **5 parallel HTTP requests → all ok, one match id, created once**; one accepted row, chat open; **0 messages**; incoming like linked; **no reverse like**; daily quota and `daily_views_count` unchanged; retry after "lost response" → same match; `mutual_match` notification once per side |
| Feed | A's card became a match row (no conversation yet); A sees the match too |
| Chat context | `get_chat_v2`: one like, from them, with the comment and photo (context, not a message) |
| Third account | no chat context, can't send as A or message B, can't change the match, sees none of their messages |
| First message | B → A insert ok; **A receives it over Realtime** |
| "Restart" (new sessions) | A's new session reads the message (unread) → marks it read → another new session sees `unread 0`; B's new session: same match, "conversation started", no pending card; other cards still unread |
| Existing rules | blocked liker: card gone, accept refused, nothing written; profile like → Match & chat works; after `unmatch_v2` a repeated Match & chat **does not revive** the match and the row leaves the feed |

The first run had 39/40. The Realtime check failed because the test subscribed on the onboarding client while sending another session's token. An isolated run showed delivery works with the app's pattern (one client, its own session) both immediately and after a delay. The test was changed to that pattern; the app itself was not changed for this.

### Regression
- `smoke_matches_local.mjs`: **18 / 18** (Matches daily picks + Discover likes, including the last-unit race). It prints the known storage finding again (V1 rule on private photos), which is unchanged and pre-existing.
- `node scripts/onboarding-v2-checks/run.js`: all suites pass — Activity real **33/33**, Activity preview 51/51, Discover preview 85, Discover real 30, Matches preview 45, Matches real 23/23, others unchanged.
- `scripts/p0-checks/*`: all pass (launcher 8/8).
- `npx tsc --noEmit`: clean.
- The iOS dev bundle exports with the LOCAL backend config and contains the new RPCs, route and copy.
- Not re-run: the PGlite replica suites (`http_*.test.mjs`). The package only adds a column and new functions; no existing function was changed.

## 5. Phone test (owner) — normal Activity tab, two synthetic accounts
Prepared on tempa-local (re-runnable; `--set p2` makes a fresh set after a round is used up):

| Account | Role |
|---|---|
| `tempa-activity-p1-receiver@tempa-test.example.com` (Mert) | sign in first; premium in local data |
| `tempa-activity-p1-defne@tempa-test.example.com` (Defne) | liked Mert's photo: "Where was this taken?" |
| `…-p1-ece@…` (Ece) | liked his answer: "Count me in — which simit place is the best one?" |
| `…-p1-zeynep@…` (Zeynep) | whole-profile like, no comment |

Steps (Mac and phone on the same Wi-Fi; Docker running):
1. In a terminal: `cd ~/tempa-p0 && scripts/local-backend/start-app.sh tempa-activity-p1-receiver@tempa-test.example.com`. It prints a one-time code.
2. On the phone, open the dev client. If you are signed in, sign out. On the signed-out screen tap **DEV · Test account sign-in** and enter the code. The badge must read **LOCAL · local:55421**.
3. Open **Activity**. You should see 3 large cards: Defne ("Liked your photo" + quote + your photo), Ece ("Liked your answer" + your answer + quote) and Zeynep ("Liked you", no quote).
4. Tap **Defne**: her full profile opens with the context under the main photo. Go back. She is still a card and her new-dot is gone.
5. Open Defne again → **Match & chat**. The empty chat opens with **How it started** and **Say hello to Defne**, and nothing is sent. Go back without writing: Defne is now **"You and Defne matched"**, with no card.
6. Tap the row: the same chat opens. Send **"Hi"**. Back on Activity the row reads "Conversation started".
7. Fully close the app (swipe it away) and reopen it: same row, same message.
8. Other side: stop Metro (Ctrl-C), run `scripts/local-backend/start-app.sh tempa-activity-p1-defne@tempa-test.example.com`, sign out on the phone, then sign in with the new code via DEV · Test account sign-in. Defne's **Chats** (and Activity rows) show the match with Mert's "Hi".
9. Optional: Zeynep → Match & chat (profile like without comment); Ece → leave pending.

## 6. Verified vs not verified
- **Verified on real local services (automated):** everything in §4, including persistence through brand-new sessions. That simulates a restart at the server level.
- **Not verified:** anything on a phone — layout, the Activity tab render, profile → chat navigation (`router.replace`), keyboard, the real chat's new empty / "How it started" look, Realtime on the device, and a **real app close-and-reopen**.
- **Simulated only:** the whole-profile like ("Liked you") is written with the service role, because the whole-profile heart (D81) is not built.

## 7. Remaining blockers / open items
1. **Premium visibility for V2 Activity** (D84) is still a product decision; local accounts are premium in data only.
2. **Match-row lifetime** in Activity (D86) is not decided.
3. **Tab badge:** unseen likes are not counted in the Activity tab badge (`lib/unreadNotificationCount.ts` is unchanged).
4. **`mutual_match` notification text** is still the V1 Turkish line (as before); Activity doesn't show notifications rows.
5. **Private-photo read policy** still uses the V1 rule (pre-existing, a decision is needed).
6. **Live:** the Daily-picks and Activity packages are on no shared project. On DEV / live the app falls back to the previous Activity and Matches screens.
7. **D81** (Discover whole-profile heart / swipe / "It's a match!") is not built. Until then a real "Liked you" card only comes from V1 data or the test script.
