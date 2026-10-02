# V2 — Matches design preview (DEV, local fixtures) — result

Date 2026-10-02 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `9ef5d91` (clean) · Author: Claude Code.
Target: perfect-match-dev only; AI HQ not touched.

**Not changed:**
- the real Matches tab (`V2MatchesScreen`), scoring / algorithm, Discover order, like quota, premium, refresh window;
- production configuration, server rules, schema;
- the phone account `13adb65c-…`, its "Test" match and messages. The preview has no Supabase import, so it cannot read or write them.

## 1. What was built

A separate, DEV-only, interactive preview of the proposed Matches design.

| Part | File |
|---|---|
| Route (redirects to `/` when `__DEV__` is false) | `app/dev/matches-preview.tsx` |
| Screen: Matches home, profile, like sheet, local chat, DEV controls | `components/dev/MatchesDesignPreview.tsx` |
| Fixtures + pure state reducer + copy | `lib/dev/matchesPreview.ts` |
| Placeholder photos (2 people × 3) | `assets/dev/matches-preview/*.png` |
| Opt-in like hearts on the shared V2 profile component | `components/onboarding-v2/yourProfile/ProfilePreview.tsx` (`onLike` prop) |
| Entry while signed in (DEV only) | `components/main/V2ProfileHome.tsx` → "Matches design preview (DEV)" |
| Local logic check | `scripts/onboarding-v2-checks/v2_matches_preview.check.js` |

**Access:**
- signed in, Profile tab → **Matches design preview (DEV)** (no sign-out needed);
- or `datingapp://dev/matches-preview`.

The button and route exist only in development builds. In a production build the button isn't rendered and the route redirects to `/`. The six placeholder PNGs (~310 KB) are still bundled because the route file is part of the app.

## 2. Design

- **Theme:** ivory background, dark forest green, pale sage, Playfair Display for titles and names, DM Sans for body text — the approved `obColors` / `obFonts` tokens.
- **Matches home:**
    - "Picked for you" — a large 4:5 photo card with name, age and city on the photo, plus **View profile**.
    - "You both liked" — the same large card, plus **Say hello**. Tapping the photo opens the profile.
- **The page scrolls.** Photos are not shrunk to fit both cards on one screen.
- **Not shown:** compatibility %, "Continue chatting", last-message preview, timer, "Ready to meet", pop-up, meeting invite.
- **Profile:** the shared V2 profile component (`ProfilePreview`), built from local blocks via `buildPublicProfileBlocks`.
    - Hearts appear only when `onLike` is passed (the "Picked for you" person, before a like).
    - The approved own-preview and real member profiles render exactly as before.

**Mockups not available to me:** the five-screen and six-screen mockups mentioned in the brief were not attached in this session. The layout follows the written brief only. Compare it with the mockups on the phone.

## 3. Preview flows (all local)

| # | Flow | Behaviour |
|---|---|---|
| 1 | Start | both cards filled |
| 2 | View profile | the person's full profile via the shared component |
| 3 | Heart on a photo / prompt | sheet with the selected photo or answer, "Add a comment (optional)" (max 240, the `likes.note` limit), **Send like** |
| 4 | After sending | back to Matches. Card shows **Like sent** + a note: with a comment, "Your comment was sent with your like. A chat opens only if you both like each other."; without one, "If they like you back, you can start a chat." The mutual card is unchanged (no chat, no message) |
| 5 | Say hello | local chat ("Preview · messages are not sent"); no message exists until you press send; blank text can't be sent |
| 6 | First message | the chat shows it + "Conversation started. It continues in Chats."; the Matches card shows **Conversation started** + "Your conversation continues in Chats.", with no button. Real Chats is not written to |
| 7 | No mutual like | "No mutual likes yet" empty card |
| 8 | No new pick | "No new picks right now" empty card. No refresh time is shown (not decided); no timer, no auto-refresh |

**DEV control area** (bottom of the preview Matches page) — buttons: *Both cards*, *No mutual like*, *No new pick*, *Reset*.
- It also shows the current state.
- It only resets the in-memory preview; nothing on the account changes.
- Closing the preview also discards its state.

## 4. Images — missing

No realistic, licence-clear adult portraits are available in the project, and no paid service was used. The preview uses the project's own generated **illustrated** portraits (same generator as the dev pool, `scripts/dev-backend/portraits.mjs`). Each one carries a visible **"DEV · SYNTHETIC"** tag, and the DEV panel says they are placeholders.

**They are not final design imagery.** Realistic generated or licensed portraits are still needed to judge the photo-led look.

Fixture names (Defne, İpek) are fictional and differ from the dev pool's names.

## 5. Checks (local only)

