# P06 — Your Dates (approved owner handoff, 2026-09-28)

## Goal and baseline
Implement the approved two-screen Your Dates section, connected after Your World, in the isolated V2 development preview. Owner asked to implement this BEFORE starting the final Your Profile section.

Read AGENTS.md, canonical docs/tempa documents and P05_RESULT.md. Base a new tempa/p06-your-dates-ui branch/worktree on the latest tempa/p05-your-world-ui INCLUDING the input recycling fix ee448d921fa1629d7e63c9bf5501343067b5fbab (or its verified descendant). Preserve unrelated local work. Suggested worktree ~/tempa-p06; report actual path. Fetch this package from main without replacing the newer implementation with older main code.

Owner said input fields now look fixed after R2; record this as owner visual acceptance, not comprehensive accessibility/runtime verification. Preserve explicit shared input lineHeight and live catalog work. Don't reintroduce the earlier placeholder clipping.

## Approved change superseding older Section 6 docs
REMOVE Dinner's conditional Casual & cozy / Fine dining / Either follow-up completely.
Replace it with ONE optional favorite venue field, shown for everyone regardless of selected date types. Coffee + Dinner does NOT create two venue fields. No venue search integration in this package.

Update canonical flow/decisions on the work branch to reflect this approval; use the next available decision number, don't overwrite existing decisions.

## Screen 1 — Your Dates, 1 of 2
Title: "Your ideal first date?"
Helper: "Pick 1 or 2."

Two columns, three rows:
- Coffee / Drinks
- Dinner / A fun activity
- A walk / Outdoors

Use stable internal keys compatible with existing canonical mappings if any; document mapping. Small mature outline icons in cards: cup, wine glass, cutlery, ticket/activity, footsteps, mountain. No heading emoji. Selected card: pale sage, green outline, corner check that does not move the label.

Required minimum 1, maximum 2. No defaults. Count "N of 2 selected". A third selection must not silently replace an existing choice. Deselect remains available. Accessible selection state; normal-size labels unbroken; large text may use a single column.

Below cards, always show:
"Have a favorite spot?"
"For a first date. Optional."
Placeholder: "Enter a place name"

One optional free-text field (suggest maxLength 120 as an implementation bound). Use the corrected shared input with existing underline styling; maintain full visible placeholder and typed text. Empty/whitespace-only = no venue. Allow editing/clearing and preserve draft on Back. A typed venue never substitutes for the required date-type selection. Preserve visible spelling/case; don't uppercase the display name or pretend free text is a verified place.

Model as custom/unverified text in the in-memory draft, e.g. source custom and raw/display name. No fabricated place ID, coordinates or address. Future provider-selected places can have provider+ID+branch/address; document future extension only. No database/ETL implementation, geocoding, provider account, API requests or automatic date scheduling.

CTA: "Continue", enabled when date-type selection valid; venue optional.

## Screen 2 — Your Dates, 2 of 2
Title: "When are you free?"
Helper: "For a first date."

Group "Days": Weekdays / Weekends / Either (single choice).
Group "Time": Daytime / Evening / Either (single choice).
No defaults. Both groups required; each Either is exclusive within its own group. Selections independent.

Days = three full-width rows; Time = three compact controls on one row when readable, stack when necessary for width/accessibility.
Show live summary after both selected, e.g. "Weekends · Daytime".
Friendly summary labels for Either: "Any day" and "Any time".
Summary helper: "Choose the exact time together."
These are general preferences, not scheduled availability, exact dates or a reservation.

CTA: "Continue to your profile".
For THIS preview only it leads to an honest terminal preview state:
"Your Dates preview complete"
"This is a development preview — nothing was saved. The next section isn't built yet."
Actions: "Review Your Dates" and "Review from Basics".
Keep the terminal notice out of the normal question layout until the CTA is pressed.
Do not implement Your Profile, photos, prompts, selfie or email in P06.

## Flow, UI, scope
- Your World 6 Continue/Add later → Your Dates 1, removing its old terminal notice. Back Dates 1 → World 6; Back Dates 2 → Dates 1; retain all earlier drafts.
- Expected primary preview screens: 25 (23 earlier + 2), verify actual flow.
- Keep signed-out DEV preview access and production gating.
- Ivory #F7F3EA, forest #1F3A2E, sage #E6ECE3, approved Playfair titles 28/36 and DM Sans controls. Short headings at most two lines at normal font size; accessible scaling can expand. No text truncation to force fit.
- Cards/optional field must scroll clear of pinned footer and keyboard. Reuse existing keyboard reveal behaviour. No enormous reserved blank gap; do not shrink text to squeeze content.
- Mockup example selections are NOT defaults.
- Preview state only. No profile writes, auth, migrations, scoring, production navigation integration, booking, Spotify, paid services, merge or deployment.

## Verification and report
Run typecheck and focused meaningful checks for required/min/max date choices, optional venue empty/clear/retention, exclusive Either selections, summary updates, forward/back retention and preview end. Test actual iOS layout if available; don't represent typecheck as phone verification. Specifically check placeholder after the earlier height ruler, keyboard/footer overlap and larger text.

Create docs/tempa/work-packages/P06_RESULT.md with implementation SHA, actual base/worktree, changes, checks vs pending phone review, limitations, and precise Metro startup instructions using that worktree. Don't claim an unobserved Metro server source/address. No new native build unless a real dependency change requires one.

Push tempa/p06-your-dates-ui and stop for owner phone review. Do not merge or begin Section 7.
