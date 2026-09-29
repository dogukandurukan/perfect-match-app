# P07 R2 — Result: photo management, prompt catalog, DEV build label

**Status (2026-09-29): implemented. Checks passing. Web-runtime scenarios verified. ✅ Owner phone acceptance recorded (see §7).**
Not merged, not deployed, no backend change.

| | |
|---|---|
| Branch | **`tempa/p07-r2-photos-prompts`** |
| **Implementation commit** | `6a5c267` (on top of `54e24fe` WIP → `7d64403` approved visuals) |
| Worktree | **`/Users/dogukandurukan/tempa-p07-r2`** |
| Backups | `tempa/p07-r2-wip-backup` (`54e24fe`, pushed) keeps the pre-completion WIP. The approved **`7d64403`** stays on `tempa/p07-r1-profile-fixes` (origin), so it can always be returned to. |
| Dependencies / build | **No package change, no new native module.** Gesture Handler, Reanimated, expo-image and expo-image-picker are already in the development build. `app.config.js` (new) only adds manifest `extra` data → **no new build needed**. |

## 1. Which version the phone ran

The phone screenshots showed "1 of 8" and *Ready to submit?*. At that time:
- Metro on **:8081** ran from **`~/tempa-p07` @ `bd11f03`** (P07, before R1).
- The served iOS bundle, fetched and searched, contained "Ready to submit?" and the old prompts. It did **not** contain "You're on the list!" or the R1 copy.
- So the phone had never run R1.
- The HARFI project on :8082/:8093 is unrelated and was left alone.
- Later screenshots (7 of 7) match R1 from `~/tempa-p07-r1`, which still serves :8081 now.

**DEV build label (new):**
- The signed-out landing shows `dating-app · <commit>[+local changes] · <worktree>` under the DEV buttons.
- The values are read by `app.config.js` from git when the Expo CLI evaluates the config. They are never invented; without git they read `unavailable`.
- It is rendered only under `__DEV__`, and the EAS production profile gets no value.
- Verified in the web runtime: `dating-app · 54e24fe+local changes · tempa-p07-r2` before this commit.

## 2. Photo problem — proven causes

1. **Zero-height tiles (P07 code).** In a wrapping row, `width: '48%'` + `aspectRatio` collapsed photo tiles to 0 pt and empty slots to 28 pt (Yoga reproduction, R1). The phone screenshots after adding photos show exactly this: only the empty slots remain visible. It was fixed in R1, but the phone was still on P07.
2. **Stale-list overwrites (P07/R1 code, all versions).** Every photo action computed a whole new list from the render-time `photos` and patched it into state. A late callback (image `onError`, a picker return, an action-sheet choice) could therefore write an older list back — re-adding a removed photo or dropping a new one. A double tap could also open two pickers, because the `busy` flag was React state. Both are reproduced in `p07r2_photos_prompts.check.js` (old style vs. functional update).
3. The profile preview showing a "photo grid" or a Hinge list was real Image content: gallery screenshots the user picked, not a mis-rendered component.

## 3. Changes

**Photos (`PhotosFields.tsx`, `lib/onboardingV2/photoGrid.ts`, `yourProfile.ts`)**
- **Grid:** six fixed slots, **3 × 2**. Sizes are explicit points from the window width (390 pt → 107 × 134). Narrow screens (< 300 pt content) or text scale ≥ 1.35 get 2 columns. Main-photo tag on slot 1; counter "N of 6 photos · add at least 3"; hint "Tap a photo to preview it. Hold and drag to reorder."
- **Adding:** tap an empty slot to open the picker.
  - Multi-select and `selectionLimit` = free capacity, `orderedSelection`, never combined with cropping.
  - A `useRef` guard allows one picker at a time; cancelling changes nothing.
  - Duplicates are skipped only by a non-null `assetId`; `null` ids are never treated as equal. Overflow and duplicates are reported in a short notice.
- **Tap a photo:** large preview sheet with Try again (only if it failed to load), Make main photo, Move earlier / Move later, Replace photo (replaces only that slot and keeps its position), Remove photo.
- **Hold (280 ms) and drag** to reorder. The drop target is highlighted and the screen's scroll view is locked while dragging. `dragTargetIndex` and `movePhotoTo` are pure, tested functions (the former also runs as the worklet).
- **VoiceOver:** the same actions are available as accessibility actions.
- **Failed images:** a photo that fails to load shows "Couldn't load" and does not count toward the minimum.
- **Updates:** every edit is a functional update of the current list (`updatePhotos(fn)`).
- **Preview sheet title:** it no longer reads "Photo 0 of N" while sliding out after Remove. This was found in the runtime test and fixed.

