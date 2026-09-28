# P07 — Result: Your Profile preview (photos → received)

**Status (2026-09-28): UI DONE in the DEV preview. Owner phone review: PENDING.**
Implemented by Claude Code. Not merged, not deployed, no backend connection.

| | |
|---|---|
| Branch | `tempa/p07-your-profile-ui` |
| **Implementation commit** | `66cc299fdc555429f905b03d9b9c526b0ac64325` |
| Baseline | `tempa/p06-your-dates-ui` @ `445a646` (P06 plus the Time icons; P05 input fixes included) |
| Package source | `P07_YOUR_PROFILE_UI.md` taken alone from `main` @ `7ee67b5` (`main` has no P02–P06 code; nothing else from `main` was merged, so no older code overwrote the branch) |
| Worktree (actual path) | **`/Users/dogukandurukan/tempa-p07`** (new; `npm ci`, same lockfile). Other worktrees untouched. |
| Dependencies / build | **No dependency change, no new native module.** Uses the installed `expo-image-picker` (library + camera) and `expo-image`. `npx expo config --type introspect` shows `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` generated from the installed picker (and the legacy onboarding already calls the front camera). The existing development build should therefore work; this is **not yet confirmed on the phone**. If the camera prompt never appears or the app reports a missing usage description, the dev client must be rebuilt (`npx eas build --profile development --platform ios`). |

The owner's P06 feedback, including the icons, is recorded as visual acceptance ("looks good"), not exhaustive verification.

## Flow

Your Dates 2 **Continue to your profile** → **Your Profile 1 of 8**. The P06
terminal notice is removed. Back from Photos → Dates 2. Connected preview =
**33 steps** (6 + 7 + 4 + 6 + 2 + 8), confirmed by walking `nextPos`. The 8 main
states are listed below. The prompt picker sheet and the photo action sheet are
not extra states. All drafts, including media URIs, persist across back,
forward and edit until the preview screen is closed or the app reloads (in
memory only).

| # | State | Implementation |
|---|---|---|
| 1 | **Add your photos** / "Add at least 3 photos." | 2 × 3 slots, **3–6**. Empty slot → system photo picker, batch within remaining capacity (`selectionLimit`), ordered. Cancel changes nothing. First slot tagged **Main photo**. ✕ removes. Tapping a photo opens actions: Make main photo / Move earlier / Move later / Replace photo / Remove photo, also exposed as VoiceOver custom actions. **No drag** (not implemented), so "Drag to reorder." is **not** shown; the line reads "N of 6 added · Tap a photo to reorder, replace or remove." A photo whose image fails to load is shown as "Couldn't load. Tap to replace." and does not count. Picker errors show an inline message; nothing crashes and no placeholder counts. |
| 2 | **A little more you** / "Answer 2 questions. Add a third if you like." | Starts with "I'm most myself when…" and "Something I could talk about for hours…" (D33), answers **empty**. Each card has **Change**, which opens a sheet listing only prompts not used in other slots. If the answer is non-empty, it asks **Keep my answer** / **Start a new answer** / Cancel — never a silent discard. Multiline answer, "Short answers are welcome." + `N/200` counter. **Add another answer · Optional** picks the third prompt; the third is removable, and if left blank it is omitted. Whitespace-only = empty. CTA **Preview my profile** needs 2 non-empty answers. |
| 3 | **Your profile** / "This is how others will see you." | `buildProfilePreview` from the real drafts, D44 order: main photo + first name, age → facts card → prompt 1 → photo 2 → prompt 2 → photo 3 → prompt 3 (if filled) → photos 4–6. The facts card holds city only (no district), job title or else work status, school, "From {hometown}", height, interest chips, and chosen artists / books / movies (titles only). Empty fields are omitted. **Edit profile** offers Photos / Answers / Name, age, location, height / Work, school, interests, favorites; each editor shows a **Back to preview** link (enabled when that step is valid). **Continue** re-checks the photo and answer counts. |
| 4 | **A quick selfie** / "Help us check it's really you." | CTA **Take selfie** asks for camera permission on tap, then opens the **front** system camera (no gallery option). The result shows in an oval frame with **Use selfie** / **Retake**; after Use: **Continue** + Retake. Permission denied → message + **Open Settings**. No camera / camera error → honest message; the step stays blocked. Cancel keeps the previous state. Copy: "Your selfie stays private." / "We'll review it with your profile photos." + DEV notice "Preview only — this selfie is not uploaded or reviewed." The oval is our own frame around the result; the system camera UI itself has no guide overlay. |
| 5 | **Your email** / "We'll send you a code." | Label "Email", empty, email keyboard, no autocapitalization / autocorrect, "Your email stays private.", DEV notice "Preview only — no email will be sent." Shape check (`local@domain.tld`). **Send code** only moves to the next state. |
| 6 | **Check your email** | "Enter the code sent to {email}". Six boxes mirror one real input (number pad, `oneTimeCode`, paste — digits are extracted, e.g. "Code: 123 456" → 123456). DEV notice "Demo code: 123456. No email was sent." **Verify email**: fewer than 6 digits → "Enter the 6-digit code."; wrong → "That code isn't right. Try again." **Resend code** has a simulated 30 s cooldown (clears the code). **Change email** clears the code and the demo check and returns to state 5. |
| 7 | **Ready to submit?** | Checklist: Photos added / Answers added / Selfie added / Email checked (demo), each re-evaluated live from the drafts. "Our team reviews every profile before it goes live. We'll email you once yours has been reviewed." — no timeframe, price or acceptance promise. DEV notice "Preview only — no application will be sent." **Submit application** is disabled unless all four hold and is guarded against rapid double taps. Verifying the email never submits. |
| 8 | **You're on the list** | "We've received your application." / "We'll email you when your profile has been reviewed." Sage panel "Application received" / "Review pending". DEV notice "Preview only — no application was submitted." Header back hidden. **Review my profile** (outline button) → the preview in review mode: **Back to status**, Edit profile still available with revalidation, and header back returns to status. |

