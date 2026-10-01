# V2 — match → chat → date suggestion (result)

Date 2026-10-01 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `d9bb364` (clean, same as origin). Author: Claude Code.
Target: perfect-match-dev only. AI HQ, personal accounts and the onboarding design are not touched.
Not done (out of scope): profile-edit policy, Magic Link, key rotation, `delete-account`, file clean-up, paid services, merge.

**Product rule implemented:** mutual like → one match + open chat → either person may suggest a date from the chat → the other side accepts, suggests another time, or says "Not now". There is:
- no invitation before a match;
- no "Ready to meet" stage;
- no pop-up, message count or waiting period;
- nothing that stops people moving to Instagram / WhatsApp.

## 1. What existed (reused)

- `handle_mutual_like` (likes trigger): a mutual like creates or upgrades exactly one `matches` row to `accepted` + `chat_opened`, seeds notes as first messages, and writes `mutual_match` notifications. **Kept as is.**
- `messages` RLS: messages only with an accepted match and no block.
- Chat "Suggest a meetup" sheet: suggested time chips, a custom date / time picker, an optional place. **Reused as the "Suggest a date" sheet.**
- The old suggestion lived in four `matches` columns (`meeting_at`, `confirmed_place`, `meetup_proposed_by`, `meetup_confirmed`), written directly by the client. The P0-A guard only checked "you can't confirm your own".

  Gaps found:
  - an ended (passed) match with an open chat could still get a suggestion;
  - every action also wrote a chat message (a double tap duplicated it);
  - there was no history of counter-offers.

## 2. Server (`supabase/proposed/20261001120000_v2_match_chat_date.sql`, applied to dev via `apply-dev.mjs matchchat`)

**New table `date_proposals_v2`:**
- one row per suggestion: pending / accepted / declined (Not now) / countered / cancelled;
- a counter links back with `reply_to`;
- at most **one pending suggestion per match** (partial unique index);
- `unique (proposed_by, request_id)` makes retries idempotent;
- clients may only read rows of their own matches; every write goes through the RPCs.

**RPCs** (SECURITY DEFINER; all refuse unless the caller is a participant of an *active* chat — accepted, chat open, no block either way, neither account deleted):
- `propose_date_v2(match, time, place, request_id)`:
    - the time must be in the future, at most 120 days ahead;
    - if one is already pending: `proposal_pending` (yours) or `reply_to_pending` (theirs);
    - the same request id returns the same row (`already: true`).
- `respond_date_v2(proposal, accept | decline | counter, …)`:
    - never on your own suggestion (`cannot_respond_own_proposal`);
    - only while pending;
    - a repeat of the same answer returns the current state.
    - Accept also writes the agreed plan onto the match (the existing reminder / check-in jobs read those columns) and resets the reminder flags.
    - Counter creates a new pending suggestion, which in turn needs the other side's acceptance.
- `unmatch_v2(match)`:
    - status `passed` for both;
    - cancels a pending suggestion;
    - idempotent; deletes nothing.
- `get_my_matches_v2`, `get_my_date_plans_v2`, `get_chat_v2`:
    - explicit, minimal fields: first name, main photo path, last message, unread count;
    - no score, percentage or reason fields;
    - blocked, ended and deleted matches are filtered out on the server.

**Real events:** `notifications` rows of type `date_proposed` ("suggested a date" / "suggested another time") and `date_accepted`. "Not now" sends no notification.

**Guard (`guard_match_client_writes`):**
- once a chat is open, the date columns change only through the RPCs (`use_date_proposals`);
- **new invitations from clients are refused** (`invites_retired`).

**Ended matches stay ended:**
- profile access (`v2_can_view_public_profile`) closes for an unmatched pair, and the "match" path now needs an **accepted** match (a pending row no longer opens a profile);
- V2 Discover no longer shows people you are already matched with, or have unmatched;
- liking again does not re-open an ended match (`handle_mutual_like` only upgrades rows whose chat was never opened).

## 3. App

- **Matches tab** (`components/main/V2MatchesScreen.tsx`, used on the dev / test backends; the live V1 build keeps the old screen):
    - **"Ready" is now "Matches"**: real mutual matches only, with photo, first name and last-message preview.
    - The main action is **"Say hello"** (no messages yet) or **"Continue chatting"**.
    - Tapping the photo opens the V2 profile (`get_profile_v2`).
    - **Plans** keeps its name and shows three separate groups: **Waiting for your reply**, **Awaiting their reply**, **Confirmed**.
    - Removed from this path: algorithmic candidates, %, countdowns, "Plan a date".
- **Chat** (`app/chat.tsx`, dev / test backends):
    - the **+** button (left of the input) opens **Suggest a date** / Add a photo; the old persistent "Suggest a time to meet up" bar is gone;
    - the sheet sends through `propose_date_v2`, with one request id per opening;
    - suggestions appear **as cards in the conversation**, in time order with messages:
        - sender: "Awaiting reply";
        - receiver: **Accept**, **Suggest another time** (same sheet, sends a counter), **Not now**;
        - after a reply: Accepted / Not now / Another time suggested / Cancelled;
    - the header **⋯** menu has View profile (V2 profile) and **Unmatch** (with confirmation);
    - when the server says the chat is no longer active (unmatched or blocked): "This conversation has ended", input disabled, history readable;
    - suggestions refresh on focus and every 20 s (they are not on the realtime feed).
