# P07 R1 — Result: phone-review fixes + V2 backend/scoring analysis

**Status (2026-09-28): UI fixes DONE (DEV preview). Analysis delivered as proposals. Owner phone review: PENDING.**
Not merged, not deployed. No migration, data change or scoring activation.

| | |
|---|---|
| Branch | **`tempa/p07-r1-profile-fixes`** (separate branch, as asked) |
| Base | `tempa/p07-your-profile-ui` @ `bd11f03` (latest P07; **not on `main`** — `main` @ `7ee67b5` has only docs up to the P07 package) |
| **UI implementation commit** | `b7b5a7d94a223c074c9c26a00ebb8c8bc81f8c4d` |
| Worktree | **`/Users/dogukandurukan/tempa-p07-r1`** (new; `npm ci`). `~/tempa-p07` and the others are untouched. |
| Dependencies / build | none changed; no native module → the existing development build suffices |

## A. UI fixes

### A1 Photos — real cause, then fix
**Cause (reproduced, not guessed).** `PhotosFields` laid the six slots out in
one `flexWrap: 'wrap'` row, each slot `width: '48%'` + `aspectRatio: 1`.

I rebuilt that exact style tree with **Yoga 3.2** (`yoga-layout`, the layout
engine family RN uses) inside the scroll-content context. The results:
- Photo tiles compute to **164 × 0 pt**, because their only children are absolutely positioned.
- Empty slots compute to **164 × 28 pt**, the height of the + icon.
- The grid container still reserves ~516 pt of blank space.

In a wrapping container, the default `alignItems: 'stretch'` sizes each item to its line's content height, and that overrides `aspectRatio`.

This matches the report exactly: the grid looks empty and only the title and Continue are visible. Yet the photos really are in the draft, which is why the preview shows them. Padding had nothing to do with it.

**Fix.**
- An explicit **3 rows × 2** structure: each row is `flexDirection: 'row'`, `alignItems: 'flex-start'`, gap 12, and each slot is `flex: 1`, `flexBasis: 0`, `aspectRatio: 1`.
- Re-checked in the same Yoga model: squares at every width and every fill state. At 320 / 375 / 390 / 430 pt the slots are 130 / 157–158 / 165 / 185 pt with 0, 3 or 6 photos. The content (568–733 pt) scrolls on small screens.

**Controls.**
- Main photo tag.
- ✕ remove.
- A visible **•••** button on each photo (tapping the photo does the same) opens *Make main photo / Move earlier / Move later / Replace photo / Remove photo*. These are also available as VoiceOver actions.
- The first empty slot says "Add". The helper line explains •••.
- No drag is offered or promised.

**Behaviour.**
- 3 minimum and 6 maximum are unchanged.
- Cancelling the picker changes nothing.
- A picker error shows an inline message.
- Removing a photo below 3 disables Continue.
- Back/forward keeps the photos (all drafts live in `PreviewFlow`).

**Permissions.** The iOS system photo picker (PHPicker) does not ask for library permission, so there is no "denied" path on iOS. If the picker throws, the inline error appears. Camera permission belongs to the selfie step (unchanged: Open Settings on denial).

### A2 Easier prompts
- **Library** (preview keys `weird_talent`, `dont_judge`, `cant_say_no`, `most_used_phrase`, `you_pick_topic`, `together_we_could`, `guess_about_me`, `sunday_usually`): *My weird talent… · Don't judge me, but… · I can't say no to… · My most used phrase… · You pick the topic… · Together, we could… · Guess this about me… · My Sunday usually looks like…*.
- **Starting pair:** *Don't judge me, but…* and *Together, we could…*. Answers start empty.
- **Examples:** "I read the menu, then order the same thing." and "Find the best tiramisu in Istanbul." appear only as **placeholders**. They are never stored and never satisfy the requirement (tested).
- **Rules:**
  - 2 answers required, 3rd optional and removable.
  - No duplicate prompts.
  - Changing a prompt with text asks *Keep my answer / Start a new answer*.
  - 200-character counter.
- **Layout:** cards are more compact (padding, 17/23 heading, 52 pt input). All labels are ≤ 32 characters, so two lines at most at normal size.
- **Input fix:** the multiline answer keeps its explicit `lineHeight`. The shared `OnboardingTextField` is untouched.