Styling uses the existing ivory / forest / sage tokens, 28/36 Playfair titles, DM Sans controls and the keyboard-safe `OnboardingScreen`. There are no heading emoji and no mockup people, answers or email in any draft.

**Input fix preserved:** the shared `OnboardingTextField` is unchanged (explicit `lineHeight: 25`, zero native vertical padding). The new multiline answer input and the hidden code input also set an explicit `lineHeight`, so a recycled iOS TextInput cannot keep a previous paragraph style. Focused answers scroll above the keyboard and footer using the existing reveal behaviour.

## LOCAL vs SIMULATED vs NOT IMPLEMENTED

| Operation | Status |
|---|---|
| Photo library pick, remove, replace, reorder, main photo | **LOCAL** — device URIs held in memory |
| Front-camera selfie capture, retake | **LOCAL** — device URI held in memory, kept separate from the photos, never in the public preview |
| Profile preview assembly | **LOCAL** — derived from the drafts |
| Send code, resend cooldown, code check (123456), "Email checked (demo)" | **SIMULATED** — no email, no OTP, no auth user; demo check stored in the preview draft and bound to the exact normalized email |
| Submit application, "received", review pending | **SIMULATED** — local marker only; double-tap guard is not production idempotency |
| Upload to storage, image processing, face/clear-face check, liveness, manual review queue | **NOT IMPLEMENTED** |
| Real email OTP attached to the phone-auth user (D8), application record/RPC, review/membership/eligibility state machines, drag-to-reorder, code expiry | **NOT IMPLEMENTED** |

**Media retention (limitations):** the picker and camera return file URIs in the app's **cache** directory (expo-image-picker behaviour). We do not copy them to permanent storage, save the selfie to the photo library, upload or log them. We also do not delete them: the OS may clear the cache at any time, which would turn a kept photo into "Couldn't load". Closing the preview or reloading drops all references. A production build must upload to private storage (selfie → private `verification-selfies` bucket), clean up local files and define retention (KVKK review of selfie/biometric-adjacent data).

