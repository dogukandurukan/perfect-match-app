# V2 chat screen — redesign (result)

# Round 2 (2026-10-17): visual tightening after the owner's phone review

**Owner's phone result (round 1):** `40a667c` is on the phone (View profile, the new card and the times are visible). It is **not close enough to the mockup**.

**Inputs:**
- The phone screenshot mentioned in the brief **did not reach this session**; the values below come from the brief and the mockup.
- The code already used **19 pt** for the name and **15.5 pt** for the body, yet both read large on the phone. That suggests a larger iOS text size on the device. This is **not verified**.
- **No simulator check:** this Mac has only the Command Line Tools (no Xcode, no iOS Simulator). The look is unchecked until the phone test, and the static checks are not proof of mockup fit.

**Changes (no new feature; send / Realtime / backend unchanged; the instant own-message display from round 1 kept):**

| | Round 1 | Round 2 |
|---|---|---|
| Header | name 19, View profile 13, avatar 40, padding 4 / 8 | **name 21, View profile 12.5, avatar 38**, padding 2 / 6 |
| Message body | 15.5 / 21 | **16 / 22** |
| Time / day label | 11.5 · 12.5 medium, 8 above + 4 below | time **11.5 / 14**, 2 above · day **12 regular, 10 above, 0 below**, first bubble of a day only 4 pt under it |
| Bubble | radius 18 (pill-like), 14 / 9 | **radius 16** (tail 5), **13 / 9** |
| Spacing | 3 in a group · 12 between groups | **5 in a group · 14 between groups** |
| How it started | 14 / 13.5 text, padding 10 / 12, radius 14 | **13.5 / 13 text**, comment 14 when expanded, padding 8, radius 12; thumbnail 40; one line each when collapsed |
| Input | 44 pt +, field and send | **42 pt** circles and field, **hitSlop 3 → 48 pt touch area**; keyboard alignment unchanged |

**Text size:** scaling stays on, never disabled. Each kind of text has its own cap (`maxFontSizeMultiplier`):

| Text | Cap |
|---|---|
| Header name | **1.15** |
| View profile, day labels, times, the card | **1.3** |
| Message text and input | **1.8** |

**V1 impact (stated explicitly):**
- `app/chat.tsx` is **one screen for V1 and V2**. The header, bubble, spacing, input and text-size changes (in both rounds) also change the legacy V1 chat look.
- The V1-only parts are kept: meetup bar, camera button, "You matched — say hi 👋".
- I did not split the styles. The production build still ships V1 on the shared database, which the Chats alignment report lists as a release blocker. Limiting the look to V2 would mean keeping a second set of styles, which you can ask for separately.
- The card (`HowItStartedCard`) is V2-only.

**Checks:**
- `run.js` all pass: `v2_chat_layout` **38/38** (+9: round 2 sizes, spacing, touch areas, text-scale caps, `afterDay` marker).
- `p0-checks` all pass; `tsc` clean; LOCAL iOS export exit 0.

**Phone test (not done):** same chat (Mert → Defne).
- Keyboard closed and open: does the header weight now match the mockup?
- Are "Today" / "Wednesday" small captions, not sections?
- Bubbles: rounded cards, not pills; tighter spacing.
- The card's proportions.
- The + / send taps.
- If the name still reads large: compare at the default iOS text size (Settings → Display → Text Size), to check the text-size hypothesis.

---

# Round 1

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
