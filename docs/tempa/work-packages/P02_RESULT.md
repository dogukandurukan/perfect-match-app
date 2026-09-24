# P02 — Result: connected Basics UI preview

**Status: DONE (implementation, incl. D47/D48/D49 revision). Owner phone validation: PENDING.**
Date: 2026-09-24 (revision same day). Implemented by Claude Code. Not merged, not deployed.

| | |
|---|---|
| Branch | `tempa/p02-basics-ui` (from `tempa/p01-onboarding-ui` @ `5a4ed6a`, `main` @ `5b37e6f` merged in) |
| Original implementation | `81b15e6c51fefbc911d18047b97130ba75ec1ece` |
| `main` merged for the revision | `0c17ad8` (D47–D49 + revised package) |
| **D47/D48/D49 revision commit** | `fab97121913f4354283d2b5bbfd41efa0504e043` |
| Worktree | `~/tempa-p02` (new, isolated). `~/dating-app-recovered` and `~/tempa-p01` untouched. |

## What it does

Six connected screens in one dev-only route, same warm-ivory / forest-green
D46 look, Playfair Display 700 headings, DM Sans body/controls, shared Tempa
header with section-local **1 of 6 … 6 of 6**, Continue above the keyboard.

| # | Screen | Input | Continue enabled when |
|---|---|---|---|
| 1 | What's your name? | First name, Last name (underline fields); helper "Only your first name appears on your profile." | both non-blank |
| 2 | When's your birthday? | Separate labelled **Day / Month / Year** number fields (DD / MM / YYYY placeholders, nothing preselected, auto-advance); helper "Only your age appears on your profile." | real calendar date, not in the future, age 18–120 (inline error otherwise) |
| 3 | What's your gender? | Woman / Man / Non-binary — single choice (radio), no default | one selected |
| 4 | Who are you interested in? | Women / Men / Non-binary people / Everyone — multi (checkbox). Everyone clears the others; any specific option clears Everyone | ≥ 1 selected |
| 5 | Where do you live? | **City or district** field; matching suggestions appear directly underneath (D49). Tapping one fills the field with its label (✓); editing the text clears the selection. Honest "No matching city or district in this preview." state. No GPS, map, address, neighborhood or distance. | an actual suggestion is selected |
| 6 | How tall are you? | Large centred number (Playfair) with adjacent smaller **cm**; tap the number to type; horizontal 1 cm ruler with fixed green marker below, snaps per cm (D48). Number and ruler stay in sync. Starts **empty (—)** — the ruler's neutral visual position is never submitted. VoiceOver: ruler is adjustable (swipe up/down = ±1 cm). | positive whole number, set by dragging or typing |

- **Back** (header, and Android hardware back) steps to the previous screen with all answers kept. Swipe-back is disabled on this route so it can't close the flow mid-way; Back on step 1 leaves the preview if there is a screen underneath.
- **Draft:** in memory for this preview session only; lost when the screen closes or the app reloads. Nothing claims to be saved.
- **End state:** Continue on step 6 shows one compact notice — *"Basics preview complete. This is a preview — nothing was saved. The next section isn't built yet."* — with a **Review previous steps** button (back to step 1, answers kept). No success/submission/membership/discovery state, no Section 3.
- Unicode kept as typed (autocorrect off): Turkish (ğ ş ı İ ç ö ü) and non-Latin scripts.

- **Birthday (D47):** Day / Month / Year UI and validation unchanged from the original P02.

## D48 / D49 details

**Height ruler.** Visible ruler window starts at 120–230 cm. This is a
**viewport only, not a bound**: typing a valid value outside it (e.g. 95 or
250) re-centres the window around that value (±60 cm). Manual typing of any
positive whole number (max 3 digits) remains available. Product min/max remain
undecided (unchanged open question). Small hint added under the number:
*"Tap the number to type it, or slide the ruler."* (not in the written copy —
added for discoverability; remove if reviewers prefer).

