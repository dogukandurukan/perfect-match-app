# P06 — Result: Your Dates preview (optional favorite spot)

**Status (2026-09-28): UI DONE in the DEV preview. Owner phone review: PENDING.**
Implemented by Claude Code. Not merged, not deployed. Section 7 (Your Profile) not started.

| | |
|---|---|
| Branch | `tempa/p06-your-dates-ui` |
| **Implementation commit** | `211e8753891dbd9c6bf45c63d9509cb68494d2cb` |
| Base | `tempa/p05-your-world-ui` @ `5385902` (descendant of the input recycling fix `ee448d9`) |
| Package source | `P06_YOUR_DATES_UI.md` taken from `main` @ `269d6a8` (the only `main` commit not in the base; it adds just this file — no older `main` code merged over P05) |
| Worktree (actual path) | **`/Users/dogukandurukan/tempa-p06`** — dependencies installed with `npm ci` (same `package.json`/lock as P05). Other worktrees untouched. |

## Input fields (carried over)

The owner reported the input fields look fixed after P05 R2 — recorded as **owner
visual acceptance**, not full accessibility/runtime verification. The shared
`OnboardingTextField` keeps its explicit `lineHeight: 25`, zero vertical native
padding and computed height. P06 only adds an optional `hideLabel` prop (the
label then names the field for screen readers only). Live catalog search from P05
R1 is untouched. The DEV input labs (`/dev/input-lab`, `/dev/input-lab-2`) are
still present; removing them is a separate cleanup.

## What changed

**Flow:** Your World 6 (Continue or Add later) → **Your Dates 1 of 2** → **2 of 2**.
The Your World terminal notice was removed. Back: Dates 1 → World 6, Dates 2 →
Dates 1. All drafts live in `PreviewFlow` state, so going back and forward keeps
every earlier answer, including the typed favorite spot. Connected preview =
**25 steps** (6 + 7 + 4 + 6 + 2), confirmed by walking `nextPos`.

**Screen 1 — "Your ideal first date?" / "Pick 1 or 2."**
- 2 × 3 cards, row-major, each with a 22 pt forest-green outline icon above the label:

  | Label | Key | Icon |
  |---|---|---|
  | Coffee | `coffee` | Ionicons `cafe-outline` |
  | Drinks | `drinks` | Ionicons `wine-outline` |
  | Dinner | `dinner` | Ionicons `restaurant-outline` |
  | A fun activity | `activity` | Ionicons `ticket-outline` |
  | A walk | `walk` | Ionicons `footsteps-outline` |
  | Outdoors | `outdoors` | MaterialCommunityIcons `terrain` (mountains) |

  The keys are the canonical `date_types` values in `SCHEMA_MAPPING.md`. "A walk" and "A fun activity" are copy changes only (formerly Walk / Something to do). All glyph names were checked against the bundled glyph maps.
- Required 1–2 and no defaults. The count reads "N of 2 selected". A third card is disabled (with an accessibility hint) and never replaces a choice. Deselect always works.
- Selected card: pale sage fill, green outline, and an absolutely-positioned corner check, so the label never moves.
- Two columns while the widest label ("A fun activity", **100.4 pt** at 16 pt DM Sans Medium, measured from the bundled TTF) fits one line. Otherwise one column (about 1.33× text on a 390 pt phone). Labels are never shrunk or split.
- Below the cards, always shown: **"Have a favorite spot?"** (header) / "For a first date. Optional." It is one `OnboardingTextField` (underline style) with placeholder "Enter a place name" and `maxLength` 120. There is exactly one field whatever types are chosen (Coffee + Dinner → still one).
- Draft: `spotText` holds the raw text as typed. `favoriteSpot()` returns `{ source: 'custom', displayName }`, trimmed, with spelling and case kept. Empty or whitespace-only means no venue. There is no place ID, coordinates or address. A typed spot never makes step 1 valid. **Future extension (documented only):** a provider-selected place would be a separate variant with provider + provider ID + branch/address.
- The Dinner follow-up (Casual & cozy / Fine dining / Either) is gone completely.

**Screen 2 — "When are you free?" / "For a first date."**
- **Days**: Weekdays / Weekends / Either as three full-width rows (existing option card, sage fill when selected).
- **Time**: Daytime / Evening / Either. The three compact controls sit on one row while "Daytime" (63.4 pt) fits a third, otherwise they stack (about 1.27× on a 390 pt phone).
- Both groups are required single choice, with no defaults. Each Either only affects its own group.
- Once both are chosen, a live summary appears, e.g. "Weekends · Daytime". Either reads "Any day" / "Any time". The helper below it is "Choose the exact time together."
- CTA **"Continue to your profile"** → the honest terminal state in the footer, shown only after the press:
  - "Your Dates preview complete"
  - "This is a development preview — nothing was saved. The next section isn't built yet."
  - Actions: **Review Your Dates** (→ Dates 1) and **Review from Basics**.

