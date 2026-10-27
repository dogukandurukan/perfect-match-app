# Tempa — design hand-off (2026-10-27)

For the designer joining on branding / UI / UX. This describes the **current code** on `tempa/v2-persist-r2`. That branch isn't merged or released, and a production build still runs V1 (see "Release").

- Decisions: [`DECISIONS.md`](DECISIONS.md).
- Technical state: [`HANDOFF_CLAUDE.md`](HANDOFF_CLAUDE.md).
- Setup: [`SETUP_NEW_DEVELOPER.md`](SETUP_NEW_DEVELOPER.md).

## Visual system today

- V2 screens use one token set: `lib/onboardingV2/theme.ts`.
  - `obColors`: warm ivory background `#F7F3EA`, very dark green CTA `#1F3A2E`, pale sage selection, beige notices.
  - `obFonts`: Playfair Display headings and DM Sans body (fonts in `assets/fonts`).
  - `obSpacing` / `obRadius`.
- The five main screens reuse it through `lib/homeTheme.ts`. Legacy V1 screens (settings, filters, chat parts) keep their own palette.
- No global theme change has been made in the latest rounds. A theme refresh is a separate piece of work.
- Mockup copy, sample people and design notes are never product content. Written specs govern copy.

## Screen inventory (V2)

| Area | Screen / file | What works | Locked / missing |
|---|---|---|---|
| Sign-in | `app/v2/welcome.tsx` | email code | — |
| Application | `app/v2/onboarding.tsx` → `components/onboarding-v2/PreviewFlow.tsx` | 7 sections, photos, prompts, selfie; optional **"What you're looking for"** (intention, priorities, connection style, summary; D104b) before Submit | private preferences can't be edited after submitting |
| Status | `app/v2/status.tsx`, "You're on the list!" step | Refresh, Sign out | — |
| **Discover** | `components/main/V2DiscoverScreen.tsx` + `components/discover/DiscoverProfileItems.tsx`, order in `lib/discover/profileLayout.ts` | full profile cards, likes on photos / prompts with an optional comment, daily quota, Recently under the hero | the scoring / ranking proposal isn't built |
| Matches | `V2DailyMatchesScreen.tsx` / `V2MatchesScreen.tsx`, `app/v2/match-profile.tsx` | daily pick, mutual match | — |
| Activity | `components/activity/V2ActivityScreen.tsx`, `app/v2/activity-profile.tsx`, `app/v2/profile-visits.tsx` | likes, profile visits (D103) | premium visitor identities = **proposal only** |
| Chats | `app/(tabs)/messages.tsx`, `app/chat.tsx` (shared with V1) | messages, photos, date suggestions | — |
| **Public profile** (others + own Preview) | `app/v2/profile.tsx` → `components/onboarding-v2/PublicProfileView.tsx` → `ProfilePreview` | the same blocks everywhere; own Preview has no owner prompts and no like / comment | — |
| My Profile | `components/main/V2ProfileHome.tsx` | compact photo / name, age / city, Recently, Edit profile + Preview, Sign out | — |
| **Edit profile** | `app/v2/edit-profile.tsx` (Photos / Answers / Details tabs) | see the table below | see the table below |
| Editors | `edit-profile-section.tsx` (D105), `edit-recently.tsx` (D106), `edit-photos.tsx`, `edit-interests.tsx`, `conversation-starters.tsx` + `conversation-starter.tsx` | — | — |
| DEV only | `app/dev/*-preview` (Settings → "Developer (DEV only)") | design previews with local sample data | never in release builds |

### Edit profile: what a member can change

| Can change now | Locked ("Details with a lock can't be changed yet") |
|---|---|
| Photo **order** and main photo | adding / removing / replacing photos |
| Looking for (public; long-term / casual / not sure; optional) | first name, age, gender*, interested in*, city |
| Height, work status (job title kept) | job title, school, hometown, favorite spot (free text) |
| Lifestyle (smoking, drinking, pets + kind, activity) | standard prompt answers |
| First-date types, days, time | values ("What matters most") |
| Interests, activities, artists, books, films / series | private preferences (D104b) for members |
| Conversation starters (own screens, max 3) | — |
| Recently: a book and a song with an optional https music link | — |

