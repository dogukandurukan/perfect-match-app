# V2 Activity — design preview (DEV only) — result

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