- **Activity:**
    - the invite-first cards (`new_invite`, `meeting_invite`, `invite_accepted`) and "Waiting on them" are hidden on the V2 backends (rows kept in the DB);
    - new rows: "X suggested a date" / "X suggested another time" / "X accepted your date", each opening that chat;
    - nothing is invented.

## 4. Old invitation records (inspected, nothing deleted or converted)

| Data | Count on dev | Handling |
|---|---|---|
| `matches` source `algo_invite`, `accepted`, chat open | 1 (two synthetic V1 accounts, 1 message) | Both sides consented and the chat is open, so it appears in **Matches** as a conversation ("Continue chatting"). Nothing about the row is changed |
| `matches` source `algo_invite`, `expired` | 1 (synthetic V1) | Not shown; kept |
| Pending invitations | 0 | — (a new one can no longer be created) |
| `notifications` `new_invite` / `invite_accepted` | present | kept in the DB, hidden on the V2 backends |

No invitation is turned into a match automatically.

## 5. Limits, abuse controls, billing, push

**Kept / added (server):**
- one pending suggestion per match;
- an answer is needed before the other side can start a new one;
- the time must be in the future, at most 120 days ahead; the place is at most 120 characters;
- idempotent request ids;
- active-chat participants only;
- block and unmatch stop everything.

**Not added:**
- no daily suggestion quota;
- the old daily invite quota (`try_send_invite`, 1 or 3 a day) is **not** carried over. It only applied to the retired invite path; the function is unchanged.

Discover like limits are unchanged.

**Open decisions:** billing or premium rules for suggestions, if any.

**Push (status only, nothing changed):**
- `send-push-notification` is driven by the `matches-push-notification` webhook, which uses the legacy service-role JWT (key rotation is still open). It reacts to invite fields (`invited_by`) and to a `chat_opened` change on UPDATE.
- A fresh mutual-like match is an INSERT, so it gets no push; date suggestions get no push either.
- Needed later, after key rotation: a webhook on `notifications` INSERT (or on the new RPC events) → Edge Function → Expo push for `mutual_match`, `date_proposed` and `date_accepted`.

## 6. Tests

**Real services, perfect-match-dev:**

| Suite | Result |
|---|---|
| `smoke_match_chat_v2.mjs` — synthetic members `cca06005-…` (man) and `67acc178-…` (woman), plus outsider `2344b540-…` | **46 / 46** |
| `smoke.mjs --stage p0b` — now opens the chat by mutual like (the invite → accept path is retired) | **38 / 38**, incl. realtime |
| `smoke_v2.mjs` — onboarding, review loop, eligibility, public profile | **83 / 83** |

What `smoke_match_chat_v2.mjs` covered:
- a one-sided like gives no match, no chat, no messages;
- a mutual like gives exactly one match with the chat open;
- Matches has no score fields;
- a matched person leaves Discover;
- suggest → pending; 3 rapid repeat taps give 1 row;
- one pending at a time; you can't accept your own;
- counter → pending and linked, a repeat gives no duplicate; a suggestion is not a plan;
- accept → confirmed and on the match; Plans keeps pending and confirmed apart; Activity events are real;
- direct date-column writes and invitations are refused;
- an outsider can't read the chat, suggest or respond;
- after a block: accept, suggest, Matches, profile and messages are all refused;
- after unmatch: the pending suggestion is cancelled; suggest, messages, both profiles, Matches and Discover are all refused.

The pair ends unmatched; a re-run first clears only this pair's own test rows.

**Local:**

| Suite | Result |
|---|---|
| `http_v2.test.mjs` (replica) | **208 / 208** — 42 new match / chat / date checks, plus profile access needs an accepted match and closes after unmatch |
| `tsc --noEmit` | clean |
| Onboarding UI logic | 45 · 69 · 56 · 6 |
| Backend selection · mapping · photo cache | 19 · 21 · 14 |

**Phone:** **nothing in this round is verified on the phone.**

**Phone test data (synthetic only):** member `2344b540-…` ("Test") liked the phone test account `13adb65c-…` back. This was its own real sign-in and an ordinary like (the phone account had liked it earlier), so the phone account now has **one real match with an empty chat**. Nothing on the phone account was reset. `smoke_v2.mjs` also added two new synthetic members, which may appear in Discover.

## 7. Phone

```
~/tempa-p0/scripts/dev-backend/start-app.sh
```
Then **DEV · Test account sign-in** with the printed code (or `r` in a running Metro).

1. Matches: one card "Test" with **Say hello**; no %, no "Plan a date". The tabs read **Matches / Plans**.
2. Say hello → send a message → back: the card now says **Continue chatting**.
3. In the chat: **+** → **Suggest a date** → pick a time (+ optional place) → Send. A card appears: "Awaiting reply". Plans → "Awaiting their reply". Tap Send twice → still one card.
4. ⋯ → View profile opens the V2 profile; ⋯ → Unmatch → confirm → the chat is gone from Matches, and the old link shows "This conversation has ended".
5. Activity: no "wants to meet" or invite cards; "You matched with Test!" is shown.

(The receiver side — Accept / Suggest another time / Not now — needs a second phone or the other account; it is covered by the real-service test.)

## 8. Still open

- Push for mutual matches and date events (after key rotation).
- Billing / premium decision for suggestions.
- Suggested time chips: they use V1 availability columns, so V2 members see only "Pick another time". Mapping V2 days / time preferences to chips is a follow-up.
- The "Likes you" grid still opens the V1 `user-profile` screen.
- Profile-edit policy, Magic Link, key rotation, `delete-account`, old public photo — unchanged.
