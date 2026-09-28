# P05 R2 — iOS input clipping remains open

Owner phone feedback 2026-09-28 after R1: e.g. Designer and Search artists still show only the upper portion of the placeholder at the underline. New artist screen shows the public-catalog helper and selected Tarkan/Kenan Doğulu, consistent with R1 UI; do not dismiss this as the original pre-fix screenshot.

Continue in existing tempa/p05-your-world-ui / ~/tempa-p05. Preserve local edits. Read project instructions and P05_RESULT.md. No merge, deploy, auth/schema/scoring changes or next section.

## Required fix
- Reopen the shared text-field bug. R1 font-metric calculation is a hypothesis, not validated resolution. Its min height of 44 and computed explicit height did not establish correct iOS native placeholder positioning.
- Reproduce with empty placeholder and typed text, blurred/focused, keyboard open/closed. Check job title, school, hometown, artists, books, movies and earlier shared fields.
- Inspect actual native input geometry, content insets, font registration/metrics, inherited defaults/styles, single-line behaviour, wrapper clipping and shrink. Use controlled temporary comparisons (system font vs DM Sans, padding zero vs current, border in wrapper vs input) to isolate the cause, not repeated guessed height increases.
- Keep approved underline style and accessible text scaling. Do not float a fake placeholder over the broken input or disable scaling.
- Verify with actual iOS runtime screenshots if available. If no simulator/device access, explicitly report verification pending; typecheck is not visual verification.
- Work/School and Artists screenshots must show the full placeholder with adequate baseline/underline gap. Suggestions and selected rows must remain reachable above footer with keyboard open.
- Update P05_RESULT.md with implementation SHA, root cause evidence, checks performed and minimal reload instructions. Push branch, stop for phone review.

## Artist visual direction / deferred dependency
Owner would like photo-rich artist cards, potentially Spotify like Bumble, but is happy to defer if involved. Preserve current working live catalog search (MusicBrainz artists, Open Library books, Wikidata screen per R1 report). No Spotify integration/account or OAuth work in this bugfix.

Record future direction: verified artist photos, compact name cards, existing ivory/forest-green theme; photos supply colour, no heading emoji. Catalog search/photo display and connecting a user's Spotify to import top artists are separate scopes. Spotify developer access, quotas and image/display terms must be checked before choosing it for production. Do not substitute album art for artist portraits or scrape photos.

Official starting points:
- https://developer.spotify.com/documentation/web-api/reference/search
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide

Priority: finish the visible input bug first. Do not report image integration as complete.
