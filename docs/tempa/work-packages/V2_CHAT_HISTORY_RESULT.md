# V2 chat — older history (result)

Date 2026-10-21 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `652e2ba` (clean, same as origin) · Author: Claude Code.
**Target:** tempa-local only. Branding worktree (`~/tempa-collab-prep`) not touched; no shared DEV / production, no reset, delete, merge or deploy.

## Behaviour

**First open (unchanged):** the newest 500 messages.
- Older history exists only if that page was full.
- A short or empty chat never makes an "older" query.

**Older pages:**
- **Query:** keyset backwards from the oldest message on screen on the total order **(created_at, id)**, 100 per page (`lib/chat/sync.ts` `loadBefore`): `created_at < c OR (created_at = c AND id < i)`, newest-first, then oldest-first for display.
- **No offset:** no shift when messages arrive; rows sharing one timestamp are split by id, never skipped or repeated.
- **Trigger:** only after the reader's **own** scroll (`onScrollBeginDrag`) brings the list within 400 pt of the top, so there is no chain of requests on open. The header button "Earlier messages" also loads.
- **`OlderPager`:** one request at a time. Nothing after the start is reached. A failure keeps the list and shows "Couldn't load earlier messages · Try again". A page that returns after a chat change or an ended chat is dropped.

**Merging:** the same `mergeMessages` as Realtime and the catch-up (one copy per id, time order). An older page, a new Realtime message and a catch-up can land in any order.

**Position (not phone-verified):**
- `maintainVisibleContentPosition={{ minIndexForVisible: 1 }}` (index 0 = the header) keeps the message being read in place when rows are added above.
- A new message or a catch-up still scrolls only when the reader is already at the end (unchanged rule).
- Photo bubbles have a fixed size from the stored width / height, so a photo loading later does not change the layout.

**Day separators, groups, avatars:** recomputed from the whole merged list on every render (`buildTimeline`), so page joins don't break them.

**"How it started":**
- Shown **once**, at the real start of the conversation.
- While older history remains, the header slot holds the "Earlier messages" control instead.
- In chats over 500 messages the card therefore appears only after the last page is loaded; it was at the top of the newest 500 before. It is never repeated per page.

**V1 impact:** the chat screen is shared. V1 chats also get older-history paging and the small "Earlier messages" header (V1 had no list header). No visual redesign.

No backend or access-rule change.

## Tests

**`node scripts/local-backend/smoke_chat_history_local.mjs` — 12/12 (real local services, the app's `lib/chat/sync.ts` + `merge.ts`)**

**Setup:**
- Fresh synthetic pair `tempa-local-hist-mvig27xe-a/b`, matched through the normal path (like + Match & chat).
- 1250 history messages, 12 of them sharing one timestamp across an older-page boundary.
- 3 new messages sent during a page load.
- Total: **1253 messages**.

**Results:**
- Empty / short chat: first page complete, **no older query**.
- First page 500, more history; then older pages until the start, with **no query after the end**.
- Older page + 3 new messages + catch-up at once: all merged.
- An injected failed page → error state, history kept → the retry loads the page.
- Chat switch while a page is in flight → its rows never reach the new chat.
- **Loaded 1253 / server 1253: 0 missing, 0 duplicates, the same order as the server** (created_at, id), including the 12-message tie.

**Note on test data:** clients may write only content / sender / receiver; `created_at` is not client-writable (a P0 rule, kept and asserted). The past-dated history was therefore written with the service role, **test setup only**. All reads used A's own session (RLS), and the new messages used B's session.

**Other checks:**
- `v2_chat_history` **18/18** (in-memory PostgREST-like keyset client): parallel triggers → one request; failure + retry; end → no query; chat switch drop; short chat; cursor; wiring.
- `run.js` all pass. Stale assertions in `v2_chat_layout`, `v2_chat_photos`, `v2_chat_realtime` and `v2_matches_real` were updated to the new header shape / third keyset query; same intent.
- `tsc` clean; LOCAL iOS export exit 0.

## Limits / open

- **Not phone-verified:** the on-screen scrolling (position kept while rows are added above; no pull-down by new messages during reading). Pure and service tests cannot show this.
- **Gap after a large catch-up:** if a catch-up ever hits its page cap (more than ~2000 missed messages), it shows the newest page. A gap between that page and the older history is not back-filled by older paging.
- **Still open (not closed by this package):**
  - phone test of a foreground message during a real Realtime re-establishment;
  - phone test of photo-URL refresh;
  - clean-up of unsent photo uploads;
  - pixel downscaling.

## Phone check (pending)

**Account:** the synthetic history pair, receiver A: `tempa-local-hist-mvig27xe-a@tempa-test.example.com` (1253 messages with B). Start Metro for it with `scripts/local-backend/start-app.sh <that email>`; it prints the code in the terminal. Reopen the app, sign out if needed, then "DEV · Test account sign-in".

1. Open the chat with "Histb". It opens at the newest message. Scroll up: "Earlier messages" loads with a small spinner, and the message you were looking at **stays in place** (no jump).
2. Keep scrolling to the very top. Pages stop at the start, and the "How it started" card appears there **once**.
3. While reading older messages, it must not pull you down. (The other account isn't on the phone; skip a live message if you prefer.)