**Prompts (`PromptsFields.tsx`, `lib/onboardingV2/promptCatalog.ts`)**
- **Cards:** "A little more you" / "Pick 2 prompts. Add a third if you like." Three cards start as **Choose a prompt** (Required, Required, Optional). Filled cards show the prompt, a 3-line answer preview and Edit; the optional third can be removed.
- **Picker:** wide and scrollable, with categories All / About me / Just for fun / You & me / My everyday. A prompt already used elsewhere is shown disabled ("Already added").
- **Editor:** a separate screen with Cancel / Save at the top (never under the keyboard). It shows the title, **Change**, "Türkçesi" (Turkish meaning) and "Türkçe veya İngilizce yazabilirsin. Short answers are welcome.", then the multiline field (explicit lineHeight — the input-clipping fix is kept) and a 200-character counter.
- **Example hints:** EN / TR selector, placeholder example, **Show another example**, and an "Example: …" line once typing starts. Examples are never stored, never count and never reach the profile.
- **Never losing an answer:** Save stores the text exactly as typed. Changing the prompt of a written answer asks *Keep and edit it / Start fresh*; cancelling with unsaved edits asks before discarding.
- **Catalog:** 20 prompts, 5 per category, stable local ids, each with a Turkish meaning and 2 EN + 2 TR examples (one warm, one light). The owner's tone examples are included (e.g. *Menüye on dakika bakıp hep aynı şeyi söylemek.*, *İstanbul'un en iyi tiramisusunu bulabiliriz.*). These are not a backend enum (Q6).

**Kept unchanged (approved `7d64403`):** name/age on the main photo, the icon rows and the party-popper received screen (`ProfilePreview.tsx` and `ApplicationFields.tsx` have no diff). Interests 1–10, the email-confirmed → Submit → You're on the list flow, no checklist page.

**Docs:** **D60**; `ONBOARDING_FLOW.md` §7 items 1–2; `SCHEMA_MAPPING.md` prompt row; `OPEN_QUESTIONS.md` Q6.

## 4. Verification

### Static / logic (repeatable: `node scripts/onboarding-v2-checks/run.js`)
- `npx tsc --noEmit` ✅.
- Logic checks: **P06 45/45, P07 69/69, R2 56/56**.
- **R2 photo checks:**
  - 0 → 6 one at a time; 7th refused; 3 + 3 keeps order; over-capacity batch.
  - Replace only #2; replacement already used refused.
  - 6th → 1st by drag keeps everyone; delete the middle photo and re-add; make main; move; cancel.
  - assetId de-dupe with null ids; 2 photos invalid, 3 valid, broken not counted.
  - Stale-update bug reproduced vs fixed.
  - Grid at 320 / 375 / 390 pt and large text; slots never overlap; drag target maths.
  - Preview order equals editor order.
- **R2 prompt checks:**
  - Catalog: 20 prompts, 5 per category, TR + 2 EN + 2 TR examples, title length.
  - Three empty slots; examples never counted or stored.
  - Turkish, emoji and new lines stored exactly; duplicate prompt refused; whitespace and >200 refused, 200 accepted; unknown id refused.
  - Optional third add/remove; preview shows the real answers in slot order; examples never shown; screen copy.
- `npx expo export --platform ios` ✅.
  - The DEV entry strings are absent.
  - The helper code for the build label is compiled in, but it is only rendered under `__DEV__` and gets no data in production.

### Real RN runtime — **web (react-native-web in Chrome), not iOS**
No iOS simulator is available on this machine, so the real components ran in Chrome through Expo web. The viewport was emulated at 390 × 844. Files were fed to the web picker programmatically, using generated numbered images; no personal files were used.

The web setup was local and temporary, and **not committed**:
- `react-native-web` installed with `--no-save`, then `npm ci`.
- Web-only stubs for `react-native-maps` / `expo-notifications`.
- SPA web output, and a DEV harness route rendering the real `PhotosFields` / `PromptsFields` / `ProfilePreview`.

All of it was removed afterwards.