**Docs:** **D57** added (next free number). D28 is marked partly superseded and D29 superseded. `ONBOARDING_FLOW.md` §6 is rewritten. In `SCHEMA_MAPPING.md`, `dinner_style` is struck and `favorite_spot` is added as "no schema approved". `IMPLEMENTATION_STATUS.md` is updated.

**Files:** `lib/onboardingV2/yourDates.ts` (new), `components/onboarding-v2/yourDates/YourDatesFields.tsx` (new), `lib/onboardingV2/previewFlow.ts`, `components/onboarding-v2/PreviewFlow.tsx`, `components/onboarding-v2/OnboardingTextField.tsx` (`hideLabel`), `app/dev/onboarding-v2-name.tsx` (comment), docs above.

## Checks

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` | build | ✅ exit 0 |
| `npx expo export --platform ios` (production, output to a temp dir) | build | ✅ exit 0. "Preview new onboarding" is absent from the bundle, so the DEV entry is stripped. The preview component text is still bundled, but the route redirects to `/` when `__DEV__` is false — the same gate as P05. |
| P06 logic script (real `yourDates.ts` + `previewFlow.ts` + section modules; sucrase + node; not committed) | code | ✅ 43/43. Copy and canonical keys; no dinner vibe; empty defaults; 0 invalid, 1 and 2 valid; 3rd refused with no replacement; deselect; unknown key refused; spot alone does not validate; empty and whitespace spot = none; spot keeps case/spelling and only trims; no id/coords/address fields; Coffee + Dinner = one spot; maxLength 120; days-only and time-only invalid; both valid; Either/Either valid; cross-group keys invalid; no summary until both are chosen; "Weekends · Daytime", "Any day · Evening", "Weekdays · Any time", and the summary updates; 25 steps; World 6 → Dates 1; Dates 1 back → World 6; Dates 2 back → Dates 1; end after Dates 2; back path mirrors forward; interests gate intact |
| Draft retention on Back | code inspection | Drafts (incl. `spotText`) live in `PreviewFlow` state above the per-step remount, and the field is controlled from it |
| Label widths | font metrics | Measured from `DMSans_500Medium.ttf` advance widths; the method reproduces P03's "Adventure" = 74.6 pt |
| No backend / network / logging in P06 code | code inspection | No Supabase, no `fetch`, no logging of answers |
| Lint / test scripts | — | none defined in `package.json` |
| **iPhone layout** | device | ⏳ **PENDING** — no iOS simulator on this machine (`simctl` unavailable), no screenshots. The typecheck is not phone verification. |

**Pending phone checks:**
1. Placeholder "Enter a place name" is fully visible. Test it *after passing the height ruler*, where the old recycling clip appeared.
2. Typed text is fully visible; clearing it works; the text survives Back → forward.
3. Focusing the spot field scrolls it above the keyboard and the pinned Continue, and there is no huge blank gap.
4. Cards: icons, sage + green selected state, and the corner check does not shift the label. The third card is dimmed.
5. Headings fit at most two lines at normal size.
6. Screen 2: the Time row fits on one line, the summary appears only after both choices, and Either reads Any day / Any time.
7. Terminal notice and both review actions.
8. At larger text sizes: one column of cards, stacked Time controls, no truncation.

## Phone preview — Metro startup

At the time of this report the Metro server on port 8081 was running from
**`~/tempa-p05`** (P05 code — it will **not** show Your Dates).

1. In that Metro terminal press **Ctrl + C** (or `kill` the process listening on port 8081).
2. Start P06:
   ```bash
   cd ~/tempa-p06
   git pull                     # tempa/p06-your-dates-ui
   git log -1 --oneline         # this report's commit or later
   npx expo start --dev-client -c
   ```
3. Open the **dating-app** development build and connect with the new QR code (Camera app), or use "Enter URL manually" with the address the terminal prints. Use `--tunnel` if LAN fails. No address is claimed here.
4. Signed out → landing → **DEV · Preview new onboarding** (or Safari → `datingapp://dev/onboarding-v2-name`) → go through to Your World 6 → Continue / Add later.

No new dependency or native module, so the existing development build is enough.

## Limitations / notes

1. **No venue search**: the favorite spot is plain unverified text. A provider, IDs, geocoding and a proxy are future work (D27-style decision needed).
2. Spot text is trimmed only for the derived value. Inner spacing is kept as typed.
3. The Time controls have no radio dot (compact style). Selection is shown by fill and border, and screen readers announce the radio state.
4. The `either` key is shared by name between the Days and Time groups. They are separate fields (`days_pref` / `time_pref`), so this is not ambiguous.
5. Carried over: DEV input labs still present; legacy items listed in P05_RESULT.

## Scope confirmation

UI and in-memory draft only. No profile writes, auth, migrations, scoring, venue
search, geocoding, provider account, API requests, booking, scheduling, Spotify,
paid services, production navigation, merge or deployment. Your Profile / photos /
prompts / selfie / email not started. Stopped for owner phone review.