### A3 Profile preview
- **Structure:** one scrolling profile built from **every** section's draft (`buildProfilePreview(basics, compat, life, world, dates, profile)`).
- **Name and age:**
  - "**Name, age**" sits above the main photo, so it is visible at first glance and the photo can't push it away.
  - All photos use one 4:5 frame.
- **Order:**
  1. Main photo.
  2. **About:** city, height, zodiac (computed from DOB with the existing `lib/zodiac.ts`), job title or work status, school, "From {hometown}".
  3. Prompt 1, then photo 2.
  4. **Looking for / What matters most / Into:** intent, values, interests.
  5. Prompt 2, then photo 3.
  6. **Lifestyle:** smoking, drinking, pets incl. kind, activity.
  7. Prompt 3, then photo 4.
  8. **First dates:** types, "Weekends · Daytime", favorite spot.
  9. Photo 5.
  10. **Favorites:** artists, books, movies & series.
  11. Photo 6.
- **Empty data:** empty optional fields and empty groups (and their titles) are not rendered.
- **Favorites thumbnails:**
  - Artists get an initial placeholder circle (MusicBrainz has no images).
  - Books show the Open Library cover only when the provider gave one.
  - Otherwise a neutral book/film glyph.
- **Excluded:** surname, exact DOB, phone, email, selfie and district. There is no send/note button on your own preview; contextual notes are future visitor-profile work (D45; see the integration plan WP3).
- **Display phrasing** ("Doesn't smoke", "Has a cat", "A serious relationship"…) is proposed profile copy mapped from the approved keys. No new answers are invented.
- **Edit profile** now also offers Looking for & values, Lifestyle and First dates (each with Back to preview).

### A4 Shorter submit
- The **"Ready to submit?" state is removed.** Your Profile now has **7** states.
- On *Check your email*, a correct demo code switches the same screen to **Email confirmed** (the email is shown, with a "Change email" link and the notice "Demo check only — no email was sent and no account was verified.").
- **Submit application:**
  - The CTA becomes Submit only after the code is confirmed. Verifying alone never submits.
  - On tap it re-checks everything. If something is missing, an alert names it and **OK takes the user to that step** (photos → answers → selfie → email → code).
  - It is double-tap guarded.
- **You're on the list!** — "Thanks for joining Tempa." / "We'll email you after we review your profile." / "Application received · Review pending".
  - Small sparkles badge.
  - **One** ~1.4 s confetti burst (native driver, 14 pieces). It is **skipped entirely when Reduce Motion is on**, and it never repeats.
  - DEV notice "Preview only — no application was submitted."
  - Review my profile → Back to status (unchanged).
- The selfie and email steps are kept.

### A5 Interests
Minimum **1**, maximum 10, helper "Pick a few things you enjoy.", still required (no Add later). The counter "N of 10 selected" is unchanged.

### Docs synced
- **D59** added.
- D24/D33/D54 marked where superseded; D58 stays as history.
- `ONBOARDING_FLOW.md` §5 row 4 and §7 rewritten (7 states).
- `SCHEMA_MAPPING.md`: interests 1–10, prompt preview keys.
- `OPEN_QUESTIONS.md` Q6 note; `IMPLEMENTATION_STATUS.md` log.

## B. Analysis (proposals only)
- **`docs/tempa/V2_BACKEND_SCORING_AUDIT.md`** covers:
  - Evidence tags: live read-only DB / migrations / code / uncommitted drafts.
  - Current auth and gating, and why V2 is DEV-only.
  - RLS and storage review.
  - V1 algorithm fully extracted from the live function.
  - V1/V2 field-by-field mapping.
  - The V2 scoring proposal with a worked example.
- **`docs/tempa/V2_INTEGRATION_PLAN.md`** covers:
  - WP0–WP6 with scope, acceptance, risk and rollback.
  - The synthetic test cohort and cleanup.
  - The owner's route to Home without any client bypass.
  - Decisions waiting.
- **Most important findings:**
  1. **P0 privacy:** any signed-in user can read other visible profiles' phone, DOB, address, lat/lng and push token through the REST API. Column privileges allow it; the app only hides it in the UI.
  2. The post-login gate is `profiles.setup_completed`, which the client can write itself. V2 needs a server-controlled state.
  3. `get_top_matches` ignores the age-range filter and scores intent with V1 keys only.
  4. The V2 schema drafts exist only **uncommitted** in the main checkout and are out of date vs D15–D59.
  5. `user-photos` is public and listable by signed-out users.

## Checks

