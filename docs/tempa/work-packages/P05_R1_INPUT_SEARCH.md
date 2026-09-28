# P05 R1 — Input visibility and real catalog suggestions

Owner request, 2026-09-28: Job title and School examples are clipped at the underline; artists/books/movies should offer useful suggestions while typing.

## Work location and boundaries

Continue in the existing tempa/p05-your-world-ui branch and /Users/dogukandurukan/tempa-p05 worktree. Preserve unrelated local edits. Read AGENTS.md and P05_YOUR_WORLD_UI.md first. This package changes the prior no-network preview restriction only to allow read-only catalog search for artists/books/movies/series. Draft answers remain in memory. No auth, scoring, profile writes, schema changes, production onboarding integration, Section 6, merge, paid signup or deployment.

## Evidence already reviewed

P05_RESULT.md explicitly says providers are NOT CONNECTED. tasteSearch.ts searches bundled lists: 30 artists, 20 books, 23 movies/series. The owner's screenshots DO show Tarkan and Babam ve Oğlum suggestions, so do not diagnose a total typeahead failure. Missing broader coverage is a separate issue from input/layout clipping.

The branch already has a proposed OnboardingTextField fix restoring the underline to TextInput and overlaying the suffix. Its report says phone verification pending; this is not proof the screenshots use the fix or that the fix works.

## A. Fix and verify field visibility

1. Establish local branch/head, any local modifications, and the actual Metro worktree/port. Compare the current implementation with the existing clipping fix before making another change. Do not assume stale cache is the cause.
2. Inspect shared OnboardingTextField and callers for font metrics, vertical padding, height/shrink constraints, parent clipping and keyboard/footer overlap. Fix the root cause if still reproducible; do not mask it with arbitrary global offsets.
3. Placeholder AND typed text must be fully visible with descenders above the underline in job title, school, hometown, artists, books and screen search, plus earlier shared-field screens.
4. Keep the underline style and approved fonts. Preserve text scaling; do not disable accessibility scaling to hide clipping.
5. With keyboard open, focused fields and suggestion rows must be reachable by scrolling and tappable, clear of the fixed Continue/Add later footer. Ensure adequate content inset and keyboard handling.
6. Inspect the Work screen's excess gap before its five options; reduce unnecessary reserved spacing if needed to expose Job title while keeping compact titles and consistent layout. Do not shrink text to fit.

## B. Real artist/book/movie suggestions

The desired behaviour is suggestions after typing >=2 characters, not popular content before typing. A small hardcoded list is only a preview fallback, not completion of this requirement.

1. Inspect any newly available provider configuration without printing secret values. Evaluate suitable catalog providers against their official current documentation: artist-only results, books, movies AND series, Turkish/international coverage, partial query support, quota/terms, identifiers, and credential requirements.
2. Implement read-only live adapters where a suitable provider is already configured or usable without account/paid setup. Do not invent credentials, scrape websites, or put secret keys in Expo public variables/client bundles. If a server proxy is required, prepare reviewable code/config instructions; do not deploy.
3. If credentials, provider choice with material tradeoffs, or deployment blocks any category, finish the unblocked UI/adapters and report the exact dependency. Do not silently call sample search live or declare all categories complete. Do not enlarge sample arrays as a substitute for live integration.
4. Preserve 300ms debounce, stale-response protection, loading/empty/error states, stable provider IDs, explicit custom entry, duplicate handling and independent limits (3 artists, 3 books, 3 screen titles). Selecting a result adds a removable item and clears the query.
5. Distinguish a result from the custom action visually. Keep useful verified metadata (author, year, Movie/Series); use verified imagery only where provider permits, neutral placeholders otherwise.
6. Network failure must not block optional onboarding or remove selected items. Never log queries/answers. Keep fallback provenance honest: no silent live-to-sample switch.
7. Schools/hometown may retain clearly disclosed sample/custom behaviour for this revision; do not claim live search there.

## Verification and handoff

Run typecheck and focused checks for changed logic. Use simulator/runtime screenshots if available; clearly distinguish actual runtime checks from code inspection. No optional exhaustive regression suite is required.

Check empty placeholders, focused text, keyboard open/closed, increased text size, query clear, rapidly changing queries, failed search, selection/removal and max limits. Verify representative partial Turkish/international queries across all live categories rather than only the bundled examples.

Append an R1 section to P05_RESULT.md: implementation SHA, actual worktree/Metro source, whether the earlier field fix was already present, root cause evidence, changes/checks, provider and live/sample/blocked status separately for each category, remaining dependencies and precise phone instructions. Push the work branch and stop. Do not merge or start the next section.
