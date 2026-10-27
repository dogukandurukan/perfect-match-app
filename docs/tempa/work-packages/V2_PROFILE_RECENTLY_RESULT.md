# V2 — My Profile / Edit profile layout + "Recently" (2026-10-27, D106)

Author: Claude Code. **LOCAL (tempa-local) only**; not pushed, not merged, not deployed. Follows the owner's last profile mockup, which replaces the earlier story and big music / book card ideas. No story, ring, expiry, daily notification, autoplay or new sharing photo. Mockup sample names, photos and design notes ("future feature concept") were not carried into the product. UI is English.

## What changed

**My Profile** (`components/main/V2ProfileHome.tsx`):
- A compact row: main photo, "First name, age" and the city.
- **Recently**, with own add / edit access (pencil, or "Add a book or a song" when empty).
- **Edit profile** (primary) and **Preview** (outline).
- Preview opens the shared public profile view (`/v2/profile?own=1` → `PublicProfileView` → `get_profile_v2`). Your own preview has no like / comment actions.
- Removed from this screen: the old photo / prompt count card. Kept: the DEV preview entries and Sign out.

**Edit profile** (`app/v2/edit-profile.tsx`): one page with **Photos / Answers / Details** tabs. A tab scrolls to its part, and the active tab follows the scroll. **Preview** sits in the header.
- **Photos:**
  - the current photos in a 3-column grid, the first marked "Main";
  - a photo or **Change order** opens the existing order / main-photo editor;
  - **no add / remove buttons**, with a note that adding or removing photos isn't available yet;
  - Recently with its edit pencil and "Optional · Stays until you change it."
- **Answers:**
  - saved prompt answers as cards, locked: "This detail can't be changed yet";
  - Conversation starters → the existing Interests editor.
- **Details:** the D105 sections, unchanged in behaviour (Looking for, About you, Work & education, Lifestyle, First dates, Interests & values).

**Recently** — `components/profile/RecentlyRows.tsx`, one component used everywhere:
- Shown on My Profile, Edit profile, the own Preview and other members' profiles: `PublicProfileView` / `ProfilePreview`, Discover and Matches via `DiscoverProfileItems`.
- On profiles it sits right under the hero (main photo with the name; the location on Discover / Matches), before everything else.
- Up to two small lines: book `Title — Author`, song `Title — Artist`.
- An empty line is not shown; with both empty, others see no title at all.
- The song line is tappable (↗) only when its link passes the https / music-service check, and it opens outside the app (`Linking.openURL`). Otherwise it is plain text.

**Editor** (`app/v2/edit-recently.tsx`):
- Fields: book title, author (optional), song title, artist (optional), link (optional). Typed by hand; there is no external API or automatic lookup.
- "Remove book" / "Remove song" clear that part.
- Same behaviour as the other editors:
  - the draft stays local until Save; "Saved" appears only after the server confirms;
  - a failure keeps the draft;
  - a change made elsewhere → "Reload" (asks first when the draft has unsaved changes);
  - leaving with unsaved changes asks "Discard changes?".

## Server

`supabase/proposed/20261027120000_v2_profile_recently.sql`:
- **Table** `profile_recently_v2`: one row per member; RLS on, no policies, no direct access.
- **Limits** (after trimming), enforced by the save function and table checks:
  - book title 1–120, author ≤80, song title 1–120, artist ≤80, link ≤500;
  - single line only;
  - an author needs a book, and an artist or link needs a song.
- **Link rule:** https only; no `user:password@`; no spaces, control characters or `@` in the path. The host must be on a music allow-list or a subdomain of one: Spotify, Apple, YouTube / youtu.be, SoundCloud, Deezer, Tidal, Amazon Music, Bandcamp, fizy. The app re-checks the link before opening it.
- **`save_my_recently_v2`:**
  - active members only, own row only, via `v2_assert_member_profile_edit`; the general onboarding lock is unchanged;
  - row-version (`updated_at`) conflict check under a lock; a mismatch returns `profile_changed` and writes nothing;
  - all fields empty → the row is removed.
- **Readers:**
  - `get_my_recently_v2` — own row;
  - `get_profile_v2` — the current definition plus `'recently'` (null when empty), with visibility rules unchanged.

Applied to tempa-local:
- local migration `00000000000031`, in one transaction;
- listed in `setup.mjs` (setup not run), not in `apply-dev.mjs`;
- backup `~/tempa-backups/2026-10-27-before-profile-recently/` (76 TABLE DATA);
- data fingerprints identical before and after; the `get_profile_v2` diff is only the new key.

## Verified locally (not on a phone)

