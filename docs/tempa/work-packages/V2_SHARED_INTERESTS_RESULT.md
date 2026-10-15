# "Both into this" — shared selections on a full V2 profile — result

Date 2026-10-16 · Branch `tempa/v2-persist-r2` (from `1745aec`) · Author: Claude Code. Decision **D101**.

**Not done:**
- No migration, table or RPC; nothing on the shared remote project; no merge or deploy.
- No reset or data deletion; the owner's phone accounts were not touched.
- **Not tried on a phone.**
- Earlier open phone checks (D93 "one standard + one starter", the keyboard look from `38b3fa2`, the old Mert message on Defne's side) and the **intermittent Realtime timeout** remain open.

## Layout decision
No new section. The full V2 profile already shows every selection as an item:
- broad interests and activities as rows in the "Into" / "Activities" groups;
- books, movies & series and artists as rows in the favourites ("taste") section.

The mark is a **second, small line under that existing row**: "Both into this", 13 pt body text in the secondary colour. There is no badge, icon, animation, score or "perfect match" text. Both renderers of a real full profile do this:
- `DiscoverProfileItems` (Discover, Matches → profile, Activity → profile);
- `ProfilePreview` via `PublicProfileView` (chat header → profile).

## Rule — `lib/interests/shared.ts` (pure)
- **Keys:**
  - broad interests: `interest:<key>`; activities: `activity:<key>`;
  - books, films and artists: `<kind>:<source>:<id>`;
  - typed entries (`custom`) get **no key**, so they are never shared, even with the same title.
- **Matching:** a different id or a different source is not shared. No title or free-text matching, no answers, no semantics.
- **Selection:** fixed priority book → movie/series → artist → activity → broad interest. Within a kind, their profile order. **At most 2.**
- An item that is the subject of one of their conversation starters is skipped (the answer already shows it).

## Data — no server change
- `lib/interests/useSharedMarks.ts`: the viewer's **own** selections come from the existing `get_my_interests_v2` (own row only). The other person's come from the profile already loaded through `get_profile_v2`, so access, block, eligibility and membership rules are unchanged; a blocked or unavailable profile returns nothing.
- **Freshness and isolation:**
  - re-read on every open / focus;
  - a result is shown only for the **exact person + selections** it was computed for, so the previous card's or profile's result never shows on the next one;
  - cleared on any sign-in change;
  - never persisted.
- **Failures:** a failed read or a server without the package shows nothing, keeps the profile usable, and is retried on the next focus.
- **Not marked:** the own profile (`viewer === them`, and `/v2/profile` passes `markShared` only for others) and the onboarding preview (no prop).
- V1 screens untouched.

## Files
- **New:** `lib/interests/shared.ts`, `lib/interests/useSharedMarks.ts`.
- **Mark keys on rows:** `lib/onboardingV2/yourProfile.ts` (`markKey` on interest / activity rows).
- **Renderers:** `components/discover/DiscoverProfileItems.tsx` (`h.shared`), `components/onboarding-v2/yourProfile/ProfilePreview.tsx` (`shared`).
- **Wiring:** `components/main/V2DiscoverScreen.tsx`, `app/v2/match-profile.tsx`, `app/v2/activity-profile.tsx`, `components/onboarding-v2/PublicProfileView.tsx`, `app/v2/profile.tsx`.
- **Checks:** `scripts/onboarding-v2-checks/v2_shared_interests.check.js`, `scripts/local-backend/smoke_shared_local.mjs`.

## Checks
- **`v2_shared_interests` 16/16:**
  - priority and max 2; custom "1984" and a different "Dune" id never count;
  - a starter subject is skipped; profile order within a kind;
  - nothing shared → nothing; a different source → not shared; deterministic;
  - rows carry keys;
  - the hook drops own profile / errors, scopes results to the person + selections, clears on sign-in change, is never persisted and makes no new server call;
  - wiring in all four screens; none in onboarding; small text only; conversation starters untouched.
- **`smoke_shared_local.mjs` (real local services, fresh synthetic members): 13/13.**
  - Exact marks: Emma (same id) + Running. The typed "1984" and a different "Dune" id are not marked; the film is the starter's subject, so it isn't repeated.
  - A re-read gives the same result; the own profile has none.
  - After the viewer removes Emma + Running, the next read shows the broad interests; after removing everything shared, nothing; adding the same Dune id + Yoga marks them again.
  - Another account sees only its own intersection.
  - A blocked viewer gets no profile and no marks.
  - The target's starter and earlier members' starters are unchanged.
- **Regression:** `onboarding-v2-checks/run.js` all pass (Discover 85/30, Matches 45/23, Activity 51/38, interests 57, public profile 6); `p0-checks` all pass; `tsc` clean; the iOS bundle builds with the LOCAL config.
- The other service smokes were not re-run: no server change.

## Shortest phone check (two accounts) — not done
1. Account A (e.g. `tempa-activity-p1-receiver`): Profile → **Your interests** → select **Running** and add a book from search → Save.
2. Account B, matched with A (e.g. `tempa-activity-p1-defne`): add the **same book** (pick the same search result) and Running → Save.
3. B opens A's profile from the chat header (or from Activity): "Both into this" appears under the book and Running, at most two marks. B's own profile shows none.
4. B removes the book → reopens A's profile: the mark is gone or moved (e.g. to a broad interest).
