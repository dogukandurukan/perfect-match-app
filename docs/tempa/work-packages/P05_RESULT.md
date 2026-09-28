# P05 — Result: Your World preview and typeahead search

**Status (after R1, 2026-09-28): UI DONE. Live search: artists / books / movies & series LIVE (keyless public catalogs); schools / hometown still SAMPLE. Owner phone validation: PENDING.**

> The "Provider readiness" section below describes the original P05 state and is superseded by the R1 section at the end.
Date: 2026-09-27. Implemented by Claude Code. Not merged, not deployed.

| | |
|---|---|
| Branch | `tempa/p05-your-world-ui` (from `tempa/p04-your-life-ui` @ `052ee31`, incl. R1 heading-icon removal `0d9063c`; `main` @ `8ca5850` merged in) |
| **Implementation commit** | `f8c1c54aa5b76c976435fdb736adc2c31000cc2b` |
| Worktree (actual path) | **`/Users/dogukandurukan/tempa-p05`** (new). Other worktrees and `~/dating-app-recovered` untouched. |

## Provider readiness (reported separately from UI)

**No usable search provider exists in this repo.** Checked: no Spotify / TMDB /
Google Books / Open Library / MusicBrainz / Deezer / Last.fm / OMDb / iTunes
code or keys in `app/`, `lib/`, `components/`, `app.json`, `eas.json`, and no
catalog Edge Function (`supabase/functions` has only delete-account and the two
push/reminder functions). The only env keys are Supabase URL + anon key. No
credentials were invented and no paid service was set up.

So the typeahead runs on a **clearly labelled DEVELOPMENT SAMPLE catalog**
(`lib/onboardingV2/tasteSearch.ts`) behind **async adapters** with the same
signature a real provider (ideally via a server-side proxy, no client keys) would
use: `searchSchools`, `searchHometowns`, `searchArtists`, `searchBooks`,
`searchScreen`. Each Your World search screen shows the small line *"Preview
search uses a small sample list, not live results."*

**Sample coverage (real entries, no fabricated metadata, no images):**

| Adapter | Coverage | Metadata shown |
|---|---|---|
| Schools | 20 Turkish universities (e.g. Boğaziçi, İTÜ, ODTÜ/METU, Bilkent, Koç, Sabancı, Ege, Dokuz Eylül, Bursa Uludağ, Akdeniz) with aliases | city, country |
| Hometown | existing bundled location catalog: İstanbul, Ankara, İzmir, Bursa, Antalya + their districts | city / country |
| Artists | 30 artists (Turkish + international) | none (artists only; no songs/playlists/genres) |
| Books | 20 books | author |
| Movies & series | 23 titles | year · Movie/Series |

Anything else → the explicit **Use “typed text”** custom entry.

**Live search pending:** choose providers (D27 still OPEN), add a server-side
proxy (Edge Function) holding keys, map provider IDs to `TasteItem.id`, add
verified images (artist photo, book cover, poster) with licensing checked, and
swap the adapter bodies. The UI needs no change for that.

## What changed (UI)

- **Flow:** Your Life 4 Continue → **Your World 1 of 6** directly (Your Life terminal notice removed); Back from World 1 → Life 4. Connected preview = **23 steps**.
- **Screens / copy (D54):** exactly as the package (see `ONBOARDING_FLOW.md` §5). No defaults, no heading icons, 28/36 pt Playfair headings with the shared reserved title/helper block, DM Sans controls incl. Continue.
  1. Work: single choice (tap again to clear) + **Job title (optional)** "e.g. Designer".
  2. School / 3. Hometown: one search-or-enter value; once chosen it shows as a selected row with ✕ (edit = remove + search again).
  4. Interests: 16 chips, **required 3–10**, "N of 10 selected", 11th disabled (never replaces), deselect allowed, no Add later.
  5. Artists: 0–3, "N of 3 added".
  6. Books · N of 3 and Movies & series · N of 3 — independent searches and limits.