| Check | Kind | Result |
|---|---|---|
| Yoga 3.2 reproduction of old vs new photo grid (widths 320–430, 0/3/6 photos) | layout model (not device) | old: tiles 0 pt / 28 pt; new: all square |
| `npx tsc --noEmit` | build | ✅ |
| `npx expo export --platform ios` (production) | build | ✅; "Preview new onboarding" and "Input lab" absent |
| P07 R1 logic script (real modules, sucrase + node; not committed) | code | ✅ **64/64**. Covers: 7 states / 32 flow steps, Dates 2 ↔ Photos, code → received; interests 0 invalid / 1 valid / max 10 / no Add later / helper; photos 3 valid, remove to 2 invalid, max 6, main/move; new library + starting pair + hints; hints not stored and not counting; dup refused; keep-answer change; blank 3rd omitted; label length; `firstMissingStep` for photos / answers / selfie / unchecked email / bad email; verify ≠ submit; the preview contains each of 21 expected facts, excludes surname / DOB year / email / selfie / district, shows all photos once, interleaves photos, omits empty groups and titles |
| P06 checks on R1 code | code | 41/43 — the 2 failures are the intended flow-length changes |
| Glyph names | code | all present in the bundled Ionicons map |
| Live DB | read-only | schema, policies, function bodies, counts; no data written |
| **iPhone / simulator** | device | ⏳ **NOT DONE** — no simulator on this machine; static checks are not visual verification |

**Phone checks please:**
1. Photos grid: six squares 2 × 3; add 3–6, •••, main tag, ✕; remove to 2 → Continue off; picker cancel; scroll on a small screen and with large text.
2. Prompts: placeholders show and disappear on typing; Change keeps/clears; 3rd add/remove; the multiline field above the keyboard.
3. Preview: name + age above the first photo, sections interleaved, nothing empty or private.
4. Code screen: wrong code, then 123456 → Email confirmed → Submit application; Submit with a missing item takes you to it.
5. You're on the list!: confetti once (none with Reduce Motion on).
6. Interests with a single selection.
7. Placeholders after the height ruler still fully visible (input fix).

## Phone instructions
At the time of this report, Metro on port 8081 was running from **`~/tempa-p07`**. That is the P07 code without these fixes.
1. In that Metro terminal press **Ctrl + C** (or `kill` the process listening on port 8081).
2. Start R1:
   ```bash
   cd ~/tempa-p07-r1
   git pull                     # tempa/p07-r1-profile-fixes
   git log -1 --oneline
   npx expo start --dev-client -c
   ```
3. Scan the new QR code with the dating-app development build, or use "Enter URL manually" with the address the terminal prints. Use `--tunnel` if LAN fails.
4. Signed out → **DEV · Preview new onboarding** → Your Dates 2 → **Continue to your profile**.

## Not done / limits
- **No drag reorder.**
- **Scoring and backend:**
  - No backend, schema or scoring change; nothing activated.
  - Pet-matrix cells marked provisional in the audit example are my illustration values.
- **Media retention** in the preview is as in P07: cache-directory URIs, not copied or deleted by us.
- **Merge / deploy:** not merged, not deployed. Waiting for your phone review and backend decisions.

## Follow-up — 2026-09-28 (while phone review runs)

1. **P06 checks fixed, versioned.** The logic checks now live in the repo: `scripts/onboarding-v2-checks/` (run `node scripts/onboarding-v2-checks/run.js`).
   - P06's two failing expectations were updated to the approved flow: 32 steps, Dates 2 → Your Profile 1, end after received.
   - A full-draft walk of all 32 real steps was added: every step is valid, and Back mirrors forward.
   - Result: **P06 45/45, P07 R1 67/67, exit 0**. No failing test is left. Commit `bbe09c9`.
2. **V2 drafts preserved.** Branch **`tempa/v2-drafts-archive`** (`09ef63b`, pushed) contains byte-identical copies (SHA-256 checked) of `v2-schema-spec.md`, `matching-engine-v2.md`, `onboarding-v2-gap-analysis.md` and the proposed SQL.
   - The SQL is under `supabase/drafts/` so it can never be applied.
   - A README marks them **not approved** and lists the D15–D59 differences: gender/interested-in `self_describe`; old compatibility questions; smoking/drinking/pets/activity enums; no values/`respect`; no taste/interests/date types/favorite spot; old prompt keys and 300-char cap; no photo max; discovery preferences wrongly required at submit.
   - Excluded: `AGENTS.md`, `docs/brand.md`, `.codex/`, `supabase/.temp/` (CLI link state) and the uncommitted app-file edits. The secret/PII pattern scan found nothing.
   - The originals in `~/dating-app-recovered` are untouched.
