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

---

# Round 2 (2026-10-01): V2 date ideas, "Likes you" → V2 profile, receiver-side phone test

Branch `tempa/v2-persist-r2`, from `b35196c` (clean, same as origin). No server / schema change this round. Perfect-match-dev only.

## A. "Suggest a date" ideas from V2 preferences

**Meaning, checked against DECISIONS D57:**
- *When are you free?* asks Days (Weekdays / Weekends / Either) and Time (Daytime / Evening / Either).
- These are **general first-date preferences, not scheduling** ("Choose the exact time together.").

**Before:** the sheet used V1 `profiles.availability_*`. For V2 members that is empty, so the old helper fell back to three **fixed** Saturday / Sunday times that were based on no data at all.

**Now** (`lib/onboardingV2/dateSuggestions.ts`, used only on the V2 backends):
- **Ideas:**
    - up to 3, from the caller's own `days_pref` / `time_pref`;
    - when the other person's public preferences (`get_profile_v2`) overlap, the overlap is used; otherwise only the caller's own;
    - representative local times: Daytime 13:00, Evening 19:30.
- **Label:** "Ideas from (both) your first-date preferences. Choose the exact time together." Never "available", never implying the other side agreed.
- **No preferences → no ideas**, just the date / time picker.
- **"Pick another time" is always visible**, also after a time is chosen.
- **No past times:**
    - ideas start tomorrow;
    - the picker's minimum is now + 5 min and it opens 1 h ahead;
    - Send refuses anything under 5 minutes ahead;
    - the server already refuses past times (`invalid_time` — tested).
- **Time zone:** built in the device's local time, sent as a UTC ISO string to a `timestamptz`, displayed in local time. The checks pass under Europe/Istanbul, America/Los_Angeles, Pacific/Auckland and UTC.
- The live V1 path keeps the old helper.

## B. "Likes you" → shared V2 profile

On the V2 backends a liker card opens `/v2/profile`. That is the same `PublicProfileView` / `get_profile_v2` used everywhere:
- the server selects the fields;
- blocked / hidden / deleted / ended pairs → "This profile isn't available";
- the raw draft is never sent.

Who may see likers is unchanged (`get_my_liker_cards`): identity only for premium, while locked tiles go to `/premium`. The phone test account is **not premium** (unchanged), so on the phone the tiles stay locked.

## C. Receiver side on one phone (`scripts/dev-backend/date-partner.mjs`)

The script plays **"Test" (`2344b540-…`)**, the phone account's existing match. It:
- signs in through the normal email-code path (code issued locally by the admin API, verified by the client);
- then calls **only the app's RPCs**, so every server rule applies;
- never acts as the phone account, never resets or unmatches it, and adds nothing to the app;
- refuses unless both accounts are synthetic.

Commands: `status`, `propose [h] ["place"]`, `counter [h] ["place"]`, `accept`, `decline`, `say "text"`.

Checked today: `status` showed the active match with no suggestions; `accept` correctly refused ("no pending suggestion from the phone"). Nothing was created on the phone account's match.

## D. Tests

| Run this round | Where | Result |
|---|---|---|
| `smoke_match_chat_v2.mjs` (+5 checks: Likes-you identity follows premium, liker → V2 profile with only the allowed fields, raw draft not readable, no suggestion without a match, past time refused) | **real services** | **51 / 51** |
| `date-partner.mjs status` / guarded `accept` | real services | as expected |
| `tsc --noEmit` | local | clean |
| Onboarding logic, incl. new **V2 date ideas 14 / 14** | local | 45 · 69 · 56 · 14 · 6 |
| Date ideas under 4 time zones | local | 14 / 14 each |

Earlier runs (not repeated — no server change): replica 208 / 208, P0 38 / 38, `smoke_v2` 83 / 83.

**Not tested:**
- **The phone:** not tested at all this round.
- **The premium "unlocked" liker-card tap:** not tested on real services. Both synthetic test accounts are non-premium and I did not change premium flags; the profile access it uses is tested.
- Android: the date picker uses `mode="datetime"` (as before), which is iOS-oriented.

## E. Phone check (≤ 5)