\* Private — never shown on the profile.

## First design scope

1. **Discover** — the profile card order (`buildDiscoverLayout`), hero, prompts, like / comment, Recently, empty / limit states.
2. **Public profile** — shared by others' profiles and the own Preview (`ProfilePreview` blocks). One component change shows everywhere.
3. **Edit profile** — tabs, photo grid (no add / remove yet), lock notes, rows, the section editors, Recently and conversation starters.

**Open questions for design:**
- whether "Looking for" appears on new accounts (an onboarding card was proposed, not built);
- how locked details should feel;
- branding: app name, icon and wordmark (`assets/images/icon.png`, `TempaWordmark`). The icon was last reported as a placeholder; not re-checked.

## Phone tests still owed

Local automated tests don't count as phone tests.

| Feature | Seen on the phone | Still to test |
|---|---|---|
| Profile visits (D103) | the old alert notice, visitor list | the new inline "Got it" notice, labels, badge, a real 24 h revisit |
| What you're looking for (D104b) | design, answers → summary, Must-have, kept after reopen | limits, clearing, required-intention path, save error / retry; a version-3 submit happened on Nehir's phone session (owner to confirm it counts) |
| Edit profile Package 1 (D105) | — | everything |
| My Profile / Edit profile / Recently (D106) + UI rounds | screenshots of the pre-fix UI | the fixes, tab jumps, link opening, keyboard |
| Conversation starters | **owner reported the latest flow works** (editor + Edit profile summary) | the new separate screens: error / delete / reopen persistence and **Preview** |
| Chat (from merge readiness) | photo send, full screen, draft, retry | Realtime re-establishment, photo URL refresh, HEIC / very large photos |

## Release (target April 2027) — open work, most important first

Compared with the code on 2026-10-27; older notes were checked against it.

1. **V2 in production.**
   - A production build runs V1 against live today (`v2Enabled` is false in production).
   - The V1 / V2 selection must be decided and built (`V2_MERGE_READINESS.md`).
2. **Server packages on a real backend.**
   - Every package from `20261009…` on is **local only**: Matches, Activity, interests / starters, chat photos, photo order, visits, D104–D106.
   - The shared project's current state is **unknown**.
   - Needs a staging decision (a separate test project or a planned rollout), then live. Never by hand on DEV = live.
3. **Security / keys** — the P0 key-rotation plan (`P0_KEY_ROTATION_PLAN.md`) and the `delete-account` redeploy were last reported as pending. Re-check them.
4. **Legal / KVKK** — the privacy notice is a draft that a lawyer hasn't reviewed; the private preferences and intention need a data-use review.
5. **Merge** — this branch into `main`. `main` has 2 doc commits this branch doesn't have. Merge only after approval, using the method in `V2_MERGE_READINESS.md`.
6. **Phone-test backlog** — the table above.
7. **Store readiness** — app name / icon / branding (design), screenshots, privacy labels, in-app account deletion on V2, TestFlight.
8. **Product decisions:**
   - premium visitor identities;
   - whether / how preferences are used for matching (needs disclosure and re-confirmation first);
   - Must-have semantics;
   - photo add / delete / replace and re-review;
   - free-text edits with moderation;
   - private preferences for members.
9. **Hygiene** — unsent-photo clean-up and photo downscaling, the intermittent Realtime timeout, ≈316 accumulated local test accounts.

**Repository visibility:** `dogukandurukan/perfect-match-app` is **public**. Everything pushed is visible to anyone — docs, decisions and synthetic test addresses included. No secrets are in the pending commits, but consider making the repo private before sharing more work.