3. **Plan reordered.** P0 privacy now comes **first** (§00 of `V2_INTEGRATION_PLAN.md`), before WP1.
4. **P0 remediation package.** `docs/tempa/P0_PRIVACY_REMEDIATION.md` + `supabase/proposed/` (P0-A additive, P0-B restrictive, both rollbacks, local test). Nine exposures are explained with their policy/grant and API path. Two are new in this round:
   - the **INSERT bypass** of server fields;
   - **predictable photo URLs** (`{uid}/photo_{n}.jpg`).
   - Other items covered: public vs private field split (`profile_cards` view + age-only RPC wrappers; `profiles` own-row only); the storage paths evaluated separately; server-controlled writes; the screen-by-screen client change list (R-P0, **not written yet** — it must ship with the migrations); order; rollback.
   - **Local verification:** PGlite with the real proposed files, actors anon / owner / other → **49/49**. The mutation check confirms the tests detect the fix.
   - **⚠️ Not applied live — the exposure continues** until P0-A → R-P0 → P0-B are applied. Nothing was changed live (no migration, policy, bucket or account change). No other user's data was read.
5. **Scoring.** Weights unchanged. The pet-matrix cells used in the audit example are marked "**assumption pending approval**" (they affect all four example rows).

## Visual polish — 2026-09-29 (after phone review of R1)

The phone screenshots (Your Profile **x of 7**, no "Ready to submit?") confirm the phone ran **R1**. Metro on port 8081 was verified running from `~/tempa-p07-r1`. Visual changes only; photo management, prompts, flow, backend and scoring are untouched.

1. **Main photo:**
   - "Name, age" now sits **inside the main photo, bottom-left**, in white Playfair / DM Sans, over a soft dark fade on the bottom ~42 % of the photo.
   - The fade is built from stacked translucent bands. No gradient module is installed, and adding one would require a new development build.
   - The separate name line is gone. The name comes from the real draft and appears exactly once (tested).
   - Long names wrap to at most 2 lines and are then truncated rather than overflowing.
   - No verified badge or like button.
   - On the preview step, the reserved title/helper height is dropped, so the photo starts right under "This is how others will see you." The photo uses the full content width in the same 4:5 frame.
2. **Consistent answers:**
   - *Looking for*, *What matters most* and *Into* now use the **same row style as First dates**: 17 pt forest-green outline icon + DM Sans 16/22 regular. They replace the sage chips.
   - All section titles share one style and spacing (title → answers 8 pt, group → group 16 pt).
   - Icons: Looking for → heart. Values reuse their card icons (Trust → link, Growing together → sprout, …). Interests reuse their chip icons (Travel → airplane, Books → book, …).
   - Several answers sit side by side and wrap onto the next line; text wraps instead of being cut. No emoji.
3. **You're on the list!:**
   - The sparkles glyph is replaced by a **party popper** (MaterialCommunityIcons `party-popper`, forest green, 84 pt sage circle) with two small warm-gold four-point stars.
   - The one-off confetti (gold included) and Reduce Motion skip are unchanged.
   - The copy still says received / review pending, not approved.

**Checks:**
- `tsc` ✅.
- Logic checks: P06 45/45, P07 74/74. New checks cover: name on the hero only, no separate name line, name exactly once, heart / link / outline icons, no emoji, header fallback without a photo.
- `expo export --platform ios`: DEV entries absent ✅.

**Not verified on device:**
- The fade strength on very bright photos.
- Two-line names at 320 pt width and at large text sizes.
- Wrapping of long value/interest rows.
- The badge rendering.

The fixed Continue / Back to status button is a separate footer below the scroll view (not overlaid), so it cannot cover content; content scrolls above it. Please check this on the phone too.

**Phone:** Metro is already serving `~/tempa-p07-r1`, so press **`r`** in that terminal (or shake → Reload). If it isn't running: `cd ~/tempa-p07-r1 && git pull && npx expo start --dev-client -c` and scan the new QR. The expected version is the one showing **"7 of 7"** and **"You're on the list!"** with the party popper. R1 has no build label; the build label comes with R2. No new build needed.
