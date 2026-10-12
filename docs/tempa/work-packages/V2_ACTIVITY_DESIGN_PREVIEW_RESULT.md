# V2 Activity — design preview (DEV only) — result

# Round 2 (2026-10-12): Activity → Profile → Match & chat

Branch: `tempa/v2-persist-r2`. Reference: the owner's three-screen mockup *Activity → Profile → Match & chat*. Decisions recorded as **D75–D80** (Activity) and **D81** (Discover, not built) in `docs/tempa/DECISIONS.md`.

**Status:** built and checked locally (TypeScript plus logic checks).
- **Not tried on a phone.**
- No real-service test, no migration, no seed or reset, no merge, no deploy.
- The real Activity tab (`app/(tabs)/notifications.tsx`), Matches and Discover behaviour are unchanged.

## Open it on the phone
1. Start the app as usual in the dev-client (LOCAL or DEV backend; the preview uses no backend).
2. Sign in, open the **Profile** tab, and tap **"Activity design preview (DEV)"**. You can also open `datingapp://dev/activity-preview` in Safari.
3. Leave with **DEV ✕** next to the title, or **Exit preview** in the controls at the bottom of the feed.

Suggested run-through:
1. Tap **Defne's card** to open her full profile with the "Liked your photo · “Where was this taken?”" context. Go back: she is still pending, and nothing was matched.
2. Open Defne again and tap **Match & chat**. The empty chat opens with "How it started" and "Say hello to Defne", and nothing is sent.
3. Go back: Defne is now a **"You and Defne matched"** row, and her card is gone.
4. Tap the row: the same chat opens.
5. Open **Zeynep** ("Liked you", no comment) and **Ece** ("Liked your answer").
6. Turn on **"Next Match & chat fails"** in the controls, then try Match & chat: an error appears and nothing is matched. Tap again to retry.
7. **Empty / Loading / Error / Reset** are in the controls.

## What is simulated vs real
| Part | In this preview |
|---|---|
| People, photos, likes, comments, matches, messages | **Simulated:** local fixtures; "DEV · SYNTHETIC" illustrations of fictional people. |
| Match & chat | **Simulated:** in-memory reducer with a 0.6 s fake request and an optional forced failure. No `send_like_v2`, no match row. |
| Read state ("new" dot) | **Simulated:** memory only. The server has no read state for likes yet. |
| Chat messages | **Simulated:** Send adds a local bubble only. Nothing is written to `messages`. |
| Full profile layout | **Real shared component:** `DiscoverProfileItems` + `buildDiscoverLayout`, the same code as the real Discover, shown read-only. |
| "How it started" context | **Real shared component:** `LikeContextHeader` from the real chat, with local photos injected. |
| Supabase, accounts, notifications | **Not used.** The preview imports nothing that reaches the backend; a check enforces this. |

## Design as built
- **Feed (D75–D77):**
  - one vertical list, newest first, with no tabs;
  - pending interest appears as a large single-column card: the liker's photo, with name, age and area on the photo (bottom fade);
  - below the photo, on sage: "Liked you / Liked your photo / Liked your answer · time", a new-dot when unread, and "Your answer: …" for answer likes;
  - the comment is a quote clamped to 2 lines, and my liked photo appears as a thumbnail;
  - with no comment, there is no comment line at all;
  - the whole card is the tap target (role button, hint "Opens the full profile");
  - matches appear as smaller rows "You and Selin matched · 3h ago" (or "Conversation started · 2d") with a chevron, opening the chat;
  - card photo height is clamp(170–300) so that about two cards fit; on small screens the photo shrinks and the text stays the same.
