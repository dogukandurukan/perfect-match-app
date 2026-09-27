# P04 — Your Life UI

Status: READY — explicitly approved by Doğukan, 2026-09-27.
Implement on tempa/p04-your-life-ui based on latest tempa/p03-compatibility-ui including P03 R1 (59fb851 or later). Read latest main work packages and applicable repo instructions. Preserve local changes and worktrees, no reset/clean/force push. Use isolated worktree; report actual path.

## Approval
Owner approved four-screen Your Life mockup with simplified copy, plus small monochrome outline icons beside question headings and before pet-kind labels. No emojis or large illustrations. This package governs copy/layout over older Section 4 copy. Update ONBOARDING_FLOW.md, next unused DECISIONS IDs, and IMPLEMENTATION_STATUS.md on work branch.

## Exact ordered screens
Header section Your Life; local progress 1 of 4 through 4 of 4. All four primary questions required, single choice, no default selection.

1. Do you smoke?
Options: No / Sometimes / Yes
Small cigarette outline beside heading.

2. Do you drink alcohol?
Options: I don't drink / Sometimes / Regularly
Small wine-glass outline beside heading.

3. How do you feel about pets?
Options:
- I have pets
- No pets, but I like them
- I'm neutral about pets
- I'd rather not live with pets
Small paw outline beside heading.
When I have pets selected, reveal inline What kind? with single-choice Dog / Cat / Both / Other.
Icons before labels: dog / cat / dog-and-cat together / paw.
Both means dog and cat. Use existing installed icon sets, verify glyph availability; pair dog and cat glyphs if necessary. No new native dependencies or paid assets.
Pet kind is contextual: allow Continue on a valid primary pets answer even if kind is unanswered; no new required field gate authorized. Do not invent a default pet type. On changing away from I have pets, clear pet kind and hide follow-up; it must not remain in active answers. Other requires no extra free text.
Use one row if labels/icons comfortably fit, otherwise 2x2 on narrow/large-text screens. Never clip or shrink labels to force one row.

4. How active are you?
Helper: Physical activity
Options: Very active / Somewhat active / Not very active
Small walking-person outline beside heading.

No icons on the No/Sometimes/Yes etc. answer cards. No new questions about diet, sleep, children, job, or dealbreakers. Do not derive partner restrictions or scoring from personal habits.

## Visual
Reuse approved P03 R1 flat ivory #F7F3EA, forest green, Playfair bold headings and DM Sans controls. Mature restrained style. Heading icons about 18–20pt, subordinate to title, single forest-green color, aligned with first line. Avoid narrowing title enough to create a third line: adapt layout at narrow widths while keeping icon nearby.
Normal text-size headings target max two lines, consistent approximately 28/36pt across all four; no truncation. Reserve common title/helper height so options start at same baseline, correcting uneven baselines in generated board. Accessibility text may grow/scroll. Continue pinned, reachable. Thin beige card outlines, pale sage selected fill, green radio. Icons must not duplicate accessibility labels.
No prefilled answers: sample Dog selection in mockup was illustrative only.

## Connected preview
Extend existing isolated in-memory PreviewFlow. Compatibility values Continue -> Your Life Q1 directly, removing prior terminal Compatibility notice. Back from Q1 -> Compatibility values with all previous answers preserved. Preserve Basics ruler/location, all 7 Compatibility questions and 10 values, dev entry buttons including any newer V2 shortcut, existing deep link, production gate.
Across all sections forward/back retains answers during preview session except explicitly invalidated pet kind. Do not persist across reload or send/log personal answers.
After Your Life Q4 show compact dev-only notice: Your Life preview complete; nothing was saved; next section not built yet. Offer Review Your Life and Review from Basics, retaining drafts. No actual completion/application/membership state.
No Supabase requests, schema/migration, scoring, auth/SMS or production onboarding integration. Inherited app startup effects remain out of scope. No Section 5, merge or deploy.

## Validation and delivery
Use existing type and iOS export gates. Focus checks on 17-step navigation including section boundaries, required primary answers, empty defaults, pet-kind visibility/clearing, Both mapping, prior answer retention and existing dev gates. Verify available icons and visual fit as possible; clearly distinguish metric/code checks from device runtime, no fabricated screenshots.
Push implementation and docs/tempa/work-packages/P04_RESULT.md on P04 branch, with implementation SHA, checks, limitations and actual worktree launch instructions. If changing server worktree, tell owner to stop old Metro and use new QR. Do not claim a server is currently running without evidence. Existing dev build should suffice absent native dependency changes. Stop after push; owner reviews phone UI before further section.
