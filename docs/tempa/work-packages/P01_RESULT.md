# P01 — Result: onboarding visual foundation + name screen

**Status: DONE (implementation, incl. D46 revision). Owner phone validation: PENDING.**
Updated: 2026-09-24. Implemented by Claude Code. Not merged, not deployed.

| | |
|---|---|
| Branch | `tempa/p01-onboarding-ui` |
| Original implementation | `54cc11981e3363530bde0614a12839ad99c7dbf4` (2026-09-23) |
| Latest `main` merged in | `b0cc5e6` (brings D46 + the revised package doc) |
| **D46 revision commit** | `26ad501d57ba0e3c939c14ac76e34afe0c2f97f5` |
| Report commit | the commit that adds this file version (branch head) |

All work happened in an isolated git worktree (`~/tempa-p01`). The owner's
main checkout (`~/dating-app-recovered`, on `main` with unrelated uncommitted
work) was not touched, staged or committed.

## What changed in the D46 revision

| File | Change |
|---|---|
| `components/onboarding-v2/OnboardingTextField.tsx` | Thin underline (1pt, darkens to green on focus), **no enclosing box**, transparent background, 19pt DM Sans input, light keyboard |
| `components/onboarding-v2/OnboardingScreen.tsx` | Heading 36/44 Playfair Display 700, wraps naturally; generous spacing that compacts while the keyboard is open; footer CTA drops the bottom safe-area gap when the keyboard covers the home indicator; `StatusBar style="dark"` on these screens (no dark-theme variant); content scrolls on small screens instead of clipping |
| `components/onboarding-v2/NameStep.tsx` | Helper grouped tightly under Last name; field-to-field spacing stays generous |
| `lib/onboardingV2/theme.ts` | Underline color `#C9C0AF`; removed now-unused field fill/radius tokens |

Unchanged from the original P01 (still valid): ivory `#F7F3EA`, forest-green
CTA `#1F3A2E`, DM Sans for body/labels/**button**, vendored static fonts with
OFL licenses, `TempaWordmark` as the single logo replacement point, header
"Tempa" + section-local **1 of 6**, copy ("What's your name?", "First name",
"Last name", "Only your first name appears on your profile.", "Continue"),
empty initial inputs, Continue enabled only when both names are non-blank,
dev-only preview route, `V2` link in `DevStepNav`.

Deliberately **not** taken from the conversational image (per package): example
names, seven progress marks, generic helper text, serif button.

## Phone preview — exact steps

**Served code:** Metro serves whatever is checked out in the folder it is started
from. Running it in `~/dating-app-recovered` will **not** show this work (that
checkout is `main` + unrelated local changes). Start it from the P01 worktree.

**Installed app:** the existing "dating-app" development build on the phone can
load it — **no new development build needed**. This package adds no npm
dependency and no native module; it uses `expo-font` and `expo-status-bar`,
which are already in the build, and the `datingapp` URL scheme has been in
`app.json` since March 2026 (before the 2026-08-26 dev build). Not verified on
the device by this agent.

1. On the Mac:
   ```bash
   cd ~/tempa-p01
   git pull                          # branch tempa/p01-onboarding-ui
   git log -1 --oneline              # should show the P01 report commit or later
   npm ci                            # only if node_modules is missing
   npx expo start --dev-client -c
   ```
   (Worktree missing? `cd ~/dating-app-recovered && git fetch && git worktree add ../tempa-p01 tempa/p01-onboarding-ui`.)
2. **Recommended:** in the app, sign out first (Profile tab → Sign Out),
   so the inherited startup writes below don't run.
3. On the phone (same Wi-Fi as the Mac), open the **dating-app** development
   build and connect to the Metro server shown in the terminal (scan the QR with
   the Camera app, or "Enter URL manually"). If the phone can't reach it on LAN,
   restart with `npx expo start --dev-client -c --tunnel`.
4. Open **Safari** on the phone, type `datingapp://dev/onboarding-v2-name` in the
   address bar, confirm **Open**. The app opens on the V2 name screen.
   - Alternative (only if already signed in and mid-onboarding): tap **V2** in the
     top-right dev jump-nav on any `/profile-setup/...` screen.
5. Check: ivory background, dark green Continue, large Playfair heading, DM Sans
   labels/button, underline fields. Type e.g. "Doğukan" / "Işık", "Şükrü" /
   "Çağlayan Öztürk"; open/close the keyboard (Continue must stay visible above
   it, both fields reachable, nothing clipped); try the phone in Dark Mode (the
   screen should stay ivory with dark status-bar icons).
6. Tap **Continue** → inline notice: *Preview only — "… …" was not saved. The
   next Basics screen isn't built yet.* Nothing else happens.
7. Screenshots: save as `docs/tempa/reviews/p01/name-screen-device.png` and
   `docs/tempa/reviews/p01/name-screen-keyboard.png`.

## Backend writes — what is and isn't write-free

- **The preview screen itself:** no Supabase reads or writes, no session
  created/changed, no navigation into unbuilt screens. Continue is local state only.
- **Inherited app startup (unchanged, not authorized to modify):** if a user is
  signed in when the app starts, `app/_layout.tsx` (`LocationBridge`) writes
  that user's location (`requestAndSaveLocation`), `last_active_at`
  (`updateLastActive`) and push token (`savePushToken`) — regardless of which
  screen is shown. Signed out → none of these run.
- **Route anchor:** `unstable_settings.anchor = '(tabs)'` may mount the tab
  navigator underneath the deep-linked route. Home's mount path only **reads**
  (profile queries, `get_top_matches`); its writes (likes, block, report) need
  user taps on Home. Tab-layout badge counts are reads.
- So: the **screen** is write-free; the **app session** is not necessarily,
  unless signed out (step 2).

## Screenshots

**None committed.** This machine has no iOS simulator (no Xcode/`simctl`) and
the project has no web runtime; the owner's phone is the only runtime. The
design mockup was not substituted. Paths reserved above (step 7).

## Checks performed (2026-09-24, on the revision)

| Check | Outcome |
|---|---|
| `npx tsc --noEmit` (whole project) | ✅ exit 0 |
| Lint / test scripts | None defined in `package.json` (pre-existing) |
| Metro bundle `npx expo export --platform ios` | ✅ exit 0; the 4 onboarding TTFs bundled |
| Turkish glyphs (fontTools cmap, 2026-09-23) | ✅ none missing in all 4 fonts; weights 700/400/500/600 confirmed |
| Production gating | Route `<Redirect href="/" />` when `!__DEV__`; DevStepNav returns null in production |
| Keyboard / narrow width / safe areas / Dark Mode on device | ⏳ **PENDING** owner phone validation |

## Remaining questions

1. **Wordmark weight** — placeholder uses Playfair 700 at 20pt; the board looks
   lighter. *Consequence:* slightly heavier header. *Recommendation:* keep; it is
   replaced centrally with the final logo.
2. **Android keyboard** — iOS uses `KeyboardAvoidingView` padding; Android relies
   on the OS resize behavior (not tested; no Android build). *Recommendation:*
   verify when an Android dev build exists; no change now.

## Confirmation

No database, migration, RPC, Supabase write, auth/SMS, startup, matching,
production deployment or other-screen changes were made. The active
onboarding/auth flow is unchanged. Not merged into `main`.
