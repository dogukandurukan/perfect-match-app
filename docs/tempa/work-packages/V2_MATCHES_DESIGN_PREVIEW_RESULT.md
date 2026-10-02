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
