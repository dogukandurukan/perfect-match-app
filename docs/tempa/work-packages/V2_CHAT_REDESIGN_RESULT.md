# V2 chat screen — redesign, round 1 (result)

Date 2026-10-17 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `354cfc7` (clean, same as origin; the brief named `03d4bb1`, `354cfc7` is one docs-only commit later) · Author: Claude Code.
Reference: the owner's mockup, **left screen ("Sohbet") only**.

**Not done:**
- No backend, migration, matching or messaging-rule change.
- Nothing on the shared DEV/live project; no reset, merge or deploy.
- Not added: the right-hand suggestion panel, shared-interest chips and "Conversation ideas".
- Unchanged: the + menu and the quiz.
- **Nothing in this round was tried on a phone.**

## What changed (normal V2 chat, `app/chat.tsx`)

**1. Header**
- Back arrow, 40 pt photo, name, then **"View profile"** underneath, plus the existing ⋯ menu.
- Uses the safe-area top only; the extra 12 pt is gone. Hairline divider.
- Photo / name / "View profile" open the existing full profile (`/v2/profile`).
- For an ended chat or an unavailable account, "View profile" is hidden and the tap is disabled (as before).

**2. "How it started"** (`components/chat/HowItStartedCard.tsx`, new)
- Collapsed card: a 40 pt thumbnail, the real like line ("Defne liked your photo / answer / profile") and a one-line preview (the comment in quotes, else the liked answer). "+N" when there are more likes.
- The thumbnail shows **only for a liked photo**. Answer and whole-profile likes get their own icon, so nothing pretends to be a photo like.
- Tap expands: every like with its prompt question, full answer and full comment; tap again collapses it.
- It is the list header, so it scrolls away with the chat. Still context only, never a message (D70 / D79).
- `LikeContextHeader` is kept unchanged for the DEV Activity preview.

**3. Messages**
- Ivory background; dark-green outgoing and light incoming bubbles. 18 pt radius with a 6 pt tail corner, max width 78 % (shrinks for long text, wraps multi-line text and emoji).
- **No avatar next to own messages.** The other person's avatar appears only beside the **last bubble of a group**.
- **Groups:** same sender, same day, ≤ 5 min apart; a date card is its own group. 3 pt between bubbles of one group, 12 pt between groups.
- **Day separators** ("Today", "Yesterday", weekday, "10 Oct", "31 Dec 2025") and a **time** ("20:12") under the last bubble of each group. All from the real `created_at`, in local time (`lib/chat/timeline.ts`, pure).
- No online, typing or seen state.

**4. Input row**
- Compact + button, rounded field ("Message {name}…") and the send arrow, all 44 pt.
- **Send is disabled (muted green) for an empty message.**
- Keyboard open: the row sits right on the keyboard (8 pt). Closed: only the home-indicator inset, no extra 12 pt.
- The multiline input has no `lineHeight` (the iOS stale-paragraph issue from P05 R2).

**Scrolling and sending**
- The list follows the newest message **only while the reader is at the end** (≤ 80 pt). Someone reading older messages is no longer pulled down by an incoming realtime message, the 20 s state refresh or the keyboard.
- Own sends always scroll to the end.
- **The sent row is read back from the insert** and shown at once, de-duplicated against the realtime echo by id. The sender may read it: `messages_select_policy` was checked on tempa-local. Before this, an own message only appeared if the realtime echo arrived.

**Draft**
- Profile opens with `router.push` and returns with `router.back()`, so the chat stays mounted with its draft.
- Leaving the chat itself still drops the draft (unchanged).

**V1**
- The legacy screen shares the same bubbles, header and input.
- V1-only parts are kept: meetup bar, camera button, "You matched — say hi 👋".

## Checks

| Run | Result |
|---|---|
| `node scripts/onboarding-v2-checks/run.js` | all pass; new `v2_chat_layout` 29/29 |
| `scripts/p0-checks/*.mjs` | 28 · 12 · 14 · 21, all pass |
| `npx tsc --noEmit` | clean |
| `npx expo export --platform ios` (LOCAL config) | exit 0; bundle contains "View profile" / "How it started" |

**Updated static checks** (they asserted the old design; each now checks the same intent):
- `v2_activity_preview`, `v2_activity_real` and `v2_matches_real`: the real chat uses `HowItStartedCard` as the list header.
- The keyboard / new-content scroll check now expects `scrollToEndIfFollowing`.

## Phone test (not done)

`cd ~/tempa-p0 && scripts/local-backend/start-app.sh tempa-activity-p1-receiver@tempa-test.example.com` → DEV · Test account sign-in → Chats → Defne.

1. Header: compact, safe area OK; photo / name / "View profile" → full profile → back.
2. "How it started": the right like type and comment; tap expands / collapses; scrolls away with the messages.
3. Bubbles: no own avatar; one avatar per group of theirs; "Today" / time labels look right; long text and emoji wrap.
4. Keyboard: the field sits right on it; closed, no extra gap at the bottom.
5. Send: an empty message can't be sent; a new message appears at once and stays in view.
6. Scroll up to older messages, then have Defne send a message (second phone / account): your position stays.
7. Type a draft → View profile → back: the draft is still there.
