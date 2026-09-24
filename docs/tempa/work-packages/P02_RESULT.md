# P02 — Result: connected Basics UI preview

**Status: DONE (implementation). Owner phone validation: PENDING.**
Date: 2026-09-24. Implemented by Claude Code. Not merged, not deployed.

| | |
|---|---|
| Branch | `tempa/p02-basics-ui` (from `tempa/p01-onboarding-ui` @ `5a4ed6a`, `main` @ `5b37e6f` merged in) |
| **Implementation commit** | `81b15e6c51fefbc911d18047b97130ba75ec1ece` |
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
| 5 | Where do you live? | Manual **City** field only (no GPS, map, lookup, neighborhood or distance) | non-blank |
| 6 | How tall are you? | Whole number with visible **cm** unit | positive whole number |

- **Back** (header, and Android hardware back) steps to the previous screen with all answers kept. Swipe-back is disabled on this route so it can't close the flow mid-way; Back on step 1 leaves the preview if there is a screen underneath.
- **Draft:** in memory for this preview session only; lost when the screen closes or the app reloads. Nothing claims to be saved.
- **End state:** Continue on step 6 shows one compact notice — *"Basics preview complete. This is a preview — nothing was saved. The next section isn't built yet."* — with a **Review previous steps** button (back to step 1, answers kept). No success/submission/membership/discovery state, no Section 3.
- Unicode kept as typed (autocorrect off): Turkish (ğ ş ı İ ç ö ü) and non-Latin scripts.

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
| `components/onboarding-v2/NameStep.tsx` | removed (content moved into `BasicsFields.tsx`) |

No new dependency, no native change → **existing phone development build works, no rebuild**.

## Phone preview — exact steps

**Which code is served:** Metro serves the folder it is started in. At the time
of this report a Metro server **was already running from `~/tempa-p01`** on port
8081 (P01 code — it will NOT show P02). Stop it and start from `~/tempa-p02`.
Your main checkout does not need to change.

1. In the terminal where Metro is running, press **Ctrl + C** to stop it.
2. Start P02:
   ```bash
   cd ~/tempa-p02
   git pull
   git log -1 --oneline        # this report's commit or later on tempa/p02-basics-ui
   npx expo start --dev-client -c
   ```
   (`node_modules` is already installed in `~/tempa-p02`; if missing run `npm ci`.)
3. Terminal prints a QR code and the `exp+dating-app://…` / LAN address it is serving
   (this agent did not start a server, so no address is claimed here). On the phone
   open the **dating-app** development build and scan the QR with the Camera app,
   or use "Enter URL manually" with the address the terminal shows. If LAN fails:
   `npx expo start --dev-client -c --tunnel`.
4. Recommended: sign out in the app first (Profile tab → Sign Out) — see side effects.
5. Safari on the phone → `datingapp://dev/onboarding-v2-name` → **Open**.
   The app opens on **What's your name? — 1 of 6**.

## Backend requests

- **The preview itself makes no backend requests** — no Supabase import in any P02 file (`grep` of `components/onboarding-v2`, `lib/onboardingV2`, `app/dev`).
- **Inherited startup (unchanged):** if signed in, `app/_layout.tsx` writes location, `last_active_at` and push token at app start, regardless of screen. Signed out → none.
- Route anchor `(tabs)` may mount Home underneath; its mount path only reads (profile, `get_top_matches`).

## Checks performed

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` | build | ✅ exit 0 |
| `npx expo export --platform ios` | build | ✅ exit 0; 4 onboarding fonts bundled |
| Logic script on the real `basics.ts` (sucrase-transpiled, node asserts; not committed) | code | ✅ 27 assertions: 31/02, 29/02 non-leap vs leap, month 13, future date, under 18 (incl. 18th birthday today vs tomorrow), > 120, 2-digit year incomplete; Everyone exclusivity both directions + deselect; every step invalid when empty; Unicode names/city valid; height 0 / non-digit invalid |
| Forward/back retention | code inspection | draft held in `BasicsFlow` state above all steps; steps only render from it |
| Lint / test scripts | — | none defined in `package.json` (pre-existing) |
| **On device** | runtime | ⏳ **PENDING** — no simulator/web runtime here |

**Pending phone checks:** all six screens render with correct fonts/palette;
keyboard open on steps 1, 2, 5, 6 keeps fields and Continue visible; Day→Month→Year
auto-advance; inline DOB errors; Everyone exclusivity by tapping; Back from 6 → 1
keeps every answer; end notice + Review previous steps; small width / large text;
Dark Mode stays ivory. The 2026-09-24 19:08 screenshot supports only P01's name
screen state; it does not validate P02.

## Remaining questions

1. **Legacy 13+ age rule** vs 18+ policy. *Consequence:* the current production onboarding may accept 13–17-year-olds. *Recommendation:* treat 18+ as authoritative and fix the legacy screen in a separately authorized task (or retire it with V2).
2. **Height bounds** — none defined. *Consequence:* values like 5 or 999 pass. *Recommendation:* decide product bounds (e.g. align with the 140–220 filter range or a wider sanity range) before persistence is built.
3. **"Who are you interested in?" helper copy** — none specified, so none shown; checkboxes indicate multi-select. *Recommendation:* keep unless reviewers find it unclear.

## Scope confirmation

UI code and in-memory draft/navigation only. No DB, migration, RPC, Supabase
write, auth/SMS, production onboarding integration, startup, matching/scoring,
merge or deployment changes. No other sections. P03 not started.