**`smoke_profile_recently_local.mjs` — 37/37**, real local services, fresh `tempa-local-rec-*` accounts:
- **Save and show:**
  - empty → nothing shown;
  - book only → others see only the book line;
  - adding a song with a link → others see the link;
  - a fresh session reads it back.
- **Refused, row unchanged (13 cases):** http, look-alike / non-music host, credentials, `@`, space, javascript:, link / artist without a song, author without a book, length limits, line break.
- **Conflicts:**
  - a stale version → `profile_changed`, nothing written;
  - two simultaneous saves → one wins;
  - a D105 Edit profile save doesn't touch Recently.
- **Removal:**
  - removing the book leaves only the song line;
  - removing the link makes the line plain;
  - removing everything deletes the row and hides it from others; it can be added again.
- **Visibility and permissions:**
  - a viewer who may not see the profile gets nothing;
  - draft, submitted and suspended accounts are refused;
  - a member changes only their own row;
  - the table can't be read or written directly; signed out → refused; helpers are not callable.
- **Unchanged:** application state, onboarding answers and the private preferences; none are on the profile.

**`v2_profile_recently` — 32/32:**
- pure logic: link check (8 good, 12 bad), form rules, display, server mapping, placement in both profile builders and hidden when empty;
- static wiring and SQL shape. These only show the code is wired; they are **not** UI behaviour tests.

**Regression:**
- `run.js` all **24** suites pass. The D105 / member-photo entry checks were updated to the new layout, and the server parser lives in `serverMapping.ts` with a type-only import, as that file requires.
- Smokes: `smoke_member_profile_edit_local` 42/42, `smoke_matches_local` 18/18, `smoke_activity_local` 45/45, `smoke_takes_local` 25/25, `smoke_shared_local` 13/13, `smoke_visit_notice_local` 8/8, `smoke_connection_answers_local` 40/40.
- `p0-checks` 28 · 12 · 14 · 21; `tsc` clean; LOCAL iOS `expo export` exit 0 (new strings in the bundle).
- Not run because they rewrite phone pointers in `.test-backend/`: `smoke_member_photos_local`, `smoke_profile_visits_local`, `smoke_chat_history_local`, `smoke_review_local` (temp file only, but unrelated).

## Not verified

- **No screenshots:** this machine has no iOS simulator and no react-native-web, so the real screens couldn't be rendered here. The layout was reviewed in code for a 393 pt width:
  - text wraps (2 lines) instead of truncating;
  - the two buttons share the row;
  - the grid is 3 × ≈108 pt;
  - the Preview pill sits in the header.
- **Waiting for the phone:** taps, tab scrolling, the link opening outside the app, the Discard / Reload prompts, and how it all looks.

## UI round after the phone look (2026-10-27)

Client only — no server, permission or account change. Colours and fonts are unchanged.

- **My Profile:**
  - The three DEV design-preview buttons moved to **Settings → "Developer (DEV only)"**. They are `__DEV__`-gated and absent from the production export.
  - Tighter spacing.
  - Recently = a small title + the book / song lines. When empty, a compact "Add a book or a song" link sits on the title row.
- **Edit profile:**
  - The repeated "This detail can't be changed yet" is gone. Each section with locked rows has one short note ("Details with a lock can't be changed yet."); locked rows keep a lock icon. Answers have one note.
  - Interests & activities and values show the real choices as labels, wrapping instead of truncating.
  - Lifestyle uses the profile's plain words, including activity — e.g. "Doesn't smoke · Drinks sometimes · Has a dog · Somewhat active". These come from the shared `lifestylePhrases`.
  - Tab jumps measure the part at tap time (`measureLayout` in the parts wrapper). The part's title lands just under the fixed header + tabs, which sit outside the scroll view. The active tab doesn't flicker during the jump.
- **Preview** (`/v2/profile?own=1`):
  - titled "Preview";
  - no owner prompts ("Add a conversation starter" removed there);
  - no like / comment;
  - other members' profiles are unchanged (shared marks, visit recording).
- **Recently editor:**
  - A successful Save closes the keyboard and shows "Saved". The next edit clears it.
  - A failure keeps the draft.
  - Fields scroll with the keyboard open (interactive dismiss), and the Save footer stays below the scroll area.

**Checks:**
- `run.js` 24 suites; `v2_member_profile_edit` 37/37; `v2_profile_recently` 38/38.
- The DEV-entry / lock-copy checks were updated to the new places.
- `p0-checks`; `tsc` clean; LOCAL iOS export exit 0.
- The new checks are pure logic (lifestyle words) and static wiring — **not** UI behaviour.

**Not verified in a real UI** (no simulator here):
- spacing;
- where the title lands after a tab jump;
- keyboard behaviour;
- text wrapping on the phone.