- **Typeahead (D55):** results only after ≥ 2 trimmed chars, 300 ms debounce, stale responses ignored, "Searching…" / "No matches in the preview list." / error text, none of which blocks Continue/Add later; no suggestions on an empty or cleared query. Results directly under the input; picking clears the query and dismisses results. Selected items are separate sage-filled rows with a neutral placeholder thumbnail (round for artist/school/place, tall for book/poster), subtitle or "Added as typed", and a remove button. Already-added results show "Added" and can't be re-picked; duplicate custom text shows "“X” is already added."; at 3 the field is disabled with "You've added 3. Remove one to add another."
- **Add later** (text button under Continue) on screens 1, 2, 3, 5, 6: advances, keeps valid selections, drops uncommitted query text.
- **End notice** after World 6 (Continue or Add later): *"Your World preview complete — nothing was saved, next section isn't built yet"* with **Review Your World** and **Review from Basics**.
- All earlier behaviour preserved (ruler/location, pet rules, Compatibility values, DEV landing button, `DevStepNav` V2 link, deep link, production gate). In memory only; no queries or answers logged; no network calls.

## Checks performed

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` | build | ✅ exit 0 |
| `npx expo export --platform ios` (production) | build | ✅ exit 0; "Preview new onboarding" absent, "Log In" present |
| P05 logic script (real `yourWorld.ts`, `tasteSearch.ts`, `typeahead.ts`, `previewFlow.ts`; sucrase + node; not committed) | code | ✅ 63 checks: copy/helpers/options/interests; empty defaults; screens 1/2/3/5/6 optional + skippable, 4 required, partial work draft ok; interests 2 invalid / 3 valid / 10 max / 11th refused / deselect; artist add, duplicate source ID rejected, custom exact-text + provenance, normalized custom duplicate rejected, <2 chars no custom, 4th refused, remove + reselect, custom "Sade" not merged with catalog "Sade"; books/screen independent with author / year·type; author search; school alias (METU) + city; hometown city/district; empty and 1-char queries return nothing for all 5 adapters; no-results; typeahead idle on short/cleared query, 300 ms debounce, latest result wins, stale response ignored, error state; 23 steps, Life 4 ↔ World 1, end after World 6, back path mirrors forward, all 23 valid with full drafts, interests gate intact |
| Regressions on P05 code: P02 (39), P03 R1 (28), P04 (32 — two expectations updated for intended changes: 23 steps, Life 4 → World 1; heading-icon check dropped per R1) | code | ✅ passed |
| No backend / network / logging | code inspection | no Supabase or `fetch(` in V2 preview code; no answer/query logging |
| Lint / test scripts | — | none defined in `package.json` |
| **On device** | runtime | ⏳ **PENDING** — no simulator/web runtime; no screenshots |

**Pending phone checks:** results appear under the field while typing and
disappear after picking; keyboard doesn't hide results or Continue/Add later;
selected rows vs results clearly distinct; 3-item limit message; duplicate
notice; custom "Use “…”" row; interests chip wrapping and 11th disabled; Books
and Movies groups independent on one scrolling screen; Back from World 1 keeps
Your Life (incl. pet kind) and all earlier answers; end notice; large text; Dark
Mode stays ivory.

## Phone preview — launch steps

At the time of this report the Metro server on port 8081 was running from
**`~/tempa-p04`** (P04 code — it will **not** show P05).

1. In that Metro terminal press **Ctrl + C** (or run `kill <pid>` for the process on port 8081).
2. Start P05:
   ```bash
   cd ~/tempa-p05
   git pull                     # tempa/p05-your-world-ui
   git log -1 --oneline         # this report's commit or later
   npx expo start --dev-client -c
   ```
3. Connect the **dating-app** development build with the **new** QR code (Camera
   app) or "Enter URL manually" with the address the terminal prints; `--tunnel`
   if LAN fails. No address is claimed here.
4. Signed out → landing → **DEV · Preview new onboarding** (or Safari →
   `datingapp://dev/onboarding-v2-name`).

No new dependency or native module → the existing development build suffices.

## Limitations / remaining questions

1. **Live providers** — pending (above); D27 stays open.
2. **Images** — none shown anywhere (nothing verified in the sample); neutral placeholders by design.
3. **Hometown coverage** — only 5 Turkish cities + districts; everything else via custom entry.
4. **Work status deselect** — tapping the selected status again clears it (screen is optional). *Recommendation:* keep.
5. Carried over: legacy 13+ age rule, height bounds, shared `normalizeTr` İ bug, inherited startup writes when signed in.

## Scope confirmation

UI and in-memory draft only. No Supabase writes, schema/migrations, scoring,
auth/SMS, production onboarding integration, paid provider setup, merge or
deployment. No Section 6. Stopped for owner phone review.

## Fix — 2026-09-27: text fields clipped vertically (owner phone report)

Owner screenshot (Where did you study?) showed the placeholder/text cut off at
the bottom in every V2 text field. Cause (by diff, not proven on device): P02
wrapped the `TextInput` in a flex row (`flex: 1`) to add a unit suffix; the P01
structure — underline on the `TextInput` itself — had been verified on the
phone. `OnboardingTextField` is restored to that structure (same input styles as
P01), and the only suffix user (location ✓) is overlaid on the right. Commit:
see branch head (`fix(onboarding-v2): text fields clipped vertically`).
Checks: `npx tsc --noEmit` ✅. Phone re-check pending.

## Change — 2026-09-27: outline icons on interest chips (D56)

Owner asked about emojis on interest chips; chose **outline icons** instead.
Each of the 16 chips now has a 16 pt forest-green Ionicons outline glyph left of
the label (Travel airplane, Food restaurant, Sports football, Music notes, Art
palette, Movies film, Books book, Outdoors trail sign, Tech chip, Gaming
controller, Fashion shirt, Wellness flower, Animals paw, Nightlife moon, Culture
library, Other ellipsis). All glyph names verified in the bundled glyph map.
Selection = sage fill + green border (the former checkmark is replaced by the
icon). Decorative for screen readers. `npx tsc --noEmit` ✅; phone check pending.

## R1 — 2026-09-28: input visibility + live catalog suggestions (`P05_R1_INPUT_SEARCH.md`)

- **Implementation commit:** `9a6712af69c4fe9dd18f37516d7fa263736d8b38` on `tempa/p05-your-world-ui` (`main` @ `371665a` merged in).
- **Worktree / Metro:** `/Users/dogukandurukan/tempa-p05`. The Metro server on port 8081 was verified running **from this worktree** (started 2026-09-27 23:24). The owner's clipping screenshot is from **23:27**, the earlier field fix (`49abe7c`) was committed at **23:30** — so that screenshot predates the fix; whether the phone ever reloaded after it is unknown.

### A. Field visibility

**Earlier fix present:** yes (`49abe7c`, underline back on the `TextInput`, suffix overlaid) — kept.

**Root-cause evidence (code/metrics, not device):**
1. P02 moved the `TextInput` into a flex row (`flex: 1`) — the P01 structure without it had rendered typed names correctly on the phone. Reverted in `49abe7c` (likely cause of the owner screenshot at normal text size; unverified on device).
2. **Proven by font metrics:** the input had a fixed `minHeight: 44` with 12 pt vertical padding → 32 pt for text. DM Sans's real line box (hhea 992/−310, 1.302 em, from the bundled TTF) at 19 pt is 24.7 pt ×1.0, **32.2 pt ×1.3, 39.6 pt ×1.6** (the field allows 1.6× Dynamic Type) — so at larger text sizes the glyphs exceed the frame and clip. Fix: the field height is now computed as `ceil(19 × 1.302 × min(fontScale, 1.6)) + 12 + 4`, min 44 (44 / 49 / 56 pt at 1.0 / 1.3 / 1.6×). Text scaling is **not** disabled.

**Keyboard:** a focused field (any V2 text field) now scrolls itself — and whatever is directly below it, e.g. suggestions — to the top of the visible scroll area (`OnboardingScrollContext`, measured with `measureInWindow`), again when results arrive; while the keyboard is open the scroll content gets extra bottom space (40 % of window height) so fields near the end can still move up above the pinned Continue / Add later footer. `keyboardShouldPersistTaps="handled"` keeps suggestion taps working.

**Work screen gap:** the empty space came from the reserved two-line title/helper block (98 pt) under the one-line "What do you do?". The block is now dropped while the keyboard is open (Job title moves up and is auto-scrolled into view); with the keyboard closed the reserved block is kept so option baselines stay aligned with the other questions (P03 R1 rule). Text sizes unchanged.

### B. Suggestions — provider status per category

| Category | Status | Provider | Notes |
|---|---|---|---|
| **Artists** | ✅ **LIVE** | MusicBrainz Web Service `ws/2/artist` | Artist entities only. Query `artist:(w1*) AND artist:(w2*)`; subtitle = MusicBrainz disambiguation when present; ID `mb:artist:<MBID>`. No images (MusicBrainz provides none). |
| **Books** | ✅ **LIVE** | Open Library Search API + Covers API | Query = prefix on words ≥ 3 chars; exact duplicate title+author works collapsed; subtitle = author; small cover from `covers.openlibrary.org` when `cover_i` exists; ID `ol:work:<OLID>`. |
| **Movies & series** | ✅ **LIVE** | Wikidata API (`wbsearchentities` + `wbgetentities`) | Kept only if P31 is a film or TV-series class (episodes excluded); year from P577 (film) / P580→P577 (series); title = the label the user matched (TR or EN); ID `wd:<QID>`. No posters (Commons licences vary). |
| Schools | 🟡 SAMPLE (unchanged, disclosed) | bundled 20 universities | "Preview search uses a small sample list, not live results." |
| Hometown | 🟡 SAMPLE (unchanged, disclosed) | bundled 5 cities + districts | same note |

- **No account, key, payment, scraping or Expo public secret.** Google Books was evaluated: keyless calls failed with *"Quota exceeded … Queries per day"* (shared quota), so it needs an API key → not used. TMDB/OMDb need keys → not used.
- **Terms (official docs checked):** MusicBrainz — identifying User-Agent required, ~1 request/s per IP; Open Library — identify with User-Agent (1 req/s unidentified), not for bulk/high-traffic commercial backends; Wikidata/Wikimedia — User-Agent policy, CC0 data. Sent UA: `TempaPreview/0.1 ( https://github.com/dogukandurukan/perfect-match-app )` (no personal email).
- **Behaviour preserved:** ≥ 2 chars, 300 ms debounce, stale responses ignored **and superseded requests aborted before they are sent**, per-provider throttle ≥ 1.1 s, 10 s timeout, loading / no-results / error states, explicit custom entry (now on a tinted row, visually distinct from results), duplicate handling, independent 3/3/3 limits, selection clears the query. Attribution line under results ("Suggestions from MusicBrainz / Open Library / Wikidata"); screens note "Suggestions come from public catalogs and need an internet connection."
- **Failure honesty:** network/HTTP errors show "Search isn't available right now. You can add it as typed below." — **no silent fallback to sample data**; already-selected items are unaffected. The sample artist/book/movie arrays were removed (not enlarged). Queries and answers are never logged.
- **Privacy note:** typed search text is sent from the device to these third parties (no user identifiers). Consider in KVKK review.

**Remaining dependencies (not done here):** for production — a server-side proxy with caching (rate limits are per IP; Open Library isn't meant as a high-traffic commercial backend) and a provider decision for D27 (e.g. Spotify/Deezer for artist photos, TMDB for posters — both need accounts/keys and licence review). Schools/hometown live search not started.

### Checks

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` | build | ✅ exit 0 |
| `npx expo export --platform ios` (production) | build | ✅ exit 0; DEV button still absent |
| **Live queries through the real adapter code** (node, real network, 2026-09-28) | runtime (not device) | ✅ artists: `tark`→Tarkan, `sezen ak`→Sezen Aksu, `mabel mat`→Mabel Matiz, `duman`→Duman (Turkish rock), `daft p`→Daft Punk, `adel`→Adele, `rosal`→ROSALÍA (2nd), `kendrick`→Kendrick Lamar · books: `kurk mant`→Kürk Mantolu Madonna (one run hit the old 8 s timeout → raised to 10 s; typical 1.8–2.1 s), `tutunama`→Tutunamayanlar, `saatleri ayar`→Saatleri Ayarlama Enstitüsü, `orhan pam`→Benim Adım Kırmızı…, `harry pott`→Harry Potter…, `norwegian w`→Norwegian Wood, `sapien`→Sapiens · screen: `babam ve`→Babam ve Ustam / **Babam ve Oğlum (2005 · Movie)**, `ezel`→Ezel (2009 · Series), `kis uyku`→Kış Uykusu (2014 · Movie), `leyla ile`→Leyla ile Mecnun (2011 · Series), `breaking b`→Breaking Bad (2008 · Series), `incep`→Inception (2010 · Movie), `the off`→The Office (2005 · Series), `succes`→Succession (2018 · Series) |
| R1 offline logic (fixtures + fake fetch) | code | ✅ 24: query builders; parsers (unknown/various filtered, OL exact dup collapsed, episode excluded, matched label, earliest year); re-rank; UA header; 1-char / empty → no request; HTTP 503 and network errors surface (no fallback); aborted before send; throttle ≥ 1 s; typeahead aborts superseded + cleared queries; provider-ID duplicate rejected; custom stays separate; schools/hometown still sample |
| Regressions P02 (39), P03 R1 (28), P04 (32) | code | ✅ |
| **Phone** | device | ⏳ **PENDING** — no simulator here; no screenshots |

**Pending phone checks:** Job title / School / Hometown / artist / book / movie
fields show placeholder and typed text fully (also at a larger text size);
focusing a field scrolls it up with suggestions visible above Continue/Add
later; suggestions tappable with keyboard open; live results for Turkish and
international partial queries; book covers load; airplane mode → error line +
"Use “…”" still works; selected items survive errors; 3-item limits.

### Phone instructions

Metro is running from `~/tempa-p05` (verified), so: press **`r`** in that Metro
terminal (or shake the phone → **Reload**). If it is not running:
`cd ~/tempa-p05 && git pull && npx expo start --dev-client -c`, then scan the
new QR. No new dependency (expo-image was already installed) → no new
development build. Signed out → landing → **DEV · Preview new onboarding** → go
to Your World. Needs internet for artist/book/movie suggestions.

## R2 — 2026-09-28: iOS placeholder clipping reopened (`P05_R2_IOS_INPUTS.md`)

- **Implementation commit:** `1330358e38753dbd8236406e1ae11bed9ccfc49c` (`tempa/p05-your-world-ui`, `main` @ `95814a6` merged). Metro verified running from `~/tempa-p05`.
- **Status: FIX APPLIED, NOT YET VERIFIED ON DEVICE.** No iOS simulator is available on this machine; `tsc` is not visual verification.

**What R1 did not establish:** R1's font-metric height only proved clipping at *larger* text scales; the phone still clipped placeholders at normal size, so it was not the cause.

**Root-cause evidence (from React Native 0.81.5 iOS source in `node_modules`, not device):**
- `Libraries/Text/TextInput/Singleline/RCTUITextField.mm` overrides `textRectForBounds:` (→ `UIEdgeInsetsInsetRect(…, _textContainerInset)`) and `editingRectForBounds:` (→ same), but **does not override `placeholderRectForBounds:`**.
- `React/Fabric/Mounting/ComponentViews/TextInput/RCTTextInputComponentView.mm` sets `textContainerInset = contentInsets − borderWidth`, i.e. the style **padding** (our `paddingTop 4 / paddingBottom 8`). The border is not part of the inset.
- So with vertical padding, typed text is laid out in the inset rect while UIKit lays the placeholder out via its own (non-overridden) placeholder rect — different geometry for the same font. This matches all observations: P01 typed names rendered fine on the phone; every reported clip is a **placeholder** (e.g. Designer, Search artists); it persisted through structure (P02 wrapper → R1 input border) and height (R1) changes, all of which kept the 4/8 padding.
- Placeholder attributes are the input's `defaultTextAttributes` (same DM Sans font, no `lineHeight` set by us) — font registration/line-height were checked and are not different between placeholder and typed text.

**Fix (shared `OnboardingTextField`):** `paddingVertical: 0` on the native input so typed-text rect and placeholder rect are both the field bounds; the space around the text now comes from an explicit height `max(44, ceil(19 × 1.302 × min(fontScale, 1.6)) + 16)` → 44 / 49 / 56 pt at 1.0 / 1.3 / 1.6×. Underline style (border on the input), fonts and accessible text scaling unchanged; no fake placeholder overlay. Applies to every V2 text field (names, birthday, city, job title, school, hometown, artists, books, movies). R1 keyboard behaviour (focused field + suggestions scrolled above the footer) unchanged.

**Controlled comparison for confirmation (temporary, DEV-only):** new screen `/dev/input-lab` (link **DEV · Input lab** under the preview button on the signed-out landing; production-stripped — string absent from the production bundle). It shows, each with an empty placeholder field and a typed field (`Designer gjpqy Şğ`) plus its measured frame height:
A current R2 component · B R1 (DM Sans, pad 4/8) · C B with system font · D DM Sans pad 0 · E pad 4/8 with the border on a wrapper · F pad 4/8 with intrinsic height. **One phone screenshot of this screen confirms or refutes the padding cause** (expected if correct: B, C, E, F placeholders clipped; A and D fine). Remove the lab once confirmed.

**Checks:** `npx tsc --noEmit` ✅; `npx expo export --platform ios` ✅ (DEV strings absent in production). Live search from R1 untouched (MusicBrainz / Open Library / Wikidata). **Device verification pending**: Work (Job title), School, Artists placeholders fully visible with a clear gap above the underline; typed text; focused/blurred; keyboard open with suggestions and selected rows reachable above the footer.

**Reload:** press `r` in the Metro terminal running from `~/tempa-p05` (or shake → Reload). No new build. To confirm the cause: signed-out landing → **DEV · Input lab** → one screenshot.

### Deferred — artist photos / Spotify (recorded, not started)

Owner wants photo-rich artist cards (Bumble-like); deferred. Direction: verified artist photos, compact name cards, existing ivory/forest-green theme, photos provide the colour, no heading emoji; never album art as a portrait substitute, no scraped photos. Two separate future scopes: (1) catalog search with artist images, (2) connecting a user's Spotify to import top artists (OAuth). Before choosing Spotify for production, check developer access/quota mode, the February 2026 Web API migration changes, and image/display terms: <https://developer.spotify.com/documentation/web-api/reference/search>, <https://developer.spotify.com/documentation/web-api/concepts/quota-modes>, <https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide>. **No Spotify code, account or OAuth in this revision; image integration is not complete.**

### R2 follow-up — 2026-09-28: phone still shows clipped placeholders

Owner screenshots (School, Job title) after R2 still show the placeholder drawn
~20 pt low inside a correctly sized ~44 pt field and cut at the underline. The
padding hypothesis is therefore **refuted** (or the phone did not load R2 — the
screenshots alone can't tell, as the field size is identical in both).
Not fixed. Next step is evidence, not another guess: the DEV input lab now also
has **G** (explicit `lineHeight`) and **H** (`multiline` → UITextView, whose
placeholder is a UILabel drawn by React Native itself — `RCTUITextView.mm` —
rather than UIKit's UITextField placeholder). Needed from the phone: one
screenshot of **DEV · Input lab** (A–H), and one of a Your World field with text
typed into it (typed vs placeholder).

### R2 root cause found on device evidence — 2026-09-28

- **Implementation commit:** `ee448d921fa1629d7e63c9bf5501343067b5fbab`. **Phone verification of the fix: PENDING** (needs one reload + screenshots).
- **Device evidence (owner screenshots):**
  - Input lab #1 (plain screen): all variants A–E — incl. the real `OnboardingTextField` — render placeholder and typed text correctly (fontScale 1.00, fonts loaded, frame 44). → the field's font, padding, border and height are **not** the cause; the R2 padding theory is refuted.
  - Input lab #2 (same component **inside `OnboardingScreen`**, four fields): **only the first field (A) is clipped**; P, J, S (controlled value, exact Job title props, exact School props) are correct. → neither props nor the container as such; it depends on *which native view* the field gets.
- **Mechanism (React Native 0.81.5 iOS source):** `RCTComponentViewRegistry.mm` keeps a recycle pool per component type (`_recyclePool`, `shouldBeRecycled{true}`), so native TextInput views are reused across screens. `RCTTextInputComponentView prepareForRecycle` only resets state and `attributedText = nil` — the previous input's text attributes/paragraph style are not reset. The onboarding's height ruler input uses Playfair 56 pt with **`lineHeight: 68`**; the first text field mounted afterwards (Your World Job title, School; lab #2 A) can receive that recycled view and draw its placeholder with the stale tall line box → ~16 pt low, clipped at the underline. Typed text is set freshly and was fine.
- **Fix:** the shared `OnboardingTextField` now sets an explicit `lineHeight: 25` (≈ DM Sans's own 24.7 pt line box, scaled by RN with the text size, so no extra baseline offset). Every mount therefore applies its own paragraph style, replacing any stale one. R2's zero vertical padding and computed height are kept (harmless, verified fine in lab #1).
- **Deterministic repro added to lab #2 (row R):** tap **1 ruler**, then **2 field, no lineHeight** (expected clipped if recycling is the cause) vs **1 ruler → 3 field, lineHeight 25** (expected correct).
- `npx tsc --noEmit` ✅.

**Phone check:** press `r` in the `~/tempa-p05` Metro terminal → (1) Your World Job title + School: full placeholder; (2) Safari `datingapp://dev/input-lab-2`: field A now correct, and row R 1→2 vs 1→3.
