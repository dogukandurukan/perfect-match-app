# P03 — Compatibility UI + in-app preview entry

Status: READY — explicitly approved by Doğukan on 2026-09-24.
Owner: Claude Code. Review: ChatGPT + Doğukan.
Work branch: `tempa/p03-compatibility-ui`, based on latest
`tempa/p02-basics-ui` including D47–D49 (revision fab9712 or later).
Read latest default-branch documents as well.

## Owner feedback and scope
Doğukan reported the requested P02 height/location changes now work and approved
moving on. This is owner acceptance of those changes, not evidence that every
device/accessibility/edge-case test passed.

Extend the existing isolated preview: Basics height Continue → Compatibility
questions 1–7. Add an in-app development-only preview button so Safari is no
longer necessary. UI and in-memory navigation/draft only. No Supabase requests,
DB/migrations, scoring, auth/SMS changes, production onboarding integration,
merge or deployment. No Section 4 or automatic next package.

Read applicable repo instructions; preserve local/unrelated changes and existing
worktrees. No reset/clean/force-push. Use an isolated worktree for P03; state its
actual path in the report. Reuse P02, never replace it with an older P01 copy.

## Canonical requirements
Read ONBOARDING_FLOW.md Section 3 for exact ordered question and option copy,
DECISIONS.md D3/D4/D17–D21/D43/D46–D49, and P02_RESULT.md.
The 7 required questions are:
1. What are you looking for?
2. What's your social life like?
3. When you're dating someone, how often do you like to message?
4. How much space do you like in a relationship?
5. How open are you with your feelings?
6. How soon would you like to meet a match?
7. In a relationship, I value…

Use the full canonical English wording and subtitles; do not silently shorten
the long questions. Q1–Q6 single-select, no preselection. Q7 uses the nine
canonical values, 1–2 selections, helper "Choose up to 2." Prevent a third
selection without silently replacing an existing one; selected values remain
deselectable. Continue disabled until valid. Intent keys long_term / casual /
figuring_out; other local keys do not approve a backend schema.

Keep D46 ivory/forest-green theme, Playfair Display Bold question headings and
DM Sans controls/body. Reuse option cards with subtitles; long titles/options
must wrap and scroll without hiding the footer or clipping large text. No new
palette or unapproved illustrations. Retain shared temporary Tempa branding.

## Connected behavior
- Remove the terminal P02 Basics notice in this extended flow: height Continue
  goes directly to Compatibility question 1, with no congratulations/interstitial.
- Show section name (Basics / Compatibility) with local progress 1 of 6 / 1 of 7
  so the reset is understandable, without adding a separate screen.
- Back from Compatibility 1 returns to height. All Basics and Compatibility
  answers remain intact in the preview session, including structured location
  selection and ruler value. Back/forward editing must not reset other answers.
- Preserve existing empty-state/validation behavior of Basics and D47–D49.
- After Compatibility 7 show a compact development-preview end notice stating
  nothing was saved and next section is not implemented, plus review navigation.
  No account creation, real completion/application/membership/discovery state.
- In-memory only, no claim of persistence across reload or leaving the route.
  Do not log personal answers.

## In-app entry (explicitly approved)
Add a clearly marked "Preview new onboarding" button to the actual existing
signed-out welcome/login landing screen used on normal app launch, visible only
under __DEV__. It opens the same isolated preview without signing in, SMS or
Safari. Keep actual Sign in/Get started behavior unchanged. Inspect entry and
routing before choosing insertion point; document the exact screen and file.
Keep `datingapp://dev/onboarding-v2-name` working for backward compatibility.
Route remains production-gated. This is a dev UI entry, not an auth bypass for
protected app data; do not change session logic or security guards.
Do not redesign the welcome screen or expand into Section 1.
If already signed in, document how to reach the preview using existing dev entry
or signing out; do not force sign-out or reset the owner's account/session.

## Checks and handoff
Run existing type/iOS bundle gates and focused meaningful checks for required
choices, max-two selection/deselection, forward/back across section boundary,
answer retention and final local notice. Check dev button/route production gating.
Distinguish code inspection from device testing; no fabricated screenshots or
claims of runtime verification. Reuse existing tests if present; no broad suite.
Inherited app startup effects described in P02 remain out of scope.

Push code and docs/tempa/work-packages/P03_RESULT.md on the P03 branch with
implementation SHA, concise changes/check results, remaining blockers,
actual worktree launch command, which landing screen has the preview button,
and pending phone checks. Explicitly tell the owner to stop the older P02 Metro
and connect to the QR from the P03 worktree if a new server is required. Do not
invent a current IP/port or claim a server is running unless verified.
No new native dependency unless concretely necessary; report any rebuild need.

Update IMPLEMENTATION_STATUS.md on the work branch. Do not mark all V2 complete.
Push, then stop. No automatic merge, deploy, P04 or polling.
