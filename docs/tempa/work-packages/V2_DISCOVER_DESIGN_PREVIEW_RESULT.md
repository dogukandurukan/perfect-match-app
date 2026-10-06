# V2 — Discover (home) full-profile design preview (DEV, local) — result

Date 2026-10-06 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `afb749c` (clean, same as origin) · Author: Claude Code.
Target: perfect-match-dev only (no real-service call was needed or made); AI HQ and `~/tempa-p06` not touched.

**Status: a preview for phone review — not an approved design.** The order, the keyboard behaviour and the inline comment are to be judged on the phone first.

**Unchanged:**
- the real Discover tab, Supabase (schema, RPCs, RLS, data), real accounts (the phone account `13adb65c-…`, its "Test" match and messages);
- scoring / quota / premium rules, production / V1–V2 configuration, keys, `delete-account`, public files;
- profile-editing locks, the approved onboarding, photo management and the real profile screens.

The shared `ProfilePreview` was **not** modified this round.

Reports read first: `V2_PROFILE_INTEGRATION_RESULT.md`, `V2_MAIN_APP_ALIGNMENT_RESULT.md`, `V2_BACKEND_SCORING_AUDIT.md`, `V2_CHATS_ALIGNMENT_RESULT.md`, `V2_MATCHES_DESIGN_PREVIEW_RESULT.md`.

The mockup (three screens: first view, profile details, comment inside the profile) was opened and used as the visual reference. Its Turkish labels are English in the build (Hometown, Aries, Product designer, Add a comment, Cancel, Send). Place names are unchanged.

## 1. What was built

| Part | File |
|---|---|
| Route, DEV only (redirects to `/` when `__DEV__` is false) | `app/dev/discover-preview.tsx` |
| Screen: header, profile scroll, floating ×, keyboard handling, DEV panel | `components/dev/discover/DiscoverDesignPreview.tsx` |
| Profile items: hero / photos / prompts / details / sections / inline editor | `components/dev/discover/DiscoverProfileItems.tsx` |
| Non-interactive picture of the five-tab bar | `components/dev/discover/PreviewTabBar.tsx` |
| Fixtures, profile order, location rule, decision reducer | `lib/dev/discoverPreview.ts` |
| Placeholder photos: 6 + 3 + 4 | `assets/dev/discover-preview/*.png` |
| Entry while signed in | `components/main/V2ProfileHome.tsx` → **Discover design preview (DEV)** (`__DEV__` only) |
| Local check | `scripts/onboarding-v2-checks/v2_discover_preview.check.js` |

### First view

- **Header:** small header (Tempa wordmark, a tiny "DEV ✕" pill that exits, "3 likes left", the filter icon).
- **Main photo:** fills the space between the header and the tab bar, edge to edge, with no outer margin and no View profile button. Its height is the measured free space (≥ 360 pt).
- **On the photo:** a soft gradient (the bundled alpha-ramp PNG, no native module), then name, age (Playfair) and location.
- **Buttons:**
    - × is a white circle floating bottom-left;
    - each photo has its own outlined heart bottom-right and an "Add a comment" chip next to it.
- **Tab bar:** shown as a picture of the real one (Discover active, same icons and labels). It is not tappable and is announced as "preview only, not interactive".

### Location

- The hero shows the **district when the person shared one** (Kadıköy, Şişli), otherwise the **city** (İzmir) — `heroLocation()`.
- Nothing comes from GPS or coordinates.
- The location is **not repeated** in the details below.

### Personal details

- Shown as a two-column grid of label + value: Hometown, Height, Zodiac, Job, School.
- Values use DM Sans Medium 17 in the dark text colour; labels are 13 pt.
- Long values wrap — the third fixture has a long job title and school.
- Empty fields and empty sections are left out (the short fixture shows only Height + Zodiac).

### Profile order (starting layout for review)

The order is built by `buildDiscoverLayout()`:
1. hero;
2. prompt 1;
3. details;
4. photo 2;
5. Looking for + values;
6. prompt 2;
7. photo 3;
8. interests + Lifestyle;
9. favourites (artists / books / movies & series);
10. leftover photos and the 3rd prompt, spread between the long sections — two photos never touch while a prompt can separate them;
11. First dates (+ favourite spot) **last**.

