# V2 Activity — unseen-like tab badge (result)

Date 2026-10-21 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` · Author: Claude Code.
**Target:** tempa-local only; branding worktree not touched. No schema, RLS or server-function change.

## What existed

**Server, from the Activity package (D82 / D83):**
- `likes.seen_at`, written only by `mark_like_seen_v2` (the recipient only).
- `get_my_activity_v2`: pending incoming likes with `seen`, under the V2 visibility rules. The list is returned only to premium users (D84); `pending_count` counts all pending likes, seen or not.

**App:**
- The profile opened from Activity already called `mark_like_seen_v2`, and the list never marked anything.
- **The tab badge ignored likes.** V2 showed V1's unread-notifications dot. V2 never marks those rows read, so the dot could stay on with nothing to see (D83 noted: "the tab-bar badge does not count unseen likes yet").

## Behaviour now (V2; V1 keeps its dot)

**Badge:**
- Shows the **number of pending incoming likes the user can see that are not opened yet**: `unseenLikeCount`, based on `seen=false` and not matched.
- **0 → no badge.**
- **Without premium the badge is 0.** Identities are hidden (D84) and no like can be opened, so a count there could never clear. The in-Activity "N people like you" teaser is unchanged.
  - This follows "likes the user can see". It is a **product point to confirm**.
  - The alternative needs a server field (`unseen_count` in `get_my_activity_v2`) plus a decision on how non-premium users would ever clear it.

**When the count changes:**
- Opening the Activity list marks nothing.
- Opening the liker's **full profile** marks that like seen on the server, then the badge refreshes.
- **Match & chat** → the like is no longer pending → refresh.
- Existing removals (block / unmatch, eligibility) take the like out of the server list → the next refresh drops it.

**Refresh events (no polling; `likes` is not on the Realtime feed):**
- any other tab coming into view;
- Activity's own load (published from the same snapshot, no second request);
- the app returning to the foreground;
- sign-in / account change.

**`ActivityBadgeStore` (pure):**
- An older response finishing late, or a response for another account, is dropped.
- An account change clears the previous account's count at once.
- A failed refresh keeps the same account's last count.

## Tests

`node scripts/local-backend/smoke_activity_badge_local.mjs` — **11/11**, on real local services with the app's count rule.
- **Accounts:** fresh synthetic `tempa-local-badge-mvihnptu-*`: R (premium in local data), R2 (not premium), likers L1–L4.

| Step | Count |
|---|---|
| No likes | 0 |
| Three likes | 3 |
| Activity list loaded twice | **3** (listing marks nothing) |
| Another user tries to mark R's like seen | refused; still 3 |
| R opens L1's profile | **2** |
| Match & chat with L2 | **1** |
| R blocks L3 | **0** |
| A new like from L4 | **1** |
| A fresh R session | **1** (same as the server) |
| R2 (not premium), 1 pending like | `pending_count` 1, **badge 0** |
| R and R2 side by side | each sees only its own count |

**Other checks:**
- `v2_activity_badge` **18/18**: count rule, store rules (stale / account / failure / sign-out), wiring (V2 number badge vs V1 dot; listing marks nothing; seen → refresh; Match & chat → refresh; foreground / auth / tab focus; no polling).
- `v2_activity_real`: one assertion updated, because Match & chat now refreshes the badge before opening the chat.
- `run.js` all pass; `tsc` clean; LOCAL iOS export exit 0.

**Synthetic data:** 6 accounts, 5 likes, 1 match, 1 block (all in this smoke). The Mert / Defne data was not changed.

## Not verified / open

- **Phone:** the badge on screen (below).
- **Live update:** a new like while the app stays on the **same** tab appears on the next refresh event (tab change, foreground). There is no live push: `likes` is not on Realtime, and polling was not added.
- **Product decision:** the badge for non-premium users (see above).

## Phone check (pending)

**Account:** `tempa-local-badge-mvihnptu-r@tempa-test.example.com` (1 unseen like, from "Deniz"). Start Metro with `scripts/local-backend/start-app.sh <that email>`; it prints the code. Reopen the app, sign out if needed, then "DEV · Test account sign-in".

1. After signing in, the Activity tab shows **1**. Open Activity: it still shows **1**.
2. Tap Deniz's card (her full profile opens) and go back: **no badge**.
3. Switch back to your own phone account: its own count (or no badge) is shown, never this account's 1.