- **Merging:** `mergeIncoming()` turns a person's like and comment events into one card. The newest time wins, the card is unread if any part is unread, and a blank comment counts as none. In the fixtures, Defne's like and comment arrive as two events and show as one card.
- **Profile (D78):**
  - header "Defne, 28"; the full V2 profile with all photos, prompts and sections;
  - the context card ("Liked your photo", thumbnail and full comment) sits right after the main photo;
  - no hearts or "Add a comment" (new opt-in `readOnly` flag on the shared component, which Discover doesn't set);
  - a sticky footer with **one** button **Match & chat** and the caption "Match with Defne and open your chat."; a spinner while busy (disabled, so no double request); an inline error above the button on failure;
  - once matched, the button reads **Open chat**.
- **Chat (D79):**
  - header with the same avatar photo and name;
  - "You matched today";
  - a **How it started** card ("Defne liked your photo", my photo, the quote), shown as context and never as a message;
  - empty state "Say hello to Defne / Send a message whenever you like.";
  - input "Message Defne…" and a round send button;
  - after a first local message, the row reads "Conversation started".
- **Removed from round 1** (superseded): the separate sections and count, the "View profile" button, "Like back", "Mark all as read", the separate Open chat button on rows, and "No comment".

## Behaviour checked (logic, `v2_activity_preview.check.js`, 39/39)
- The fixtures include:
  - a profile like with no comment;
  - a photo like with a comment (merged from two events);
  - a prompt like;
  - an existing match;
  - a started conversation;
  - an empty Activity state.
- Opening a profile and going back marks the card read and creates no match; the feed is unchanged.
- Match & chat behaviour:
  - creates exactly one match, the card turns into the match row, no message is sent, and the comment stays as context;
  - double taps or a repeat after matching create no second match, and only one request is in flight at a time;
  - leaving the chat without a message keeps the match, and reopening uses the same chat; the first message gives "Conversation started";
  - a failure creates no match, leaves the card in place and shows an error; retry then matches.
- Source checks:
  - the old buttons and texts don't appear: "It's a match", "No comment", View profile and the old tabs;
  - there is exactly one accept button;
  - the profile is read-only;
  - the chat context uses the shared component.
- Isolation:
  - no Supabase, RPC or fetch import;
  - the route is `__DEV__`-only;
  - the real Activity tab doesn't import preview code;
  - the real Discover doesn't set `readOnly`;
  - the real chat's `LikeContextHeader` call is unchanged.
- Other checks:
  - `npx tsc --noEmit`: clean;
  - `node scripts/onboarding-v2-checks/run.js`: all suites pass, including Discover and Matches preview and real checks;
  - `scripts/p0-checks/*`: all pass.
- **Not done:** a phone test, small-screen and large-text viewing on a device, or a VoiceOver pass.

## Shared code touched (opt-in only)
- `components/discover/DiscoverProfileItems.tsx`: optional `readOnly` hides hearts and comment controls. It defaults to off; the real Discover doesn't pass it, so it is unchanged.
- `components/chat/LikeContext.tsx`: optional `title` and `photoSource`. The real chat passes neither, so it is unchanged and still resolves photos from storage.

## Files
- `lib/dev/activityPreview.ts` — fixtures, merge, feed and reducer (rewritten).
- `components/dev/activity/ActivityDesignPreview.tsx` — screen (rewritten).
- `components/dev/activity/previewPhotos.ts` — local photos.
- `app/dev/activity-preview.tsx` — DEV route.
- `components/main/V2ProfileHome.tsx` — DEV entry.
- `assets/dev/activity-preview/selin-*.png` — renamed from `asya-*`.
- `scripts/onboarding-v2-checks/v2_activity_preview.check.js` — checks.
- `components/discover/DiscoverProfileItems.tsx`, `components/chat/LikeContext.tsx` — opt-in props.
- `docs/tempa/DECISIONS.md` — D75–D81.
- `docs/tempa/work-packages/V2_DISCOVER_DESIGN_PREVIEW_RESULT.md` — the "No swipe" note is marked superseded.

## Open integration items (before wiring the real Activity)
1. **Server path for Match & chat:** `send_like_v2` back to the liker, with:
   - which target: profile-level, which D81 also implies, versus the content they liked;
   - whether it uses a daily like (proposal: not, since it is accepting incoming interest);
   - idempotency via `p_request_id`, already supported.

   The mutual-like trigger already creates the match immediately (D70).
2. **Read state for likes:** none on the server. Options:
   - `likes.seen_at` (written on profile open);
   - a notifications row per like.
3. **"Pending" definition:** a like toward me with no match, not passed and not expired. Does my pass remove it, and do likes expire?
4. **Premium visibility:** today the real "Likes you" uses `get_my_liker_cards` (identity premium-gated). D75–D76 show full cards. Decide what non-premium members see.
5. **Match rows source:** `get_my_matches_v2` plus match time. How long a match row stays in the feed is not decided (the preview keeps it).
6. **Real chat follow-up (D79):** the "How it started" heading and the "Say hello to {name}" empty text are not in `app/chat.tsx` yet; it still shows "You matched — say hi 👋".
7. **Photo access:** the private-photo read policy still uses V1 `can_view_profile_as_me`. A liker's photos must be viewable under V2 rules.
8. **Discover D81** (whole-profile heart, swipe right/left, "It's a match!") is a separate later package.

---

# Round 1 (2026-10-11) — SUPERSEDED by round 2 / D75–D80

Date: 2026-10-11 · Branch: `tempa/v2-persist-r2`

**Status:** built and checked locally (TypeScript + logic checks). **Not tried on a phone.** No real-service test, no merge, no deploy.
The mockup was **not received** in the message. The design follows the written brief and the approved Discover/Matches theme (cream background, dark green accent, sage context areas, Playfair Display + DM Sans).

## What it is
A separate, DEV-only screen that shows the proposed Activity tab using local, synthetic data. It does not import Supabase. It never accepts a like, creates a match, marks anything as read or sends a message on any account. The real Activity tab (`app/(tabs)/notifications.tsx`) has **not** been changed. Matches and Discover were not touched apart from adding one DEV entry next to their existing ones.

## Open it on the phone
1. Start the app as usual (dev-client; LOCAL or DEV backend, either works because the preview uses no backend).
2. Sign in, open the **Profile** tab, and tap **"Activity design preview (DEV)"** below the other DEV entries.
   Alternatively, open `datingapp://dev/activity-preview` in Safari.
3. Leave with **DEV ✕** next to the title, or **Exit preview** in the controls at the bottom.
4. In a production build the entry is hidden and the route redirects to `/`.

## Design (preview scope only, not approved product rules)
- **Header:** "Activity" is left-aligned (Playfair) and has no profile icon. "Mark all as read" appears on the right only when something is unread.
- **Likes you** shows a count badge equal to the number of **pending** likes (people waiting for an answer), not the unread count. Each card shows:
  - the photo, name and age, "Liked your photo/answer · time", and an unread dot;
  - a sage context area with **my** liked photo (thumbnail) or my prompt (question + answer);
  - their comment next to that content, or "No comment";
  - the comment clamped to 3 lines on the card and shown in full inside the profile;
  - a "View profile" button.
- **View profile** opens the shared Discover profile layout (`DiscoverProfileItems` + `buildDiscoverLayout`) for that person:
  - the "liked your …" context and the full comment sit on top;
  - a sticky **Like back** button sits at the bottom;
  - opening only marks the like as read and does not accept it;
  - Like back simulates the match: the person moves from Likes you to New matches (unread), and the footer becomes "You and X matched · Open chat".
- **New matches** are small rows: round photo, name, "New match" or "Conversation started", time, unread dot, and an **Open chat** button. Once a conversation has started, there is no "Say hi".
- **Synthetic chat:**
  - like context is shown at the top as context, never as a message;
  - no message is sent automatically;
  - "Say hi to X" appears only as an empty-state hint;
  - Send adds a local bubble only; nothing leaves the phone.
- **States** (DEV controls): Normal / Empty ("Nothing new yet") / Loading / Error (with Try again) / Reset.
- **Fixtures:**
  - "Me" is Mert (Discover preview person).
  - Likes:
    - Defne liked photo 2 with a long comment (unread);
    - Zeynep liked photo 1 with no comment (unread);
    - Ece liked a prompt answer, with a comment (already read and still pending).
  - New matches:
    - Asya, a new unread match;
    - Melis, where the conversation has started.
  - Photos are "DEV · SYNTHETIC" illustrations of fictional people (`assets/dev/activity-preview/` plus the existing Discover preview images).
- **Out of scope** as requested: new-message notifications and date suggestions.

## Files
- `lib/dev/activityPreview.ts` — fixtures plus the pure reducer.
- `components/dev/activity/ActivityDesignPreview.tsx` — the screen.
- `components/dev/activity/previewPhotos.ts` — local photo map.
- `app/dev/activity-preview.tsx` — DEV route that redirects outside `__DEV__`.
- `components/main/V2ProfileHome.tsx` — one `__DEV__`-gated entry.
- `assets/dev/activity-preview/*.png` — synthetic placeholder photos.
- `scripts/onboarding-v2-checks/v2_activity_preview.check.js` — 28 checks.

## Checks run
- `npx tsc --noEmit`: clean.
- `node scripts/onboarding-v2-checks/run.js`: all suites pass (activity preview 28/28; Discover and Matches preview and real checks unchanged and passing).
- `scripts/p0-checks/*`: all pass.
- **Not done:** a phone test, small-screen and large-text checks on a device, or any real-service test.

## Known limits of the preview
- Inside "View profile", the shared Discover component still draws its photo and prompt hearts, greyed out. This is the same look as when Discover is out of likes. Hiding them needs a small read-only flag in the shared component; I left that component unchanged so Discover isn't affected. Decide whether hearts there should be hidden or act as "like back".
- Long comments and small screens are handled in code (text clamps, `minWidth: 0`, wrapping DEV buttons) but haven't been seen on a device.

## Open integration decisions (before wiring the real Activity)
1. **Read state for likes:** likes have no read state on the server today; only `notifications.is_read` exists. Options:
   - a `likes.seen_at` column;
   - a notifications row per like.
2. **Definition of "pending":** for example, `likes.status='sent'` toward me, not matched, not passed, not expired. Also decide whether a pass by me removes the like, and whether old likes expire.
3. **Premium visibility:** the real tab uses `get_my_liker_cards`, which is premium-gated. The preview shows full identity and comments.
   - Decide what a non-premium member sees: a count only, blurred cards, or full cards.
   - Decide whether the comment is visible without premium.
4. **Like back from Activity:** use `send_like_v2` with which target? Options:
   - a profile-level like;
   - the first photo;
   - the content they liked;
   - a heart on a specific item.

   Also decide whether it can carry a comment, and whether it uses a daily like.
5. **Source of New matches:** `get_my_matches_v2` (matched, no chat yet) versus `mutual_match` notifications. Also decide when a match leaves this list: when a conversation starts, after N days, or only after it has been read.
6. **Notification copy:** the existing `mutual_match` notification text is Turkish/V1-era and should be aligned with this English copy.
7. **What "Mark all as read" covers:** this tab only, or also the tab-bar badge (the unread count in `lib/unreadNotificationCount.ts`).
8. **Profile access:** the photo read policy uses V1 `can_view_profile_as_me` (an earlier finding). A liker's photos must be viewable through V2 rules before real cards are shown.
