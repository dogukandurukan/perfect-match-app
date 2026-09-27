# P05 — Your World preview and typeahead search

READY. Owner approved proceeding with Your World and explicitly approved type-to-search suggestions on 2026-09-27. Owner accepted P04 on phone before proceeding.
Work branch: tempa/p05-your-world-ui, based on latest tempa/p04-your-life-ui INCLUDING heading-icon removal R1. Read repo instructions, latest canonical docs and P04_RESULT. Preserve existing worktrees and local changes; isolated worktree, no reset/clean/force push. Read this package from latest main.

## Scope and search honesty
Extend in-memory development preview only. No Supabase writes, schema/migration/scoring/auth changes, no production onboarding integration, merge, deploy or Section 6.
Approved target: selectable search suggestions appear AFTER typing; no popular suggestions on empty query. Music searches ARTISTS only, not songs/playlists/genres. Books and movies/series use independent searches.
Inspect existing catalog/search infrastructure. Reuse a suitable already-configured read-only provider if present and authorized by repo configuration; do not invent credentials, add paid services, create provider accounts or expose secrets in the client. If no usable provider exists, build a clearly labeled development sample catalog with real examples and asynchronous provider adapters, custom entry fallback, and document real provider connection as pending. Do not claim worldwide/live search or fabricate result metadata/images. This fallback is implementation staging, not a change to the approved final typeahead behavior. Report provider readiness separately from UI completion.
Artist photo, book cover + author, movie/series poster + year/type when verified available; otherwise tasteful neutral placeholder. Do not scrape arbitrary imagery. No new native dependency unless concretely required.
Search after at least 2 trimmed characters, debounce roughly 300ms, handle stale responses, loading, error, empty state. Clear results on clearing query. Errors/no results never block optional screens. Allow exact typed custom entries with explicit custom provenance, including disambiguation where useful, never silently merge fuzzy matches. Stable source IDs where available; avoid duplicate selections of same source ID and exact normalized duplicate custom entries. Persist nothing in this preview.

## Six ordered screens and exact copy
Header Your World, local 1 of 6 through 6 of 6, no defaults.

1. What do you do?
Single choice Full-time / Part-time / Self-employed / Student / Between jobs.
Optional Job title (optional), placeholder e.g. Designer. No employer.
Whole screen optional: Add later; partial valid draft can be continued.

2. Where did you study?
Helper Add your school to your profile.
Search or enter your school. Select suggestion OR explicit Use “[typed name]”.
Optional, Add later. No education attainment.
Suggestions school name and verified city/country where known.

3. Where are you from?
Helper Your hometown, not where you live now.
Label Hometown; placeholder Search or enter a city.
Search/select or explicit custom entry. Optional Add later. No GPS/map/distance. Keep separate from current location.

4. What are you into?
Helper Pick 3–10 interests.
Travel / Food / Sports / Music / Art / Movies / Books / Outdoors / Tech / Gaming / Fashion / Wellness / Animals / Nightlife / Culture / Other.
Required min3 max10; count N of 10 selected. No Add later. Prevent 11th without replacement; deselect allowed. Other doesn't add an unapproved free-text question.

5. Who do you listen to?
Helper Add up to 3 artists you love.
Search artists. Optional 0–3; N of 3 added; selected removable rows/chips, edit by remove/reselect. Add later.

6. Books & movies
Helper Add a few favorites. You can change them later.
Two separate groups Books · N of 3 and Movies & series · N of 3.
Search books / Search movies or series.
Independent optional 0–3 each (up to6 total). Selected entries removable. Add later.

Continue advances valid optional drafts including empty ones. Add later advances without silently deleting previously entered valid selections; dismiss uncommitted search query. Required interests gating stays intact. No prefilled sample answers. Illustrative Sade/Daft Punk/Sabancı in mockup aren't defaults.

## Visual and navigation
Use existing flat ivory/forest green, Playfair bold headings around28/36pt, DM Sans all controls INCLUDING Continue. No heading icons. Normal-size titles target <=2 lines without truncation, accessibility may grow/scroll. Align title/helper block and answer start consistently; safe areas and keyboard-accessible footer. Reuse established input styling and selection cards rather than generated-image artifacts (serif buttons/gradients).
Typeahead results directly under input, selected items below, results dismiss after selection. Search queries and added selections must be visually distinct. Honor max limits with clear feedback, keep removal possible.
Your Life Q4 Continue -> Your World Q1 directly; remove former terminal notice. Back from World1 -> Life4. Retain all session drafts across 23 primary steps, including pet rules, location/ruler, Compatibility values. Preserve latest dev entry shortcuts and production gating.
World6 Continue or Add later ends with compact Your World preview complete notice (nothing saved; next section not built yet), Review Your World and Review from Basics. No backend completion state. No personal-answer/query logging.

## Checks and delivery
Check existing type/iOS export gates and focused meaningful behavior: boundaries/back retention, optional skip, interests3–10, independent media limits, duplicate handling, remove/reselect, stale requests, no-results/error/custom fallback, empty-query has no recommendations, dev gating. Use installed tooling, no broad new test suite. Distinguish code/metric checks from actual device runtime.
Update ONBOARDING_FLOW, next unused DECISIONS IDs and IMPLEMENTATION_STATUS on work branch for approved copy/search behavior. Push code + docs/tempa/work-packages/P05_RESULT.md with SHA, provider names or sample coverage, live search pending items, checks and actual worktree/QR/reload instructions. Do not claim running server without verification. No paid provider setup or full catalog claims. Stop after push, no merge/deploy/Section6.
