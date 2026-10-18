# V2 chat screen — redesign (result)

# Round 4 (2026-10-19): + menu sheet and Suggest a date tidy-up

**Inputs:**
- The phone screenshots named in the brief **did not reach this session**: none was attached, and `~/Downloads` is no longer readable here ("Operation not permitted").
- The layout below comes from the brief's text and the code, **not** from the screenshots.

**Changes (V2 only; V1 unchanged):**
- **+ menu:** `components/chat/ChatPlusSheet.tsx` (new) replaces the grey system alert.
  - An ivory bottom sheet with a handle, the title "Add to chat" and a × button. A tap outside or Android back also closes it.
  - Two icon rows: **Suggest a date** / **Add a photo**, wired to the existing `openProposeModal(null)` / `handleAddPhoto`.
  - The chosen action runs **after** the sheet has closed (`onDismiss` on iOS; Android runs right away), so the date sheet or the photo alert can appear.
  - Opening or closing it never touches the draft.
- **Suggest a date:**
  - **Tomorrow fix:** day cards had a fixed `width: 68`, and "Tomorrow" (14 pt semibold) broke to "Tomorro / w". They now use `minWidth: 72` plus 12 pt side padding, and both lines are single-line.
  - **Spacing:** title 22 (was 24), avatar 40 (was 44), section label spacing 8 (was 12), body gap 6 (was 8), footer top 8 (was 12).
  - **Footer:** keeps the safe-area inset when the keyboard is down and drops it to 8 pt when the keyboard is up.
  - **Place field:** on focus the list scrolls to the end, so the field and Send stay visible.
  - **Kept as they were:** Another date / Other time, "Decide together", the empty place, Send disabled until a day and a time are picked, and the possibly half-visible last day card.

**Behaviour review (code; no change made):**

| Question | Finding |
|---|---|
| Past date / time blocked? | **Yes, at three layers.** (1) The date picker's `minimumDate` is today, and time chips < 5 min away are disabled. (2) Send is disabled and a warning shows when the chosen time is < 5 min away; `confirmProposeV2` checks `isSendableTime` again at send time. (3) The server refuses `p_meeting_at <= now()` and more than 120 days ahead. |
| Double tap → two suggestions? | **No duplicate row.** The request id is fixed per sheet opening, `propose_date_v2` returns the existing row for the same id (`unique (proposed_by, request_id)`), and only one suggestion can be pending per match. **Gap (client, small):** the guard `if (proposing) return` and the button's `disabled={sending}` read React state. Two taps inside one frame can both start an RPC with the same id. The second can then hit the unique constraint and show a needless "Could not send" alert even though the first one succeeded. **Needed fix:** a `useRef` in-flight guard in `confirmProposeV2` (≈3 lines, client only). Not done in this package. |
| Failure → selections kept + error? | **Yes.** On `!r.ok` an alert shows the mapped message, and the sheet stays open with day / time / place unchanged (it resets only when opened). A retry reuses the same request id (idempotent). |
| Add a photo | **Neither preview nor send:** after picking or taking a photo, the app shows "Coming soon — Photo sharing is on the way." Nothing is uploaded or sent (`TODO(P2 Katman 2)`). |

**Local real-service check, written but not run:**
- `smoke_activity_local.mjs` got step 10b, using the app's own RPCs:
  - a past time is refused;
  - two parallel taps with the same request id → exactly one suggestion;
  - it reaches A's chat (pending, place and time intact);
  - the proposer can't accept their own;
  - A accepts → B's chat shows "accepted".
- **It could not run:** tempa-local's Auth and Storage time out connecting to its Postgres ("failed SASL auth … i/o timeout", "Connection terminated due to connection timeout").
  - The DB answers `psql` from inside its container, TCP to 5432 is open and REST answers.
  - The DB log also shows the Realtime replication connection dropping at 22:03 UTC ("unexpected EOF on standby connection").
  - Recovering needs a stop / start of only the tempa-local stack. Its data is kept in the volume, and there is no reset.
  - **Not done without the owner's go-ahead.**

**Checks:**
- `run.js` all pass: `v2_chat_layout` 53/53 (+7 for the + sheet and the date sheet); `V2 suggest a date` 10/10.
- `tsc` clean.

**Phone test (not done):**
- + opens the ivory sheet, and × / outside / back close it.
- Suggest a date opens after choosing it, and Add a photo shows its picker alert.
- A typed draft survives opening and closing the menu.
- "Tomorrow" on one line.
- Typing a place keeps the field and Send above the keyboard.
- **Defne's account receives the suggestion and can answer it.**

---

# Round 3b (2026-10-18): phone check of round 3 + status bar

**Owner's phone result (`6e4dd73`, screenshots with the keyboard closed and open):**
- The DEV badge reads `LOCAL · local:55421 · chat-r3 · 393×852 · fs 1.00`: the phone runs the round-3 JS, and the text scale is 1.0.
- Measured on the screenshot, round 3 landed as intended:
  - name stem **1.7 pt** (mockup 1.7), ink height 16.3;
  - bubble corner ≈ **11 pt**, no tail;
  - 52 pt photo, 48 × 44 card thumbnail, day labels centred.
- The keyboard-open view keeps the input row right on the keyboard.

**Bug found:**
- The **status-bar clock and icons were white on ivory** (measured 255, 255, 255): the global `<StatusBar style="auto" />` follows the phone's dark mode.
- Home and onboarding already override it with `style="dark"`; the chat did not.
- Fixed for the V2 chat only: `{v2Enabled ? <StatusBar style="dark" /> : null}`.