**Location catalog — preview coverage (bundled, real, no network).**
`lib/onboardingV2/locationCatalog.ts`, reusing the official district lists in
`lib/turkishGeo.ts`: **5 cities — İstanbul (39 districts), Ankara (25),
İzmir (30), Bursa (17), Antalya (19) — 135 entries total.** Nothing outside
these is found. The helper under the field states this: *"Preview search covers
İstanbul, Ankara, İzmir, Bursa, Antalya and their districts only."* This is **not**
worldwide production autocomplete; `searchLocations()` (async) is the seam a real
provider can replace. Draft keeps `{ id, kind, city, district, country, label }`,
e.g. `tr-istanbul-kadikoy / district / İstanbul / Kadıköy / Turkey`. Display of a
district publicly, scoring and schema are untouched (D49 limits).

⚠️ **Bug found in shared code (not changed):** `normalizeTr()` in
`lib/turkishGeo.ts` lowercases before folding Turkish letters, so
`"İstanbul"` becomes `"i̇stanbul"` (with U+0307) and never equals `"istanbul"`.
Existing callers use ASCII keys (`Istanbul`), which is why it hasn't shown up.
The V2 catalog uses its own `foldTr()` (fold first, strip combining marks). Fixing
the shared function is a separate change.

## Inherited validation rules (reused, not invented)

- **Age 18+** — from the in-app privacy notice (`app/privacy-notice.tsx`: "yalnızca 18 yaşını doldurmuş kullanıcılara yöneliktir"), consistent with `discovery_age_min >= 18` in migrations. **Upper bound 120** from legacy `app/profile-setup/step1/birthdate.tsx`. Age computed with the existing `calculateAge` (`lib/zodiac.ts`).
- ⚠️ **Discrepancy found (not changed):** the legacy birthdate screen accepts **13+** (`ageYears >= 13`), contradicting the 18+ privacy notice. P02 uses 18. The legacy screen is out of scope and was not modified.
- **Height** — legacy code only requires a positive integer; there are **no product bounds** in the repo (140–220 in `filters.tsx` is a discovery filter range, not an input rule). P02 enforces positive whole cm, max 3 digits (input length only). **Missing product bounds are reported, not invented** (see questions).

## Changed files