How it looks with the fixtures:
- **Full** (Defne, 6 photos / 3 prompts): … Into+Lifestyle → photo 4 → prompt 3 → photo 5 → favourites → photo 6 → First dates.
- **Short** (Mert, 3 / 2): hero → prompt → details → photo 2 → Looking for → prompt → photo 3 → Into+Lifestyle → First dates.

Section content and wording come from the shared `buildPublicProfileBlocks`, so they mean the same as in the approved own-profile preview.

Other rules:
- First dates is information only; there is no invite or plan button.
- Favourites are **text rows with a small outline icon**: no image boxes, no empty or broken thumbnails, no new provider.

### Like, pass, inline comment

- No swipe; × passes.
- **Heart** on any photo / prompt = a like on that item, with no comment.
- **"Add a comment"** opens the editor **directly under that item**: inside the prompt card, or right under the photo.
    - There is no page, modal or sheet, and only one editor is open at a time.
    - The editor has the field (240 limit, counter), **Cancel** (closes it, sends nothing) and **Send** (= one like with the comment; no heart needed; disabled when blank).
- Every decision names its profile, so a **double tap can't make two decisions or skip two profiles**.
- **After a decision** the next profile simply appears from its top. The DEV panel at the end of the profile shows the last decision as plain text.
    - None of the unapproved feedback: no green heart, no "Like sent" / "Profile passed" box, no flying card, no stamp, no animation, no rose heart.
- "N likes left" is a temporary preview counter (starts at 3). At 0 the hearts and Send turn off.
- After the last profile a plain DEV placeholder appears ("That's everyone in this preview"). The real end-of-list and out-of-likes screens are a later work package.

### Keyboard

- The editor focuses itself, so you can type right away.
- **Return key = Done:** `returnKeyType="done"` + `submitBehavior="blurAndSubmit"`, with no submit handler. It closes the keyboard, **keeps the draft** and sends nothing; tapping the field again reopens it.
    - As a result, a comment can't contain line breaks; long text still wraps over several lines.
- While the keyboard is open, the tab bar and the floating × are hidden.
- On every keyboard show, editor switch and editor growth, the screen measures the editor and the keyboard top and scrolls **only as much as needed** so the field and Send sit above the keyboard. It never jumps to the top.
    - Also used: `automaticallyAdjustKeyboardInsets` on iOS.
    - The hero height is frozen while an editor or the keyboard is open, so the tab bar hiding (or an Android resize) doesn't move the profile.
- The field starts at about 2 lines, grows to about 5, then scrolls inside.

## 2. Local preview vs. real backend

| In the preview | Status |
|---|---|
| People, photos, prompts, details, sections | **local fixtures** (fictional; illustrated placeholder photos) |
| Heart / Send / × / likes counter / reset | **local reducer**, in memory only; nothing is written |
| Section meanings and wording | **shared app code** (`buildPublicProfileBlocks`, prompt catalog), no network |
| Anything from Supabase | **none** — the preview imports no backend module (checked) |

Needed to connect it for real (not done):
- **District on the hero:** `get_profile_v2` deliberately **does not return the district** today. Needed:
    1. a decision that "location_district set in onboarding" = the member chose to share it (or an explicit "show my district" choice);
    2. `get_profile_v2` returning the district only when shared, never the location id, label or coordinates;
    3. the same rule on every other surface that shows a location.
- **Targeted likes / comments:**
    - a **stable content id** (e.g. `profile_photos_v2.id`, prompt slot / `prompt_id`) instead of the preview's `photo:N` / `prompt:<id>` keys;
    - **server validation** that the target belongs to, and is visible on, the likee — `likes.target_key` is unchecked free text today;
    - a decision on one like per person (current unique) vs one per item;
    - note moderation / reporting.
- **Like / pass in the real Discover:** today's quota (`increment_daily_views`) and premium rules stay as they are; the "3 likes left" text is not a new rule.

## 3. Differences from the mockup

- **Photos:** illustrated "DEV · SYNTHETIC" placeholders. **Realistic, licence-clear portraits are still missing** (no paid service used). The tag sits top-centre, inside every crop.
- **Wordmark:** the shared `TempaWordmark` ("Tempa"), not lowercase "tempa".
- **Header:** adds a tiny DEV ✕ pill and "3 likes left".
- **Photo hearts:** the mockup's second screen shows the heart at the same screen spot as on the first, which may mean a floating heart. Here each photo carries its own heart at its bottom-right corner, and only × floats.
    - Floating × can sit over content mid-scroll, as in the mockup. Watch for accidental passes near a prompt's "Add a comment" link.
