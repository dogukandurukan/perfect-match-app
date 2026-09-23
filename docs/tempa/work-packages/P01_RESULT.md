# P01 — Result: onboarding visual foundation + name screen

**Status: DONE (implementation) — runtime screenshot not captured, see "Screenshot".**
Date: 2026-09-23. Implemented by Claude Code. Not merged, not deployed.

- **Branch:** `tempa/p01-onboarding-ui` (based on `origin/main` @ `f5b8b69`)
- **Implementation commit:** `54cc11981e3363530bde0614a12839ad99c7dbf4`
- Work was done in an isolated git worktree; the local uncommitted work in the
  main checkout (matches / micro-intro / placeSearch etc.) was not touched,
  staged or committed.

## Changed files

| File | What |
|---|---|
| `lib/onboardingV2/theme.ts` | V2-onboarding-only tokens (ivory `#F7F3EA`, dark green CTA `#1F3A2E`, dark text `#1C1B18`, borders, spacing, radii), font family names, `useOnboardingFonts()` (existing `expo-font`) |
| `assets/fonts/PlayfairDisplay_700Bold.ttf`, `DMSans_400Regular.ttf`, `DMSans_500Medium.ttf`, `DMSans_600SemiBold.ttf` | Static TTFs from `@expo-google-fonts/*` 0.4.2 (vendored; no package.json change) |
| `assets/fonts/OFL-PlayfairDisplay.txt`, `OFL-DMSans.txt` | SIL OFL 1.1 license texts retained |
| `components/onboarding-v2/TempaWordmark.tsx` | **Single replacement point** for the Tempa wordmark (swap body for final logo) |
| `components/onboarding-v2/OnboardingHeader.tsx` | Back · wordmark · section-local "N of M" |
| `components/onboarding-v2/OnboardingTextField.tsx` | Labelled field, focus border, no validation of its own |
| `components/onboarding-v2/OnboardingPrimaryButton.tsx` | Dark green CTA, disabled state, a11y |
| `components/onboarding-v2/OnboardingScreen.tsx` | Shell: safe areas, heading (Playfair 700), scroll content, footer pinned above keyboard (`KeyboardAvoidingView` + `ScrollView`) |
| `components/onboarding-v2/NameStep.tsx` | "What's your name?", First/Last name (empty), helper "Only your first name appears on your profile.", "1 of 6", Continue |
| `app/dev/onboarding-v2-name.tsx` | Dev-only preview route; `Redirect` to `/` when `__DEV__` is false |
| `components/ui/DevStepNav.tsx` | Existing `__DEV__` jump-nav: added a "V2" link to the preview |

Global palette (`lib/designTokens.ts`, `constants/theme.ts`), root layout and
all existing screens are unchanged. No new npm dependency, no native change →
**no dev-client rebuild needed** (expo-font was already in the build).

Design notes: each font weight is its own family and styles never set
`fontWeight` on them (no synthetic bold). Heading `#1C1B18` on ivory (high
contrast). Text uses `maxFontSizeMultiplier` caps so large Dynamic Type still
fits narrow widths. "Your progress is saved." from the mockup is intentionally
**not** shown (no real persistence). Continue is enabled when both names are
non-blank (existing Basics contract, D12) — no length/identity rules added;
`autoCorrect` is off so accents / non-Latin input are kept as typed.

## Preview steps

1. `git checkout tempa/p01-onboarding-ui` (or `git worktree add ../tempa-p01 tempa/p01-onboarding-ui`), `npm ci`.
2. `npx expo start --dev-client -c`, open the existing development build on the phone.
3. Open the preview route, either:
   - **Deep link:** open `datingapp://dev/onboarding-v2-name` (app scheme from `app.json`; not exercised from this machine — e.g. paste into Safari on the device, or on a simulator: `xcrun simctl openurl booted "datingapp://dev/onboarding-v2-name"`), or
   - **Dev jump-nav:** on any existing onboarding screen (`/profile-setup/...`) tap **V2** in the top-right `DevStepNav` (reaching those screens needs a signed-in account mid-onboarding).
4. Type names (try "Doğukan", "Şükrü Işık", "Çağla Öztürk", "李 伟"), open/close the keyboard, tap Continue → an inline notice says it was **not saved** and the next screen isn't built. Nothing is written anywhere.

No login is required and no session is created or changed by this route.

## Screenshot

**Not captured.** This machine has no iOS simulator (Xcode/`simctl` not
installed) and the project has no `react-native-web`; adding it would be an
unrelated dependency. The only runtime is Doğukan's phone dev-client, which
this agent cannot drive. The design mockup was deliberately **not**
substituted. Please capture one on device via the steps above and add it as
`docs/tempa/reviews/p01/name-screen-device.png` (plus one with the keyboard
open: `name-screen-keyboard.png`).

## Checks performed

| Check | Outcome |
|---|---|
| `npx tsc --noEmit` (whole project) | ✅ exit 0, no errors |
| Lint / test scripts | None defined in `package.json` (pre-existing; nothing to run) |
| Metro smoke bundle: `npx expo export --platform ios` | ✅ exit 0; all 4 TTFs listed as bundled assets; new route/strings present in the Hermes bundle |
| Turkish glyph coverage (fontTools cmap: ğĞşŞıİçÇöÖüÜ + âéñ) | ✅ no missing glyphs in all 4 fonts; weights 700 / 400 / 500 / 600 confirmed from OS/2 |
| Production gating | Code review: route returns `<Redirect href="/" />` when `!__DEV__`; DevStepNav already returns null in production |
| On-device visual check (narrow width, keyboard, safe areas) | ⏳ **Not performed** — needs device (see Screenshot) |

## Remaining questions

1. **Wordmark weight.** The mockup wordmark looks like a regular-weight serif;
   D43 only fixes Playfair 700 for question headings. Currently the
   placeholder uses Playfair 700 at 20pt. *Consequence:* slightly heavier than
   the board. *Recommendation:* keep as is — it's a temporary placeholder
   replaced centrally by the final logo; no extra font weight needed now.
2. **Continue enablement.** Enabled only when both first and last name are
   non-blank (D12 keeps both fields; D14 surname removal not approved).
   *Recommendation:* keep; revisit only if D14 changes.

## Confirmation

No database, migration, RPC, Supabase write, auth/SMS, matching, production
deployment or other-screen redesign changes were made. The active
onboarding/auth flow is unchanged.