**Verified at runtime:**
- 3 × 2 grid renders 0 → 6 photos one at a time: numbered tiles in order, Main photo tag, counter, Continue enabled at ≥ 3.
- A double tap opens **one** picker; the last free slot opens a single-select picker; at 6 there is no empty slot, so no 7th.
- Tap photo → preview "Photo 2 of 6". **Replace** opens a single-select picker; only slot 2 changes, ids and count unchanged.
- **Make main** on photo 6 → order `612345`. **Move later / earlier** → `162345` → `612345`.
- **Remove** the middle photo removes only that photo. **Cancel** changes nothing and the picker can reopen. Re-adding appends.
- Down to 2 photos → Continue disabled, "2 of 6 photos · add at least 3". A batch of 3 keeps the existing 2 and appends 3.
- Prompts:
  - 3 "Choose a prompt" cards, helper and counter present; categories show 5 prompts each.
  - A used prompt is disabled.
  - The editor shows EN → TR placeholder examples, Show another example, Türkçesi and the helper; Save is disabled while empty.
  - Real keyboard input of `Şarkıyı ilk iki saniyede tanırım 🎵⏎İğne-ipliğe çözüm üretirim.` is kept exactly; switching the example language doesn't touch it; the counter reads 63/200; it is saved exactly.
- Preview: 5 photos in **the same order as the editor**; main photo with "Deniz, 31" overlay and fade; answers in slot order; no grid placeholders and no example text.
- Preview sheet title stays "Photo 2 of 3" while closing after Remove (fix verified).

**Not verified (be explicit):**
- **Drag-and-drop on any real runtime.** Chrome refuses synthetic long-press drags (`setPointerCapture` needs a real pointer), and the browser tool can't hold before dragging. The drag logic is only unit-tested.
- **Confirmation alerts** (*Keep your answer?*, *Discard changes?*). `Alert` is a no-op on react-native-web; unit-tested only.
- **iOS specifics:**
  - the native photo picker (`orderedSelection` badges, `selectionLimit`, limited-library `assetId` = null);
  - the drag/scroll interplay;
  - keyboard behaviour in the editor modal;
  - the Modal slide animation;
  - large Dynamic Type layout;
  - the photo sheet → Replace picker opening over a modal.
- Layout on web uses CSS flexbox, not Yoga — a close but not identical engine.
- During the test pause someone else interacted with the test tab: two prompt slots got "test" answers. The test continued on the third slot; nothing was pushed from that tab.

## 5. Phone instructions
Metro on :8081 currently serves `~/tempa-p07-r1` (R1 + the approved `7d64403`). To see R2:
1. In that Metro terminal press **Ctrl + C** (or `kill` the process listening on port 8081; leave HARFI on :8082 alone).
2. Start R2:
   ```bash
   cd ~/tempa-p07-r2
   git pull                      # tempa/p07-r2-photos-prompts
   git log -1 --oneline          # this report's commit or later
   npx expo start --dev-client -c
   ```
3. Scan the new QR code with the dating-app development build. No new build is needed.
4. On the signed-out landing, check the label **`dating-app · <short commit> · tempa-p07-r2`**. It must name `tempa-p07-r2` and must not say `+local changes`. Then open **DEV · Preview new onboarding** → … → Your Dates 2 → Continue to your profile.

**Please test on the phone:**
1. 0 → 6 photos one at a time, then 3 + 3 by multi-select.
2. Photo 2 → Replace.
3. **Hold and drag** photo 6 to slot 1, while scrolling doesn't fight the drag.
4. Remove the middle photo and re-add; cancel the picker.
5. Back → forward and preview, checking that order and count match.
6. Continue is disabled with 2 photos.
7. Prompts: categories, EN/TR examples, Turkish answer with emoji, Change prompt with text (keep/fresh question), Cancel with edits (discard question), the keyboard never covering Save or the text.
8. Preview shows the real answers.

## 6. Security package status
**Unchanged, not applied.** P0-A / P0-B and the rollbacks are in `supabase/proposed/`, the drafts are archived on `tempa/v2-drafts-archive`, and the exposures described in `P0_PRIVACY_REMEDIATION.md` are still live. The additional review requested earlier (profile_cards definer analysis, access table, real-body wrapper tests, PostgREST/Storage HTTP checks, signed-URL analysis, district removal, fix-forward rollback) is **still to do** and was not part of this R2 completion scope.

## 7. Owner phone acceptance — 2026-09-29

The owner tested R2 on the phone and reported that **photos, reordering, prompts and preview work correctly**. This is recorded as owner visual/functional acceptance of:

- **Branch `tempa/p07-r2-photos-prompts`, commit `be78b0b`** (implementation `6a5c267` + this report). This is the version handed over for the test, with the expected DEV label `dating-app · be78b0b · tempa-p07-r2`.

Note: when this was recorded, the only Metro on :8081 was serving `~/tempa-p07-r1` (started 11:51), and no R2 server was running. So I could not independently confirm which server the phone used. The DEV build label on the landing screen is the check for that.

This acceptance covers what the owner exercised. It is not a full accessibility or device-matrix verification.
