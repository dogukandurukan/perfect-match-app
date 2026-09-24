# P02 — Connected Basics UI preview

Status: READY — Doğukan explicitly approved moving to the next screens on 2026-09-24.
Owner: Claude Code. Reviewer: ChatGPT with Doğukan.
Work branch: `tempa/p02-basics-ui`, based on the latest `tempa/p01-onboarding-ui` implementation; also read current default-branch docs.

## Scope and authorization

Build the six-screen Section 2 Basics flow as an isolated development preview,
reusing P01 and D46. Name Continue must now advance to birthday rather than show
the P01 terminal notice. This authorizes UI code and in-memory draft/navigation
only. No DB/migrations/RPCs, Supabase writes, real auth/SMS, production onboarding
integration, matching/scoring, merge or deployment. No other sections.

Preserve unrelated local changes (especially `~/dating-app-recovered`). Use an
isolated worktree; never reset/clean/force-push. Do not reimplement P01 from scratch.
Read applicable repository instructions, DECISIONS.md D12–D16/D43/D46,
ONBOARDING_FLOW.md Section 2, P01_RESULT.md and the relevant existing components.
Written decisions override illustrative images. Do not promote proposed decisions.

## Screens and interactions

Use the existing warm ivory/forest-green palette, Playfair Display Bold 700
headings, DM Sans body/controls, shared temporary Tempa header, section-local
1 of 6 through 6 of 6 and keyboard-accessible Continue. Keep layout responsive;
do not hard-code title line breaks to imitate a single device.

1. **What's your name?** First name + last name, empty initially, preserve
   Unicode names. Helper: Only your first name appears on your profile.
2. **When's your birthday?** Full valid calendar date with unambiguous day/month/year
   labels; no preselected answer. Helper: Only your age appears on your profile.
   Reject impossible/future dates. Reuse existing age eligibility validation if
   present; document it. Do not invent a new age policy or zodiac question.
3. **What's your gender?** Woman / Man / Non-binary, single choice, no default.
4. **Who are you interested in?** Women / Men / Non-binary people, multi-select.
   Everyone is exclusive: choosing it clears specific choices; choosing any
   specific option clears Everyone. At least one choice. No matching implementation.
5. **Where do you live?** Manual current city input; not hometown, no neighborhood,
   address, distance, map, GPS permission or external lookup required for this
   preview. Manual entry is the approved sufficient path; optional GPS deferred.
6. **How tall are you?** Numeric centimeters with visible cm unit. Height remains
   required (optional height was only proposed); reuse existing bounds if present,
   otherwise require a positive valid numeric value and report missing product
   bounds rather than inventing them. No ranking changes.

Continue advances only when the current required answer is valid. Back restores
answers throughout this preview session. No prefilled identity/choice answers.
Local draft survives step navigation; persistence across reload/relaunch is NOT
part of this package. Do not claim data is saved. On step 6, show one compact
preview-only end message indicating Basics preview is complete and nothing was
saved, with an option to review previous steps. Do not create a real success,
submission, membership or discovery state or fabricate Section 3.

## Entry and device handoff

Keep `datingapp://dev/onboarding-v2-name` working as the entry to the connected
flow so Doğukan does not need another route. Preserve development-only gating,
no auth requirement and no production auth bypass. Do not change legacy Sign in
or phone onboarding. Report inherited app-startup side effects honestly; the
preview itself must not make backend requests. Do not modify unrelated startup.

The owner has already opened P01 on their iPhone: the 2026-09-24 19:08 screenshot
shows fields, loaded serif heading, Continue above keyboard and the local preview
notice. This supports that specific state only; do not mark all device tests passed.
The earlier Unmatched Route was resolved before this screenshot; do not assume
its root cause was proven. Make the served worktree/branch explicit to avoid
reconnecting to the legacy checkout. Do not ask the owner to switch/reset their
main checkout. Provide the exact command and current QR/connection guidance for
this worktree; do not invent a LAN address or claim a server is running if it isn't.

## Verification and result

Run relevant type checks and iOS bundle check, without unrelated fixes or broad
test suites. Focus on forward/back value retention, valid DOB, Everyone exclusivity,
required inputs, final local end state, keyboard and small-width layout. Separate
code inspection/build checks from actual runtime/device checks. Capture actual
screenshots if a runtime is available; otherwise state device verification pending.

Push implementation and `docs/tempa/work-packages/P02_RESULT.md` to the P02 branch.
Report status DONE/BLOCKED, implementation SHA, changed files, checks/results,
exact worktree launch steps and route, any inherited validation rules, pending
phone checks, and explicit scope confirmation. Update IMPLEMENTATION_STATUS.md
on the work branch only. Do not merge/deploy, start P03 or poll. Stop after reporting.

## Approved revision — D47/D48/D49, 2026-09-24

Status: REVISION READY. Continue on the existing P02 branch/worktree, preserving
previous work. Read these latest default-branch instructions first. This section
supersedes the original plain height and free-text-only city controls above.

- Birthday: preserve the current Day / Month / Year UI and validation.
- Height: centered large numeric value and immediately adjacent smaller cm;
  scrollable ruler with a fixed selection marker and 1 cm increments below.
  Tapping the value opens numeric entry. Keep ruler, number and draft synchronized,
  preserve Back retention, support accessible increment/decrement and small screens.
  No default answer: an initial visual ruler position must not become a submitted
  value until the user interacts/confirms. Do not use the owner's 182 as prefill.
  Product height bounds remain open; a viewport range must not silently become
  an eligibility restriction. Keep manual positive whole-number input available
  and recenter the ruler for valid values outside its initial window.
- Location: replace City label with City or district. Show matching selectable
  rows directly beneath the input; Turkish case/diacritic insensitive search.
  Required examples: istanbul → İstanbul, Turkey; kadikoy → Kadıköy, İstanbul, Turkey.
  Keep city/district/country and stable local ID structured in the in-memory draft.
  Selecting fills the label; editing query invalidates the old selection. Continue
  requires an actual selected result. Back restores it. Show an honest no-results
  state, never invent a result by appending Turkey to arbitrary typed text.
- For this no-backend development preview, use a clearly documented bundled
  catalog of real locations (at least İstanbul and its districts), not a paid API,
  API key or network geocoder. Document actual coverage and mark limited preview
  coverage in small helper copy; this is NOT worldwide production autocomplete.
  Keep data lookup separate so a future provider can replace it. No paid service,
  GPS, exact address, public district exposure, DB or matching changes.

The 19:26–19:27 device screenshots demonstrate rendering of birthday, city and
height only; do not claim full P02 validation passed. Update P02_RESULT.md with
revision SHA, coverage, checks, exact same-worktree phone instructions and pending
ruler/search device checks. Run focused checks for Turkish search, selection
invalidation, ruler/manual synchronization and Back retention plus existing build
gates. Push implementation/report, no merge/deploy/P03, then stop.
