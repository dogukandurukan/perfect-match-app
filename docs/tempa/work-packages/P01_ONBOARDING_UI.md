# P01 — Onboarding visual foundation + name screen

Status: REVISION READY — original implementation authorized 2026-09-23; visual refinement D46 explicitly approved by Doğukan on 2026-09-24.
Owner: Claude Code. Reviewer: ChatGPT with Doğukan.
Work branch: `tempa/p01-onboarding-ui`.

## Authorization and boundaries

Doğukan approved this small UI-code package in the shared conversation.
This lifts the previous documentation-only restriction **only for the scope below**.
No other onboarding screens or later packages are authorized by this document.

Implement reusable onboarding visual primitives and one working local UI:
**Section 2 — "What's your name?"**.
No database changes, migrations, RPCs, backend writes, auth/SMS changes,
matching changes, production deployment, or redesign of other app screens.
Do not implement profile prompts, prompt inspiration, photo/profile layout,
likes/comments, or remaining open product questions in this package.

## Start with the current repository

Fetch the latest remote state; inspect local changes and applicable repository
instructions. Preserve unrelated work; do not reset, clean, force-push, or
commit unrelated files. Use the work branch above, based on the latest default
branch. If unrelated local work prevents this, use an isolated worktree or
report the concrete blocker rather than discarding it.

Read only what is relevant:
- `docs/tempa/DECISIONS.md`: D2, D3, D12, D14, D16, D42, D43.
- `docs/tempa/ONBOARDING_FLOW.md`: Section 2 name screen.
- `docs/tempa/IMPLEMENTATION_STATUS.md`: relevant UI/routing/font gaps.
- `docs/tempa/mockups/section-02.png`: first screen is the visual reference.
- Existing app entry, navigation, font loading, and nearby UI components as needed.

Written approved decisions override illustrative mockup labels. Do not use
older handoff/schema drafts to expand the scope.

## Deliverables

1. Small reusable onboarding components/tokens, only those needed here:
   ivory background, dark green CTA, field styling, header, title and spacing.
   Scope these to V2 onboarding; do not change the global app palette.
2. Actual **Playfair Display Bold (700)** for question headings and **DM Sans**
   for body/labels/buttons. Load via the project's compatible font approach,
   retain required licenses, avoid synthetic bold and unrelated upgrades.
   Headings must be dark and clearly readable, not faint.
3. A shared **Tempa** header/wordmark placeholder, designed to be replaced
   centrally with a final logo. The working name is not a final brand decision.
4. One name screen with:
   - Title: **What's your name?**
   - **First name** and **Last name**, initially empty.
   - Helper: **Only your first name appears on your profile.**
   - Section-local progress: **1 of 6** (Basics only).
   - Dark green **Continue** action.
   - Working keyboard/text entry and local state; preserve accents and
     non-Latin names. Do not add new name-length or identity rules.
5. A safe, clearly documented development preview entry to inspect this screen
   without modifying the active onboarding/auth flow. Reuse an existing preview
   pattern where possible. Do not introduce any production auth bypass.
   Continue must not submit to the backend or silently advance into unfinished
   screens; in this isolated preview use an explicit local demo response.
   Do not claim "Your progress is saved" without real persistence.

## Acceptance and verification

- The first Section 2 mockup's hierarchy and spacing are recognizable.
- Approved typography and palette render correctly.
- Narrow phone widths, safe areas, and the open keyboard do not clip inputs
  or hide the Continue action; Turkish characters display correctly.
- Tempa branding has a single reusable replacement point.
- Preview opens by the documented route/steps; it does not alter auth or DB.
- Run relevant existing type/lint checks and a focused UI smoke check.
  Distinguish pre-existing failures from new failures. Do not add a broad test
  suite for this visual package or fix unrelated problems.
- Capture a screenshot of the actual rendered implementation when available;
  commit it under `docs/tempa/reviews/p01/`. Do not substitute the design mockup
  for implementation evidence. If runtime access is unavailable, state that
  honestly and give exact reproduction steps.

## Handoff and stop

Commit and push only this package's changes to the work branch.
Do not merge or deploy automatically.

Write `docs/tempa/work-packages/P01_RESULT.md` on that branch with:
- Status: DONE or BLOCKED.
- Branch and implementation commit SHA.
- Concise changed-file summary.
- Exact preview steps and screenshot path(s).
- Checks performed and actual outcomes.
- Any remaining question, its consequence, and a recommended answer.
- Explicit confirmation that no DB/auth/matching changes were made.

Update the relevant part of `IMPLEMENTATION_STATUS.md` on the work branch:
P01 implemented for review, with branch reference; do not mark all of V2 done.
Push the report and stop. No periodic polling, automatic P02, or repeated
full-repo reading. ChatGPT will read this branch/report directly; Doğukan
should not need to copy terminal output between assistants.

## Approved revision — 2026-09-24 (D46)

Continue the existing P01 implementation on `tempa/p01-onboarding-ui`; do not
recreate it or discard prior work. Fetch and read this package and D46 from the
latest default branch before editing. Apply only the following visual refinement:

- Warm flat ivory screen; dark forest-green Continue; no dark-theme variant.
- Large, dark, legible Playfair Display Bold 700 question heading, wrapping
  naturally (two lines where appropriate); DM Sans body, labels AND button.
- Shared visible temporary Tempa header with a central future logo replacement.
- First/last name inputs with thin underline styling, without enclosing boxes.
- Generous spacing in the normal state; when the keyboard opens, keep both
  fields reachable and Continue above the keyboard, respecting safe areas.
  Allow scrolling on narrow/small screens rather than clipping content.
- Preserve specified copy, initially empty inputs, Section 2 placement and local
  progress 1 of 6. The conversational image showed example names, seven progress
  marks, a generic helper and a serif button; these are not specification changes.

Refresh P01_RESULT.md with revision commit, actual checks/screenshots and exact
phone preview instructions. Clearly state the branch/commit served by the dev
server, the preview route and whether the existing installed app can load it or
requires a new development build. Do not assume the owner's currently running
app already includes this branch. Do not automatically merge or deploy.

Preview actions must not add backend writes. Report any inherited app-startup
side effects separately (e.g. existing authenticated last-active/location updates);
do not claim the whole app is write-free merely because this screen is local.
No unrelated startup/auth changes are authorized.

Acceptance on the owner's phone: correct palette/fonts; first and last name
entry (including Turkish characters); keyboard-visible Continue and accessible
fields; no clipping; Continue gives only the documented local preview response.
Owner phone validation remains PENDING until actually performed. Push report
and implementation to the work branch and stop.