Reload (Metro `r`), signed in as the DEV test account. Run the commands from `~/tempa-p0` on the Mac.

1. Chat with **Test** → **+ → Suggest a date**: up to 3 ideas from weekend evenings, plus "Ideas from both your first-date preferences…" and **Pick another time**, which stays visible after choosing. Send → "Awaiting reply".
2. `node scripts/dev-backend/date-partner.mjs counter` → reopen the chat or wait ~20 s: your card shows "Another time suggested", and Test's new card shows **Accept / Suggest another time / Not now**. Plans → "Waiting for your reply".
3. Tap **Suggest another time** → pick a time → Send. Then `… date-partner.mjs accept` → the card shows **Accepted**. Plans → **Confirmed**.
4. Receiver side from scratch: `… date-partner.mjs propose` → on the phone, **Not now** → the card shows "Not now". A new `propose` works again.
5. Activity: "Test suggested a date / another time" and "Test accepted your date" rows, each opening the chat. "Likes you" tiles stay locked (not premium).

---

# Round 3 (2026-10-01): DEV profile pool, "Suggest a date" redesign, theme fixes

Branch `tempa/v2-persist-r2`, from `c0902cb` (clean, same as origin). Perfect-match-dev only; AI HQ not touched.

The phone account was checked after the round and is unchanged:
- its match with "Test" is still accepted with the chat open;
- your one message is still there — you picked and sent the icebreaker yourself; that user-chosen feature is kept;
- no suggestions;
- likes and the like quota are unchanged.

## A. Why Discover ran out — and the DEV pool

**Diagnosis:** this was a **shortage of candidates, not a filter bug**.
- Running `get_discovery_candidates_v2` with the phone account's identity on the server, only three synthetic women matched its filters (a 30-year-old man looking for women, İstanbul, 18–60):
    - one was already your match;
    - you liked the other two, so the session list ran out.
- Separate real flaw: someone you liked but who hasn't answered **came back after a reload** (discovery didn't exclude your own likes).
    - Fixed in `20261001140000_v2_discovery_skip_liked.sql`, applied to dev via `apply-dev.mjs skipliked`. It only adds that exclusion; nothing is loosened.
    - The replica checks both sides: you no longer see them; they still see you.

**Pool:** `scripts/dev-backend/seed-dev-pool.mjs` created **18 synthetic V2 members**:
- women interested in men (every 5th "everyone"), İstanbul, ages 24–38;
- varied names, jobs, prompts, interests, values, lifestyles and first-date preferences;
- **5 are sparse** (no job / school / hometown / tastes / spot) so the hiding of empty fields shows.

Each one went through the **normal path**:
1. real email-code sign-in;
2. `save_onboarding_v2` per section;
3. photo upload to the private bucket + `add_profile_photo_v2`;
4. prompts, selfie, consent;
5. `submit_application_v2`;
6. reviewer accept via `review_application_v2`.

Nothing is embedded in the app. The e-mails are `tempa-pool-NN@tempa-test.example.com`, and the private surname is "Synthetic".

**Re-run** (`seed-dev-pool.mjs`): "0 created, 0 completed, 18 already there" — **no duplicates**. No likes, matches, messages or date answers are created.

**Photos:** generated flat-illustration adult portraits (`scripts/dev-backend/portraits.mjs`):
- three per person: close-up, scene and interest still life;
- each tagged **"DEV · SYNTHETIC"**;
- no real people and no external images; we made them, so the usage right is ours;
- rendered with macOS Quick Look, no new dependency.

**Checks** (`seed-dev-pool.mjs --verify`, as another synthetic İstanbul man through the normal viewer path):
- 18 / 18 pool members appear in Discover;
- 18 profiles open with only the allowed fields, 3 photos and ≥ 2 prompts;
- the first photo signs and loads (> 10 KB);
- 5 sparse profiles return their empty fields as null / [].

**Phone account:** 19 Discover candidates (the 18 pool members plus the older smoke-test woman `dab90d03-…`).

**Note:** older smoke-test accounts named "Test" with solid-colour photos still exist. They were not deleted (only on request). This round I did not run `smoke_v2.mjs`, because it creates two more such accounts each time.

