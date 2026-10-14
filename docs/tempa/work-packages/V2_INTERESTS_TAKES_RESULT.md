# V2 Interests & conversation starter — first package — result

# Round 3 (2026-10-15): owner's phone results + chat keyboard layout fix

## Verified on the phone by the owner — 14 October 2026 (LOCAL, synthetic accounts; recorded as reported)
- Three personal answers are **kept after fully closing and reopening the app**.
- On the **own profile**, the three answers appear **in the correct order**.
- From the **other account, via Activity**, Mert's profile shows **the same three answers**, including the **updated "Test2" answer**.
- **Chat header → profile → back to the same chat** works.

**Not confirmed by this test (no claim made):**
- **Message delivery:** the "Hi" in the last screenshot looks like a message **Defne sent**. That an older Mert message was received or read on Defne's side is **not** established from it.
- The known **Activity smoke Realtime timeout** is still open and not solved.

## Chat keyboard layout (`app/chat.tsx`)
- **Problem (owner screenshot IMG_6473):** with the keyboard open, the "Quick this-or-that" panel covered the empty chat's "Say hello to Mert".
  - The screenshot file was not available on this machine. The analysis is from the code.
- **Cause found in code:**
  - The quiz panel was a fixed-height sibling **between** the message list and the input row, inside the `KeyboardAvoidingView`.
  - When the keyboard shrinks the space, the fixed panel and input keep their size. The list (`flex: 1`) gets squeezed below its content: the "How it started" card plus the hello block with `paddingTop: 60`.
  - The empty-chat content can then end up under the panel.
- **Fix (layout only; quiz behaviour unchanged):**
  - The panel is now the list's **footer**, so the "How it started" card, the hello and the quiz scroll together. Only the input row stays pinned above the keyboard (its bottom padding is unchanged: `12` with the keyboard up, otherwise safe area + 12).
  - On keyboard show and on content size change the list scrolls to its end, so the last message or the quiz stays visible, including after a send.
  - `keyboardShouldPersistTaps="handled"` and interactive dismiss are on.
  - Where no list is shown (load error), the panel renders as before.
  - The header → profile → back path is untouched.
- **Checks:**
  - `v2_activity_real` 38/38 (+2 layout source checks);
  - `onboarding-v2-checks/run.js` all pass; `p0-checks` all pass; `tsc` clean;
  - the iOS dev bundle builds with the LOCAL config.
- **Not verified on a device:** the actual rendering with the keyboard open (no phone here).

**Phone checklist (chat):**
1. Open a new match's empty chat. "How it started", "Say hello to …" and the quiz should be readable without overlap.
2. Tap the input. The keyboard opens, the input sits right above it with no extra gap, and the content above scrolls; nothing covers the hello.
3. Answer the quiz (both options) with the keyboard closed and open: same behaviour as before.
4. Send a message. It appears at the bottom and stays visible; with the keyboard closed there is no gap under the input.
5. Header → profile → back: the same chat, with the draft and position intact.

---


# Round 2 (2026-10-15): up to three conversation starters, simpler "Your interests"

From `0ddcef8`. Decisions **D94–D97**; D93 (the onboarding rule) is unchanged and still not built.

**Not done:**
- Nothing on the shared remote project; no merge or deploy.
- No reset or bulk delete; the real-e-mail local auth user was not touched.
- Onboarding / submission rules, D81, ranking, AI, chat suggestions and likes on starters are out of scope.

## Owner's phone test of round 1 (verified by the owner on LOCAL, 2026-10-15)
- The personal answer was **kept after fully closing and reopening the app**.
- Removing the linked **book** → **Cancel**: the book and the answer were both kept.
- Removing it → **confirm**: the book and its answer were removed together.

**Not yet tried on the phone:** the other account seeing the profile card (round 1, §4 step 6).

## Server — `supabase/proposed/20261015090000_v2_takes_multi.sql`
Applied to tempa-local in one transaction (local migration `…022`; in `setup.mjs`; not in `apply-dev.mjs`).

**Before / after fingerprints identical** for:
- profile prompts (ids included), likes, matches, messages, account states and onboarding answers;
- **all existing starters (2 rows: id, content, created / updated time)**, which now have position 1.

| Change | |
|---|---|
| One-per-user unique constraint dropped | → `position` 1–3 (check) + unique `(user, position)` + unique `(user, kind, subject)` |
| `save_take_v2(p_take_id, kind, subject, question, answer)` | `p_take_id` null = add (refused with `subject_taken` or `limit_reached`; never overwrites). An own id = edit (same subject → same id) or change (new id in the **same position**, only the sent text). Another member's id → `not_found`. Runs under the per-user row lock, so the limits hold for parallel requests. |
| `delete_take_v2(p_take_id)` | Deletes that one starter only (own only). |
| `save_interests_v2` | Unconfirmed: lists the starters whose subject would go and writes nothing. Confirmed: removes **only those** starters together with the selection change. |
| `get_my_interests_v2` / `get_profile_v2` | Return `takes` (0–3, by position) instead of `take`. The visibility rule is unchanged. |
| Question keys and answers | Unchanged. |