| File | Change |
|---|---|
| `lib/onboardingV2/basics.ts` | new — draft type, D15/D15b option sets, `toggleInterestedIn`, `parseDob`, `parseHeightCm`, `isStepValid` (pure) |
| `components/onboarding-v2/basics/BasicsFlow.tsx` | new — step state, draft, Back/Continue, end notice |
| `components/onboarding-v2/basics/BasicsFields.tsx` | new — per-step fields (name fields moved here from P01's `NameStep`) |
| `components/onboarding-v2/OnboardingOptionCard.tsx` | new — radio / checkbox option row |
| `components/onboarding-v2/OnboardingTextField.tsx` | underline now on a row wrapper; optional `suffix` (cm) and `containerStyle` |
| `components/onboarding-v2/OnboardingScreen.tsx` | `contentKey` so each step starts scrolled to top |
| `lib/onboardingV2/theme.ts` | `error` color token |
| `app/dev/onboarding-v2-name.tsx` | same route, now renders the connected flow; swipe-back off |
| `components/onboarding-v2/basics/HeightRuler.tsx` | **revision** — new: number + cm + ruler (D48) |
| `lib/onboardingV2/heightRuler.ts` | **revision** — new: pure ruler math (window, offset↔cm) |
| `lib/onboardingV2/locationCatalog.ts` | **revision** — new: bundled preview catalog, `foldTr`, `searchCatalog`, async `searchLocations` seam |
| `lib/onboardingV2/basics.ts` | **revision** — draft `locationQuery` + structured `location`; `editLocationQuery` / `selectLocation`; step 5 needs a selection |
| `components/onboarding-v2/basics/BasicsFields.tsx` | **revision** — location suggestions + height ruler wired in |
| `components/onboarding-v2/NameStep.tsx` | removed (content moved into `BasicsFields.tsx`) |

No new dependency, no native change → **existing phone development build works, no rebuild**.

## Phone preview — exact steps (same worktree)

**Which code is served:** Metro serves the folder it is started in. At the time
of this revision a Metro server **was already running from `~/tempa-p02`**
(port 8081). The revision is in that same worktree, so **no restart is needed —
press `r` in that Metro terminal** (or shake the phone → Reload). If Metro isn't
running any more:

```bash
cd ~/tempa-p02
git pull                     # tempa/p02-basics-ui
git log -1 --oneline         # this report's commit or later
npx expo start --dev-client -c
```
Connect the **dating-app** development build with the QR the terminal prints
(or "Enter URL manually" with the address it shows; `--tunnel` if LAN fails).
No new dependency or native module → **no new development build**.
Recommended: sign out first (Profile tab → Sign Out). Then Safari on the phone →
`datingapp://dev/onboarding-v2-name` → **Open** → *What's your name? — 1 of 6*.

## Backend requests

- **The preview itself makes no backend requests** — no Supabase import in any P02 file (`grep` of `components/onboarding-v2`, `lib/onboardingV2`, `app/dev`).
- **Inherited startup (unchanged):** if signed in, `app/_layout.tsx` writes location, `last_active_at` and push token at app start, regardless of screen. Signed out → none.
- Route anchor `(tabs)` may mount Home underneath; its mount path only reads (profile, `get_top_matches`).

## Checks performed

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` (revision) | build | ✅ exit 0 |
| `npx expo export --platform ios` (revision) | build | ✅ exit 0 |
| Logic script on the real `basics.ts`, `heightRuler.ts`, `locationCatalog.ts` (sucrase-transpiled, node asserts; not committed) — revision | code | ✅ 39 checks: `istanbul` → İstanbul, Turkey; `kadikoy` → Kadıköy, İstanbul, Turkey; `İSTANBUL`/`ISTANBUL`/`Kadıköy`/`KADIKÖY`/`uskudar`/`sisli`/`karsiyaka`/`kadikoy ist`; `london` → no results (nothing invented); structured id/kind/city/district/country; typed text alone invalid, selection valid, editing invalidates, selection retained across steps; ruler offset↔cm round trips, snapping, re-centre for 95 / 250, no default height, 0 invalid, 250 valid (no bounds); earlier DOB/Everyone rules |
| Original P02 logic script | code | ✅ 27 assertions (DOB, Everyone, required steps) |
| Forward/back retention | code inspection | draft held in `BasicsFlow` above all steps; ruler re-opens on the stored value |
| Lint / test scripts | — | none defined in `package.json` (pre-existing) |
| **On device** | runtime | ⏳ **PENDING** — no simulator/web runtime here |

**Device evidence so far:** the 19:26–19:27 screenshots show rendering of the
birthday, city (pre-revision free text) and height (pre-revision plain field)
screens only. They do not validate the revision or all P02 behaviour.

**Pending phone checks:** ruler drags smoothly and snaps per cm, marker lines up
with ticks, number updates while dragging; typing 182 moves the ruler, typing 250
re-centres it; ruler/number empty until touched; VoiceOver adjust ±1; suggestions
appear under the field for `istanbul` / `kadikoy`, tap selects (✓), editing clears
it, Continue disabled until selected, `london` shows the no-results line; keyboard
doesn't hide suggestions or Continue; Back 6 → 1 keeps every answer (incl.
location and height); small width / large text; Dark Mode stays ivory.

## Remaining questions

1. **Legacy 13+ age rule** vs 18+ policy. *Consequence:* the current production onboarding may accept 13–17-year-olds. *Recommendation:* treat 18+ as authoritative and fix the legacy screen in a separately authorized task (or retire it with V2).
2. **Height bounds** — still none defined (ruler window is not a bound). *Consequence:* values like 5 or 999 pass. *Recommendation:* decide product bounds (e.g. align with the 140–220 filter range or a wider sanity range) before persistence is built.
3. **"Who are you interested in?" helper copy** — none specified, so none shown; checkboxes indicate multi-select. *Recommendation:* keep unless reviewers find it unclear.
4. **Shared `normalizeTr` İ bug** (see D48/D49 details). *Consequence:* any future search comparing Turkish display names via it will miss İstanbul/İzmir. *Recommendation:* fix in a small separately authorized change.
5. **Ruler hint copy** — added for discoverability. *Recommendation:* keep unless reviewers object.

## Scope confirmation

UI code and in-memory draft/navigation only. No DB, migration, RPC, Supabase
write, auth/SMS, production onboarding integration, startup, matching/scoring,
merge or deployment changes. No paid service, API key, network geocoder, GPS
or exact address. No other sections. P03 not started.