| Run | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/onboarding-v2-checks/run.js` | new `v2_matches_preview` 34 / 34; existing 45 · 69 · 56 · 6 · 10 unchanged |
| `TEMPA_BACKEND=dev npx expo export --platform ios --dev` | bundles; all 6 preview PNGs present in the export |

The new check covers:
- every flow rule above (like / comment / message / empty states / reset);
- that the profiles build through the shared blocks;
- that the copy has no %, "Continue chatting", timer or invite wording;
- that the three preview files import no backend module;
- that the route redirects in production and the Profile entry is `__DEV__`-only.

**Not verified:** nothing was run on real services (nothing to run — the preview has no backend) and **nothing was tried on the phone**.

## 6. Open

- Compare with the five- / six-screen mockups on the phone; adjust spacing / type to them.
- Replace the illustrated placeholders with realistic, licence-clear portraits.
- Real implementation (separate work): the server would need a "picked for you" source (refresh rule not decided), targeted likes with a stable target key and server validation (see `V2_BACKEND_SCORING_AUDIT.md` §3), and a "mutual like, no message yet" query.

---

# Round 2 — visual refinement (2026-10-02)

From `f362944` (clean). Preview-only. Unchanged: the real Matches tab, Supabase, real accounts, scoring and production configuration. The shared `ProfilePreview` was **not** touched this round, so the approved onboarding preview and real profiles are unchanged; the full profile keeps its 4:5 photos.

## 1. Matches cards

- **Photo ratio:** Matches cards only, 4:5 → **3:2**. Name (Playfair 25), age and city sit on the photo.
- **Header:**
    - "Matches" is 26 pt and shares one row with the DEV pill and the close button (it used to be a 34 pt title on its own row);
    - section titles are 18 pt;
    - top and section gaps are smaller; the card body padding is 12 pt.
- **Estimated first view** (from layout values; not measured on the device):
    - iPhone 14/15 (393 × 852): the first card ends at about 451 pt; "You both liked" sits at about 475–499; the second photo spans about 507–737. So the whole second photo is visible.
    - iPhone SE (375 × 667): about 211 of the second photo's 218 pt is visible.
    - The page still scrolls.
- **Buttons:** **View profile** is always outlined; **Say hello** is filled dark green.
- **Shading under the name:** now a smooth gradient. A bundled 4 × 256 alpha-ramp PNG (`fade.png`, black, 0 → 66 % opacity) is stretched over the lower 62 % of the photo. The stepped bands are gone. No gradient native module was added, so no dev-client rebuild is needed.
- **"DEV · SYNTHETIC" tag:** re-baked into the placeholder images inside the area every crop keeps (3:2 card: y 167–833; 4:5 profile: x 100–900 of 1000). Checked visually on both crops.
    - The repository generator `scripts/dev-backend/portraits.mjs` (dev pool) is unchanged; the re-render used a scratch copy.
- **DEV badges:**
    - the DEV PREVIEW pill sits in the header row, so it covers nothing;
    - every bottom button / input (profile "Say hello", chat input, like sheet) keeps at least 20 pt + spacing from the bottom edge, so the global DEV backend badge (inside the bottom inset) never covers a control.

## 2. Like / comment sheet

- **Header:** title 19 pt, with an accessible **close (✕) button at the top right** ("Close without sending"). The large Cancel row is removed.
- **Selected content:** the photo thumbnail is now 88 × 110, the quote card 13 / 17 pt, and the gaps are tighter. The content comes from `selectedLikeContent()`, so it is exactly the tapped photo or the tapped answer (checked).
- **Comment field:** starts at about 2.5 lines (78 pt), grows to about 124 pt, then scrolls. It is optional, with a 240 limit and counter.
- **Layout:**
    - the selected content and the comment are in a `ScrollView` (the sheet is capped at 88 % of the height);
    - **Send like** is pinned below it;
    - when the keyboard opens, the bottom inset padding switches to a small gap, so the keyboard and the safe area don't cover the button.
- **Closing:** the ✕, a tap on the backdrop and Android back only close the sheet; nothing is sent. Sending with no comment still works.

## 3. Flows kept

Unchanged: Picked for you → profile → photo/prompt like → **Like sent**; You both liked → Say hello → empty local chat, message only on send; **Conversation started** after the first message. No Continue chatting, auto message, invite, % or timer.

## 4. Checks (local only)

| Run | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/onboarding-v2-checks/run.js` | `v2_matches_preview` **45 / 45** (+11); others 45 · 69 · 56 · 6 · 10 unchanged |
| `expo export --platform ios --dev` | bundles; all 7 preview PNGs (incl. `fade.png`) present |

New checks:
- the sheet shows the tapped photo / prompt (and no photo for a prompt);
- the card ratio is 3:2 while the full profile stays 4:5;
- View profile is outlined and Say hello is filled;
- the gradient is image-based (no bands);
- there is a close button and no Cancel row;
- only Send like calls send;
- the limit is 240.

**Not tried on a device:**
- the first-view proportions;
- the gradient's look;
- the tag visibility on the phone;
- the keyboard behaviour of the sheet (iOS and Android);
- the sheet scrolling on a small screen.