## B. "Suggest a date" (V2 chat) — new sheet

`components/chat/SuggestDateSheet.tsx` uses the approved theme:
- ivory sheet, Playfair title "Suggest a date" / "Suggest another time", and the other person's small photo + "with {name}".

Fields:
- **Day:** short horizontal day cards (today + 13 days), plus **Another date** (date picker, up to the server's 120-day window).
- **Time:** chosen **explicitly** from time chips; nothing is preselected and nothing is inferred from the general V2 preferences (D57). Today's past or too-near times are disabled. **Other time** opens a time picker.
- **Place (optional):** placeholder **"Decide together"**.

The footer, which stays above the keyboard, holds:
- the live summary (e.g. "Sun 4 Oct · 19:30 · Decide together");
- **Send suggestion**, enabled only for a time at least 5 minutes ahead.

The server logic is unchanged (`propose_date_v2` / `respond_date_v2`, idempotent request id). The previous round's preference-based "ideas" were removed per this request. Helpers are in `lib/onboardingV2/dateSuggestions.ts`; the checks pass 10 / 10 in four time zones.

**In-chat card** uses the same language:
- a pending suggestion is a **dashed** card "DATE SUGGESTION · You / {name} suggested · time · place or Decide together", with "Awaiting reply", or Accept / Suggest another time / Not now;
- only an accepted one becomes a solid sage card **"PLAN CONFIRMED"**;
- answered / cancelled ones are muted.

## C. Theme fixes seen on the phone

- **Chat:** ivory background; my bubbles forest green; theirs cream with a thin border; DM Sans text; Playfair name; sage accents. The grey / white and black are gone. The icebreaker stays user-chosen.
- **Activity and Chats:** the duplicated in-body titles are removed; the shared tab header keeps the title. In Activity, "Mark all as read" stays on the right.
- **Activity buttons / icons:** moved to the shared palette (forest green on pale sage; the old blue / teal / orange / pink / gold tints are replaced).
- **Matches:** the subtitle is now **"Start with a hello."** On match cards the text gets the full width (up to 2 lines) with the action below, so nothing is cut off.

## D. Tests

| Run this round | Where | Result |
|---|---|---|
| `seed-dev-pool.mjs` + re-run (idempotency) | **real services** | 18 created → 0 created / 18 kept |
| `seed-dev-pool.mjs --verify` | real services | 18 / 18 in Discover, 18 profiles OK, 5 sparse |
| `smoke_match_chat_v2.mjs` | real services | 51 / 51 |
| `smoke.mjs --stage p0b` | real services | 38 / 38 |
| `http_v2.test.mjs` (replica, + skip-liked checks) | local | 210 / 210 |
| `tsc --noEmit` | local | clean |
| Onboarding logic, incl. new **suggest-a-date 10 / 10** | local | 45 · 69 · 56 · 6 · 10 |

Earlier runs (not repeated): `smoke_v2` 83 / 83.

**Waiting for the phone** (none of it verified on a device):
- the new sheet's look, the keyboard behaviour and the iOS pickers;
- the themed chat, cards, Activity and Matches;
- the portraits as displayed.

## E. Phone check (≤ 5)

Reload (Metro `r`).

1. **Discover:** illustrated "DEV · SYNTHETIC" portraits with names (Elif, Zeynep, …). Some profiles show no job / school / tastes, with no empty headings. After liking someone and reloading, they don't come back.
2. Chat with Test → **+ → Suggest a date:** the sheet shows the photo + "with Test" and Day / Time / Place. **Send suggestion** stays disabled until a day and a time are picked. With the keyboard open on Place, the summary and the button stay visible. Send → a dashed "Date suggestion · Awaiting reply" card.
3. `node scripts/dev-backend/date-partner.mjs counter`, then `… accept` after your own counter: the accepted card turns solid sage "Plan confirmed"; the others look muted.
4. **Chat look:** ivory background, green / cream bubbles, no black. **Activity / Chats:** one title each; Activity buttons and icons green.
5. **Matches:** subtitle "Start with a hello."; the card text isn't cut off and the button sits under it.