- **Photo comments:** each photo has an "Add a comment" chip. The mockup shows comments only on prompts, but the brief asks for them on photos too.
- **Prompt card:** the heart sits top-right in both states (the mockup's second screen has it lower).
- **Editor:** shows "Your comment" + a 0/240 counter.
- **Icons:** Height uses `resize-outline` (the mockup has a ruler) and Zodiac uses `planet-outline` (the mockup has the ♈ glyph), the same icons as the approved own-profile preview.
- **Section titles:** the approved own-preview titles are kept ("Looking for", "What matters most", "Into", "Lifestyle", "Artists", "Books", "Movies & series", "First dates"), not the brief's working names (Values / Interests / Music / Movies & TV). Rename later if wanted.
- **Not interactive:** the filter icon and the tab bar.

## 4. Checks (local only)

| Run | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/onboarding-v2-checks/run.js` | new `v2_discover_preview` **43 / 43**; others unchanged (45 · 69 · 56 · 45 · 6 · 10) |
| `TEMPA_BACKEND=dev npx expo export --platform ios --dev` | bundles; all 13 Discover preview PNGs present |

The new check covers:
- the full and short profile orders;
- the district-or-city rule and no repeat below;
- English details with empty fields hidden;
- heart / × / Send / Cancel / one-editor / 240 / double-tap rules;
- the end of the list and reset;
- no Turkish UI copy, no backend import, no swipe / animation / modal / sheet / toast, no percentage text;
- Done with no submit handler, the tab bar hidden with the keyboard, and DEV-only access.

**Not done:**
- no real-service test (the preview has no backend);
- **nothing was tried on a phone:**
    - the first view's height;
    - the gradient;
    - the keyboard (iOS and Android);
    - scroll-into-view;
    - small screens;
    - long prompts and multi-line comments on a device.

## 5. Open

- Phone review of the order, the keyboard and the inline comment, then the design decision.
- Realistic placeholder portraits.
- Like / pass feedback design (deliberately absent), and the out-of-likes and end-of-list screens.
- The real integration items in §2 (district visibility, stable targets + server validation, one-vs-many likes).

**Backend / security items unchanged by this round** (from the earlier reports):
- the production build ships the V1 product (`v2Enabled` false on EAS production);
- the legacy JWT is still embedded in the `matches-push-notification` trigger, and key rotation is pending;
- no push for mutual matches / date events;
- `delete-account` branch version not deployed;
- `user-photos` is still public with 1 object;
- `likes.target_key` is unvalidated;
- post-approval editing is undecided (the `profiles` projection goes stale if editing opens);
- leaked-password protection is off;
- the matches invite / accept state machine is not enforced in the DB.

## 6. Phone

**Command:** `~/tempa-p0/scripts/dev-backend/start-app.sh`.
- No native change was made, so the installed dev client works.
- Signed in, press `r` in Metro if the app was already open.

**Button:** Profile tab → **Discover design preview (DEV)**. No sign-out needed.

Checks (≤ 5):
1. **First view:**
    - the main photo fills the space from the header to the tab bar;
    - "Defne, 29" and "Kadıköy" are readable on a soft gradient;
    - × is bottom-left, the heart and "Add a comment" bottom-right;
    - the DEV pill covers nothing.
2. **Scroll the full profile:**
    - check the order;
    - details read Hometown İzmir · Height 166 cm · Zodiac Aries · Job Product designer · School Boğaziçi University, and Kadıköy is not repeated;
    - favourites are text rows without empty image boxes.
3. **"Add a comment" on the first prompt:**
    - the field opens inside the card with the keyboard, the tab bar hides, and the field and Send stay above the keyboard;
    - type several lines;
    - **Done** closes the keyboard and keeps the text;
    - tap the field again to reopen the keyboard;
    - Cancel closes without sending.
4. **Comment on a photo:** do the same lower down, and check the page doesn't jump to the top. Send moves to the next profile (Mert, İzmir — city only).
5. **Taps:**
    - × and the heart each move exactly one profile, even with a fast double tap;
    - "3 likes left" counts down;
    - "Reset (short profile first)" in the DEV panel restarts with the short profile.