## App
- **`app/v2/edit-interests.tsx` — "Your interests":**
  - "Conversation starters" with an "n of 3" counter;
  - compact cards (Edit / Change / Remove); "Add a conversation starter" only below three;
  - the subject list opens only while adding or changing, and offers only subjects without a starter;
  - one editor at a time; switching never drops typed text silently.
  - Below it: Interests, Activities, Artists, Books, Movies & series — one heading each, no repeated labels, no catalog notes.
  - Saves are server-first: a failure keeps the draft, and after a save the starters are re-read from the server.
- **`components/onboarding-v2/yourWorld/Typeahead.tsx`:** a search failure now shows **Try again** next to the short error (also in onboarding). It also takes an opt-in `hideLabel`.
- **`components/interests/TakeCard.tsx` → `TakesSection`:** one compact section of 0–3 rows. Answers are in regular body text (16 pt DM Sans), not a large serif. Nothing is shown when the list is empty. Used by the own profile and the full V2 profile (Discover / Matches / Activity / chat → profile).
- **Profile entry:** the button now reads **"Your interests"**.

## Question keys and texts (for review — only Running's wording changed)
| Kind | Key | Text shown |
|---|---|---|
| Activity | `activity_favourite_part` | What’s your favourite part? |
| Activity | `activity_perfect_day` | What does a perfect one look like? — **for Running: "What does your ideal run look like?"** (same key, same meaning) |
| Book | `book_why` | Why this book? |
| Book | `book_stayed` | What stayed with you? |
| Film & series | `screen_why` | Why this one? |
| Film & series | `screen_scene` | A scene you’d watch again? |
| Music | `artist_first_song` | Which song should someone start with? |
| Music | `artist_when` | When do you listen to them most? |

## Tests
**`smoke_takes_local.mjs` (real local services): 25 / 25, 2 runs.** Fresh synthetic accounts each run.
- three starters → three ids, positions 1–3;
- refused: a 4th, a second starter on the same subject (both adding and changing), an unselected subject, 181 characters;
- a new session reads all three in order; the viewer sees them in the same order, with no internal id;
- editing keeps the id and position, and the others are byte-identical;
- changing the subject gives a new id in the same position, with no carry-over and the others unchanged;
- deleting one leaves the others and the artist untouched, and a new one fills the free position;
- removing the book: unconfirmed keeps everything; confirmed removes the book and **only** its starter;
- **4 parallel adds with one free slot → exactly one**, with no duplicate subject or position; parallel adds for the same subject → at most one;
- the third account can't delete, edit, insert or read M's starters or change M's selections (it had selected the same subject, so the ownership check was really reached);
- the owner can't bypass the operations; signed out → 401; the draft applicant is refused;
- the blocked viewer sees nothing; no starters → an empty list;
- unchanged: prompts, application state and the general lock; **earlier members' starters untouched**.

**Regression:**
- `v2_interests_takes` **43/43**; `run.js` all suites pass (Activity real 36, Activity preview 51, Discover 85/30, Matches 45/23, public profile 6).
- `p0-checks` all pass; `tsc` clean; the iOS bundle builds with the LOCAL config.
- `smoke_matches_local` 18/18.
- `smoke_activity_local` **39/40**: the known Realtime check ("A receives it over Realtime") timed out again. Investigation, **not solved**:
  - the replication slots were active with no lag, and `public.messages` is in the publication;
  - a live subscription registers in `realtime.subscription` (role `authenticated`, the receiver filter);
  - a targeted A/B (5 inserts immediately after `SUBSCRIBED`, 5 after a 1.5 s wait) delivered **10/10**, so the "insert too early" hypothesis has **no support**;
  - an earlier 0/13 result came from a bug in my own probe script (it awaited the message before sending it) and was discarded.

  The cause is still unknown. Intermittent: 2 of ~10 runs since the test fix. The probes added 26 test messages inside one synthetic run pair (not deleted).

## Phone test (two accounts) — not done yet
1. `scripts/local-backend/start-app.sh tempa-activity-p1-receiver@tempa-test.example.com` → DEV · Test account sign-in.
2. Profile → **Your interests**. Under Activities select **Running** and **Cooking**; add a book → **Save interests**.
3. Add three starters (Running, Cooking, the book). The counter reads **3 of 3** and Add disappears. Edit one; change another's subject (its text starts empty; Cancel keeps the old one); remove one.
4. Deselect the book → Save → **Cancel** (all kept), then **Remove** (only the book's starter goes). Close and reopen: everything is as saved.
5. Profile → **View profile**: one compact "Conversation starters" section.
6. `start-app.sh tempa-activity-p1-defne@tempa-test.example.com`, sign in → chat with Mert → header → **View profile**: the same section, in the same order, with no "You both".

**Not tried on the phone:** everything in this round, plus the round 1 other-account step.

---

# Round 1 (2026-10-14)

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