## Checks

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` | build | ✅ exit 0 |
| `npx expo export --platform ios` (production, temp dir) | build | ✅ exit 0. "Preview new onboarding" and "Input lab" are absent from the bundle; "Log In" is present. The preview route still redirects to `/` when `__DEV__` is false. |
| P07 logic script (real `yourProfile.ts`, `previewFlow.ts`, section modules; sucrase + node; not committed) | code | ✅ **62/62**. Copy; empty draft; photos: 2 invalid / 3 valid, batch capped at 6, full refuses, empty URI ignored, remove to 2 invalid, make main, move earlier/later/clamped, replace keeps position, a broken photo doesn't count. Prompts: D33 defaults empty, library copy, unique IDs, 0/1 answer invalid, whitespace invalid, 2 valid, 200 cap, duplicate prompt refused, change keeps the answer / explicit clear, available list, blank third ok + omitted, third duplicate refused, no fourth, filled third shown, third removable, duplicate IDs invalid. Email shape; paste sanitizing; demo/wrong code; check bound to email (case-insensitive); changing the email clears code/check; same email keeps it; cooldown. Checklist/submit: all valid, and selfie / email / photos each required; received needs the marker; selfie independent of photos. Privacy: preview JSON has no surname, DOB year, email, selfie or district, and no badge. Hero, D44 block order, facts, interests/favorites from the draft, empty optionals omitted. Flow: 33 steps, Dates 2 → Photos, Photos back → Dates 2, received last, submit validity. |
| P06 checks re-run on P07 code | code | 41/43 — the two failures are the **intended** changes (25 → 33 steps; Dates 2 is no longer the end) |
| Glyph names | code | all Ionicons names used exist in the bundled glyph map |
| Back / edit retention | code inspection | all drafts in `PreviewFlow` state above the per-step remount; editors write the same drafts; `returnTo` / review mode only change navigation |
| Lint / tests | — | none defined in `package.json` |
| **iPhone** | device | ⏳ **PENDING** — no simulator here; no screenshots; photo/camera permission prompts not observed |

**Pending phone checks:**
1. Photos: the picker opens and multi-select respects the remaining count; photos fill the square slots (cover crop); Main photo tag; ✕; the actions sheet; replace; cancelling the picker.
2. Prompts: the multiline answer grows and scrolls above the keyboard and footer; the Change sheet; the keep/clear question; add/remove the third; the counter.
3. Preview: order and facts; nothing private; Edit profile → Back to preview.
4. Selfie: the camera permission prompt, front camera, Use / Retake; denial → Open Settings.
5. Email / code: the email keyboard; typing, pasting and autofilling the code; wrong code; Resend cooldown; Change email.
6. Submit / received: the checklist; Review my profile → Back to status.
7. The name/text field placeholders are still fully visible **after the height ruler**; the Dates spot field; large text; Dark Mode stays ivory.

## Remaining backend / privacy requirements (not done)

Private storage upload with RLS for photos (public bucket rules) and the selfie (private bucket, reviewer-only). Real email OTP on the same auth user (D8) with rate limits and expiry. A server-side, idempotent submission RPC and application state machine separate from verification and membership (D35 rejection/resubmission still open). Prompt storage keys (Q6 open) and `profile_prompts` revision. Clear-face policy (D34 open). KVKK consent/retention for the selfie and email. Media cleanup.

## Phone preview — Metro startup

At the time of this report, the Metro server on port 8081 was running from **`~/tempa-p06`**. That is P06 code, so it will **not** show Your Profile.

1. In that Metro terminal press **Ctrl + C** (or `kill` the process listening on port 8081).
2. Start P07:
   ```bash
   cd ~/tempa-p07
   git pull                     # tempa/p07-your-profile-ui
   git log -1 --oneline         # this report's commit or later
   npx expo start --dev-client -c
   ```
3. Open the **dating-app** development build and connect with the new QR code (Camera app), or use "Enter URL manually" with the address the terminal prints. Use `--tunnel` if LAN fails. No address is claimed here.
4. Signed out → landing → **DEV · Preview new onboarding** (or Safari → `datingapp://dev/onboarding-v2-name`) → go through to Your Dates 2 → **Continue to your profile**.

The P05/P06 `DevStepNav` shortcuts are unchanged. Reaching Your Profile requires walking the earlier sections (all answers are kept).

## Scope confirmation

DEV preview, in-memory drafts and user-selected local media only. No Supabase, auth or storage writes, real email/SMS, application submission, face recognition, automatic verification, payments, production integration, merge or deployment. No permission mode or safeguard changed. Stopped for owner phone review.