**Remaining differences, not style measurements (owner's decision):**
1. The conversation has only three short messages, so most of the screen is empty, while the mockup is full. No fake content.
2. The empty-field send button is muted grey-green (disabled, round 1 rule); the mockup shows it solid green.
3. Mockup incoming bubbles have no visible border (a faint shadow instead).
4. Option: anchor short conversations to the bottom, next to the input (WhatsApp-style), instead of the top.

`v2_chat_layout` 46/46; `tsc` clean. Not tried on the phone yet.

---

# Round 3 (2026-10-17): measured comparison, then targeted fixes; V1 restored

**Owner's phone result (round 2):** no clear visual improvement on the phone.

**Inputs actually used:**
- Phone screenshot, keyboard closed: 1179 × 2556 px = **393 × 852 pt at @3x**.
- Mockup, left screen: its screen area is 456 px wide → scaled to the same 393 pt, ignoring the frame.
- Both were measured **pixel by pixel** (a small PNG reader in the session scratchpad), not by eye.
- **Still no simulator** on this Mac (no Xcode).

**Text scale:** "Taslak deneme" measures 12.0 pt from the ascender top to the baseline. That is DM Sans 16 at scale **1.0**, so the phone has no enlarged iOS text.
- The round-2 "large text" assumption was **wrong**. Its `maxFontSizeMultiplier` caps are **removed**.
- A temporary DEV badge now prints the exact numbers on the phone (see "Phone check").

**Measured (pt, 393-wide):**

| Element | Phone (`ae32ec7`) | Mockup | Verdict |
|---|---|---|---|
| Message text (ascender to baseline) | 12.0 | 12.1 | same — **not** the problem |
| Like card | 361 × 56 at x 16 | 361 × 57 at x 15.5 | same |
| Card thumbnail | 40 × 40 | ≈ 50 × 46 | photo too small |
| Header name, ink height | 16.3 | 15.5 | same size … |
| Header name, stem width | ≈ 3.0 (Playfair 700) | ≈ 1.7 (regular weight) | … **twice as heavy** |
| Header photo | 38 | ≈ 54 | photo too small |
| Bubble corner | 16 + 5 pt tail | ≈ 10–11, no tail | pill-like |
| Bubble max width | 78 % of row (≈ 280) | ≈ 240 | too wide |
| Incoming avatar | 32 | ≈ 41 | too small |
| Day label → first bubble | ≈ 5 | ≈ 22 | label glued to the next message (round-2 regression) |
| + / field / send | 42 | ≈ 46 / 43 / 48 | slightly small |

**The differences that break the look** (photo-led and calm in the mockup; text-led and heavy on the phone):
1. **Header:** bold name with a small photo, where the mockup has a light name with a large photo.
2. **Bubbles:** big corners, a tail and too much width, where the mockup has small even corners and narrower bubbles.
3. **Small photos everywhere:** header, incoming avatar, card thumbnail.
4. **Day label:** stuck to the next message instead of centred between blocks.

Not a style difference: the phone chat has only three short messages, so most of the screen is empty. Not filled (no fake content).

**Changes (V2 only):**
- **Header:**
  - Name in **Playfair Display 400** at 21. This weight was added from the same `@expo-google-fonts/playfair-display` package as our 700 (identical SHA) and is loaded with expo-font, so no native rebuild.
  - Photo **52**; thin Feather back arrow.
- **Bubbles:** **11 pt even corners, no tail**; max **248 pt**; 16 / 21 text; 13 / 8 padding.
- **Other people's photos:** incoming avatar **40** (time aligned with the bubble).
- **Like card:** thumbnail **48 × 44**, padding 6; card height stays ≈ 56.
- **Day label:** 18 pt above, then 6 + 12 to the first bubble (centred). Time 12.
- **Input:** back to **44 pt** controls; keyboard alignment logic unchanged.
- **Text scaling:** fully on (no caps).

**V1 restored:**
- V1 uses the original `styles` block, byte-identical to `354cfc7` (checked with diff).
- It keeps its old header ("←", no View profile), old bubbles with its own avatar, no day labels or times, and old input padding.
- V2 values live in a separate `v2` style object. The JSX branches only where the structure differs: header, bubble row, day rows, input styles.
- Unchanged behaviour (both): scrolling only while at the end, and the sent row read back from the insert.

**Temporary DEV badge:** `components/dev/DevBackendBadge.tsx`, `__DEV__` only, to be removed after the check. It shows `LOCAL · local:55421 · chat-r3 · <width>×<height> · fs <fontScale>`.

**Checks:**
- `run.js` all pass (`v2_chat_layout` 45/45: round 3 values, V1 isolation, no text-scale caps, font loaded, badge).
- `p0-checks` all pass; `tsc` clean; LOCAL iOS export exit 0 (the Playfair 400 file is in the exported assets, matched by md5; the DEV badge text is stripped from that production-mode export, as expected).
- These are not visual proof.

**Phone check (not done):**
1. On the Mac, stop the running Metro (Ctrl-C), then run `cd ~/tempa-p0 && git log --oneline -1` (expect the round-3 commit) and `scripts/local-backend/start-app.sh tempa-activity-p1-receiver@tempa-test.example.com`. It starts with `-c`, so the Metro cache is cleared.
2. On the phone, fully close the dev client (swipe it away), reopen it, and connect to the Metro URL the terminal prints.
3. The bottom-left badge must read **`… · chat-r3 · 393×852 · fs …`**:
   - without `chat-r3`, the phone is running older JS;
   - send a screenshot with the `fs` value.
4. Then compare: header (light name, larger photo), bubbles (small corners, no tail), the day label centred, the card thumbnail, + / send, keyboard open and closed.

---

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
