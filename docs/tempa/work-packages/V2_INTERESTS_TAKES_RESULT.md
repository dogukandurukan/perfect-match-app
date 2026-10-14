# V2 Interests & conversation starter — first package — result

Date 2026-10-14 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` (from `a8ecb23`) · Author: Claude Code. Decisions **D87–D93** in `docs/tempa/DECISIONS.md`.

**Not done:**
- Nothing on the shared remote project (DEV = live). No merge, no deploy.
- No reset or bulk delete. The real-e-mail local auth user was not touched.
- D81, commonality, ranking, AI and chat suggestions are not part of this package.
- The open Activity items are **not** closed.
- **Nothing here was tried on a phone yet.**

## 1. Server — `supabase/proposed/20261014090000_v2_interests_takes.sql`
Applied to **tempa-local** in one transaction (local migration `…021`; added to `setup.mjs`; not wired into `apply-dev.mjs`).

Before / after fingerprints are **identical** for profile prompts (with ids), likes, matches, messages, account states and onboarding answers.

| Piece | What |
|---|---|
| `onboarding_v2.activities` | Up to 5 of 12 fixed activity keys (check constraint). Existing rows get `{}`. |
| `profile_takes_v2` | One row per member: subject kind / id / title, question id, answer 1–180. Kind ↔ question pairs are enforced by a check. RLS: owners read their own row; **no client write grants at all**. |
| `get_my_interests_v2()` | Own selections + take + `editable`. |
| `save_interests_v2(…, p_remove_take)` | Validates interests 1–10, activities ≤ 5, taste lists ≤ 3 with no duplicates. Removing the take's subject returns `take_subject_removed` and **writes nothing**; with confirmation it changes the selections and the take in one transaction. Locks the selections row. |
| `save_take_v2(kind, id, question, answer)` | The subject must be one of the member's **saved** selections; its title is copied from that selection on the server. Same subject → same id; another subject → new row and id. Locks the selections row against a concurrent removal. |
| `delete_take_v2()` | Removes the answer only. |
| `get_profile_v2` | Also returns `activities` and `take`. The visibility rule is unchanged (`v2_can_view_public_profile`). |

All write operations require an **active approved member** (`is_active_v2_member`). Draft, suspended and signed-out callers are refused. `v2_assert_editable`, `save_onboarding_v2` and `save_prompts_v2` are unchanged and still refuse approved members.

## 2. App
| File | Change |
|---|---|
| `app/v2/edit-interests.tsx` (new) | Profile → **Interests & conversation starter**. The conversation-starter card offers Edit answer / Change interest / Remove answer. The editor has an "About" choice (saved selections only), 2 question chips and an answer with a `n / 180` counter. Below: broad interests (the onboarding component), activities (max 5), artists, books, movies & series (the onboarding search components, same source ids). **Save interests**: when the take's subject would be removed, an inline warning shows plus a confirm dialog (Remove both / Cancel). Every save is server-first; a failure keeps the draft and shows an error, and success shows "Profile updated". Leaving with unsaved changes asks first. |
| `lib/interests/takes.ts`, `lib/interests/interestsV2.ts` (new) | Catalog, questions, pure editor rules; RPC client (detects servers that don't have the package). |
| `components/interests/TakeCard.tsx` (new) | Read-only card + own empty state "Add a conversation starter". No like/comment, no "You both…". |
| `lib/onboardingV2/yourProfile.ts`, `serverMapping.ts`, `lib/discover/profileLayout.ts`, `DiscoverProfileItems.tsx`, `ProfilePreview.tsx` | The card under the main photo in both profile renderers (own / View profile, and the full V2 profile in Discover / Matches / Activity / chat → profile). Activities are shown as their own "Activities" group. |
| `components/onboarding-v2/PublicProfileView.tsx`, `app/v2/profile.tsx`, `components/main/V2ProfileHome.tsx` | Own profile (`own=1`) shows the empty card when there is no take and reloads from the server on focus. A new Profile entry; the general Edit profile stays disabled. |

## 3. Tests
**Real services on the local Supabase — `smoke_takes_local.mjs`: 27 / 27 (2 runs).** Each run uses fresh synthetic accounts: member M, eligible viewer V, blocked viewer Y, third account X, draft applicant D.
- **Selections:**
  - activities and source ids are saved;
  - invalid interests, activities and taste lists are refused, with nothing written.
- **Take validation and saving:**
  - refused: an unselected subject, a question from the wrong kind, 181 characters, a blank answer;
  - 180 characters with Turkish letters are accepted;
  - the title is set by the server;
  - editing keeps the same id;
  - a new session reads the current take;
  - V sees the take and activities, without the internal id.
- **Change subject:** new id, only the sent answer, still exactly one take.
- **Subject removal:**
  - unconfirmed → both kept;
  - confirmed → both removed together;
  - an unrelated removal needs no confirmation;
  - deleting the answer alone keeps the activity;
  - with no take, viewers get none.
- **Parallel saves plus a confirmed removal:** at most one take, always tied to a saved selection.
- **Authorization:**
  - X can't insert, update, delete or read M's take, or change M's selections;
  - even the owner can't bypass the server operations;
  - signed out → 401;
  - the draft applicant is refused.
- **Visibility:** the blocked viewer gets no profile and no take.
- **Unchanged:**
  - M's standard prompts (same ids, slots and answers);
  - application state and the other answers;
  - `save_onboarding_v2` / `save_prompts_v2` still say `application_locked`.

**Regression:**
- Activity smoke: 40/40 in 3 consecutive runs, after **one 39/40 run** where the Realtime-delivery check timed out. This is the same intermittent test-timing failure seen once in the Matches smoke; it didn't reproduce, and this package doesn't touch messages. Recorded as an open test flake.
- `smoke_matches_local` 18/18.
- `onboarding-v2-checks/run.js` all pass: new `v2_interests_takes` **38/38**, Activity real 36, Activity preview 51, Discover preview 85 / real 30, Matches preview 45 / real 23, public profile 6.
- `p0-checks` all pass (`v2_mapping` 21/21 after keeping `serverMapping.ts` free of runtime imports).
- `tsc` clean.
- The iOS dev bundle builds with the LOCAL config and contains the new screen and RPCs.

## 4. Phone test (owner) — not done yet
Use the existing synthetic Activity set (Mert ↔ Defne are matched):
1. `scripts/local-backend/start-app.sh tempa-activity-p1-receiver@tempa-test.example.com` → **DEV · Test account sign-in** with the code.
2. Profile → **Interests & conversation starter**. Select **Running** under Activities → **Save interests** → "Profile updated".
3. **Add a conversation starter** → About: Running → "What’s your favourite part?" → write a sentence → **Save**. Close the app fully, reopen → the same answer is there.
4. Profile → **View profile**: the card is under the main photo. Remove the answer there → "Add a conversation starter" appears; add it again.
5. Edit screen: deselect Running → **Save interests** → the warning appears → **Cancel** (both kept). Then **Remove both** (both gone).
6. Other side: `start-app.sh tempa-activity-p1-defne@tempa-test.example.com`, sign in, open the chat with Mert → header → **View profile**: his card is shown, with no "You both".

## 5. Open
- **Phone:** everything in §4. Also still open from Activity: the other-account test, error / retry, the private-photo policy and the unseen-likes badge.
- **Question wording** (D88) is mine; the owner should confirm it.
- **Likes on the take:** a later package. It should store a snapshot of the liked text, and also fix the `save_prompts_v2` delete-and-reinsert before prompts become editable.
- **The onboarding rule** "two standard answers OR one + a personal answer" (D93) is recorded, not built.
- **Activity smoke Realtime flake:** 1 of 8 runs since the test fix (2026-10-12).
