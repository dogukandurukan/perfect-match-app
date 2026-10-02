# V2 — Chats aligned to V2 access rules + DEV / live build difference (result)

Date 2026-10-02 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `e4129bf` (clean, same as origin) · Author: Claude Code.
Target: perfect-match-dev only; AI HQ not touched.

Not done (out of scope): no production deploy, no deletion of `get_top_matches`, no scoring change, no change to Discover order / like quota / premium / refresh window, no messages deleted, no server schema change.

The phone test account `13adb65c-…` was not touched. It still has its accepted match with "Test" (chat open), 1 message, 0 suggestions, 3 likes and 0 blocks.

## 1. Chats list from the server's authorised, current relationships

**Before:**
- `messages.tsx` merged every message I had sent or received with every `matches` row where `chat_opened = true`, then dropped people missing from `profile_cards`.
- Blocked / deleted people disappeared, but **unmatched (`passed`) chats stayed**, and the list was built on the client.

**Now, on the V2 backends:**
- **Chats list:** comes only from `get_my_matches_v2` (server; SECURITY DEFINER; the same source as Matches). A chat is listed only when:
    - the caller is a participant;
    - the match is `accepted` with the chat open;
    - there is no block either way;
    - neither account is deleted.
- Name, photo, last message, time and unread count all come from that one call.
- Nothing is deleted: messages of ended chats stay in the database (checked).
- **Unread badge** (`lib/unreadMessageCount.ts`): counts only active conversations with unread messages, from the same RPC, so the badge matches the list.
- **Chat screen** (`app/chat.tsx`):
    - no history is shown until the server chat state (`get_chat_v2`) has arrived, so an ended or blocked chat never flashes its messages;
    - when the server says the chat is not active (unmatched, blocked, deleted, or not your match):
        - the screen shows "This conversation has ended / This chat is no longer available";
        - input is off;
        - the header photo and profile link are removed;
        - "View profile" is hidden from the ⋯ menu.
- **Open screen / cache:** an open chat re-reads the server state on focus and every 20 s. When the chat ends, the screen:
    - drops the loaded messages;
    - drops the header photo;
    - drops the cached signed photo URLs for that person (`forgetProfilePhotoUrls`);
    - refreshes the unread badge.

  Chats and Matches re-read on focus. Unmatch from the ⋯ menu returns to the list.
- **Live (V1) build:** unchanged — it keeps the old list code.

## 2. DEV / live build difference (open item affecting the V2 release)

The legacy screens are selected by **one switch**, `v2Enabled`:

1. **`app.config.js`:**
    - when `process.env.EAS_BUILD_PROFILE === 'production'`, it forces `extra.backend = { env: 'live' }`;
    - every other build / Metro session uses `TEMPA_BACKEND` (`dev` via `scripts/dev-backend/start-app.sh`);
    - a missing value refuses to start.
2. **`lib/backendConfig.ts` `resolveBackend`:** `live` and `dev` both resolve to the **same** Supabase project (`fyqwjduzpnjuxqsloxih`).
3. **`lib/supabaseClient.ts`:** `v2Enabled = env === 'dev' || env === 'test'`, so it is **false in every EAS production build**.

| Where | With `v2Enabled` false (production build today) |
|---|---|
| `app/(tabs)/matches.tsx` `MatchesTab` | renders `LegacyMatchesTab` → `get_discovery_cards` → **`get_top_matches` (scored, %)**, `upsert_match`, "Plan a date" invites |
| `app/(tabs)/index.tsx` `loadFeed` | V1 feed `get_discovery_cards` for everyone (the V2 candidate path needs `v2Enabled && v2 member`) |
| Sign-up / Chats / chat / Activity | V1 register; old Chats list; V1 meetup bar; invite cards shown |

**Consequence (blocker for a V2 release):** a production build made today ships the **V1 product**. Because it uses the same database, it would also **partly break**:
- new pre-match invites are refused by the server (`invites_retired`);
- the V1 chat meetup bar's direct writes are refused (`use_date_proposals`).

**Needed before release (open):**
- decide how production selects V2 (e.g. pin `dev` → a proper `v2` / production env value, or a server-side flag);
- retire the legacy screens;
- re-check that no production path reaches `get_top_matches`.

Nothing was changed for this in this round.

## 3. Audit findings kept as open items

- **Photo / prompt likes:** the `likes` table accepts `target_type` / `target_key` / `note`. The feature is **not ready**:
    - no stable content id for V2 photos / prompts;
    - `target_key` is unchecked free text — **no server check that the target belongs to, and is visible on, the likee**;
    - no V2 UI.
- **Post-approval profile editing:** not opened. The server still allows edits only in `draft` / `changes_requested`. Keeping the `profiles` name / photo copies current belongs to the next integration.
- **The 7 older synthetic "Test" accounts:** kept as they are (not deleted, not hidden); some may belong to the ongoing phone test.
- **Magic Link / real e-mail sign-in:** **waiting for a phone test and an e-mail template check.**
- **Separate open items, not mixed into this work:** key rotation, push, `delete-account` redeploy, old public photo clean-up.

## 4. Tests — real Chats fix (real services + local)

| Run | Where | Result |
|---|---|---|
| `smoke_match_chat_v2.mjs` (separate synthetic pair `cca06005-…` / `67acc178-…`, outsider `2344b540-…`; **not** the phone account) | **real services** | **56 / 56** |
| `tsc --noEmit` | local | clean |
| Onboarding / profile / suggest-a-date logic · backend selection | local | 45 · 69 · 56 · 6 · 10 · 19 |

New checks in the real-service run:
- the Chats source shows the last message and the unread count;
- a deleted account leaves the list, and its chat reads as inactive;
- after unmatch, a direct chat link reads as inactive;
- after unmatch, the messages are kept in the database.

Already covered there: block and unmatch remove the pair from the list, and refuse messages and suggestions.

**Not verified on the phone:** the Chats list, the ended-chat screen and the badge on the device.

## 5. Matches DEV design preview (fixture-based) — not started

**Status: waiting.** The brief for this preview — the separate, local-fixture Matches preview with two large-photo cards and the flow states — is **not in this session or in the earlier session logs I can read**, so I did not invent a design. Once you paste that brief again, I build it:
- as a separate DEV route with local fixtures;
- with no real likes or messages;
- with no scoring;
- with no change to Discover order, quota, premium, weights or refresh window.
EOF
git add -A app lib scripts docs/tempa/work-packages/V2_CHATS_ALIGNMENT_RESULT.md && git status --short && git commit -q -m "fix(v2): Chats list and unread badge from server-authorised active matches

Chats uses get_my_matches_v2 on V2 backends (no unmatched/blocked/deleted
pairs; messages kept). Chat screen waits for the server state, ends cleanly
(no history flash, no header photo/profile link, cached URLs dropped, badge
refreshed). Report documents the production build switch (EAS production →
live → v2Enabled=false → legacy Matches / get_top_matches) as a V2 release
blocker. Real services: match-chat 56/56.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q && git log --oneline -1