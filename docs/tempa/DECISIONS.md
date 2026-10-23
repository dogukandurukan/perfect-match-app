# Decision log

Markers: ✅ APPROVED · 🟡 ACCEPTED (inferred) · 🔵 PROPOSED · 🔴 OPEN
(see [README](README.md)). Source "HO" = `Tempa_Final_Handoff_2026-09-22`
(file 05 decision table unless noted). Source "Audit" = repo/DB audit 2026-09-23.

## Flow and structure

| # | Topic | Status | Source / note |
|---|---|---|---|
| D1 | Seven sections are kept (Account, Basics, Compatibility, Your Life, Your World, Your Dates, Profile) | ✅ APPROVED | HO 03 |
| D2 | Warm editorial visual direction of the approved boards (ivory/cream surfaces, very dark green CTA/selected, restrained gold, serif display + sans body). No redesign, no new palette. | ✅ APPROVED | HO 01 §2, 03 |
| D3 | One question per screen, except combined day/time screen and in-context conditional details | ✅ APPROVED | HO 01 §2 |
| D4 | No section-end congratulations screens; final confirmation is not another task | ✅ APPROVED | HO 01 §2 |
| D5 | Back keeps answers; drafts saved; resume at last unfinished step; honest pending/failed save states | 🟡 ACCEPTED (inferred) | HO 01 §2 (implementation guidance) |
| D42 | Green/ivory design (D2) is used across the **entire onboarding** (all seven sections). Other app screens (Discover, Matches, Activity, Chats, Profile, Settings) are evaluated separately later. | ✅ APPROVED | Doğukan, 2026-09-23. Closes Q3. |
| D6 | Section-local progress must look local; auth progress separate from questionnaire progress | 🟡 ACCEPTED (inferred) | HO 01 §2 |
| D43 | Onboarding typography: **Playfair Display Bold (700)** for question headings; **DM Sans** for body, labels and buttons. Headings must be dark and clearly legible, not faint. Keep **Tempa** visible in the header as a temporary wordmark to be replaced by the final logo later; this does not finalize the brand name or logo typography. | ✅ APPROVED | Doğukan, 2026-09-23, selected visual option A. Closes Q4. Documentation only; no code or DB changes in this task. |

## Section 1 — Account

| # | Topic | Status | Source / note |
|---|---|---|---|
| D7 | Email + email code move from Section 1 to Section 7 (before submission) | ✅ APPROVED | HO 05 |
| D8 | Phone OTP is the entry identity; email attaches to the **same** Supabase Auth user; no second account via email sign-in | ✅ APPROVED (follows D7) | HO 01 §4 |
| D9 | Standalone "Let's get to know you" preparation screen removed; phone verification goes straight to Section 2 name | 🟡 ACCEPTED (inferred) | HO 05 — no separate explicit removal sentence. Do not silently reintroduce. |
| D10 | Welcome copy "People, not profiles." / "Meet people you connect with. Make plans to meet in real life." | 🟡 ACCEPTED (inferred) | HO 01 §4, corrected board |
| D11 | SMS provider / payment deferred; mock provider in development only, **no mock bypass in production** | ✅ APPROVED | HO 01 §4. Audit: no mock/provider abstraction exists in the repo yet. |

## Section 2 — Basics

| # | Topic | Status | Source / note |
|---|---|---|---|
| D12 | Section 2 stays the same six fields: name, DOB, gender, interested in, current location, height (cm) | ✅ APPROVED | HO 05 |
| D13 | No Instagram in Section 2 | ✅ APPROVED | HO 05 |
| D14 | Surname removal / optional height | 🔵 PROPOSED — **not** requirements | HO 01 §5 |
| D15 | Gender: **Woman / Man / Non-binary** — single choice. No "Prefer not to say" and no "self-describe" option. **Supersedes** the earlier four-option version of D15 (same day). | ✅ APPROVED | Doğukan, 2026-09-23. Closes Q1 (with D15b). Storage keys (e.g. `woman/man/non_binary`) remain 🔵 PROPOSED. |
| D15b | Interested in: **Women / Men / Non-binary people** — multi-select, plus **Everyone**, which covers all and cannot be combined with other options. Eligibility is **mutual**: A and B can see each other only if A's gender is within B's preference **and** B's gender is within A's preference (Everyone matches any gender). | ✅ APPROVED | Doğukan, 2026-09-23. Closes Q1. |
| D16 | Only first name and age public; DOB and surname private; zodiac derived, no extra question | 🟡 ACCEPTED (inferred) | HO 01 §5 |

## Section 3 — Compatibility

| # | Topic | Status | Source / note |
|---|---|---|---|
| D17 | Seven required questions in fixed order with exact copy in `ONBOARDING_FLOW.md` §3 | ✅ APPROVED | HO 04, 05; copy revised by **D50** (2026-09-25) |
| D18 | Messaging frequency and personal space are separate questions and must not be double-weighted | ✅ APPROVED | HO 04 |
| D19 | Values: choose 1–2 of nine | ✅ APPROVED — **count/layout superseded by D51 (ten values, 2 columns)**; 1–2 rule unchanged | HO 04 |
| D20 | Intent keys `long_term` / `casual` / `figuring_out` | ✅ APPROVED | HO 04 + earlier session (`figuring_out` spelling authoritative) |
| D21 | No love languages, conflict style, politics or children questions | ✅ APPROVED | HO 01 §6 |

## Section 4 — Your Life

| # | Topic | Status | Source / note |
|---|---|---|---|
| D22 | Four questions: smoking, drinking, pets (+ in-context kind), physical activity — copy in `ONBOARDING_FLOW.md` §4 | ✅ APPROVED | HO 05; copy revised by **D52/D53** (2026-09-27) |
| D23 | Own habits do not create partner dealbreakers; no new lifestyle hard exclusions | ✅ APPROVED | HO 01 §7 |

## Section 5 — Your World

| # | Topic | Status | Source / note |
|---|---|---|---|
| D24 | Work, school, hometown optional ("Add later"); interests required 3–10 (**minimum lowered to 1 by D59**); artists 0–3; books 0–3 and movies/series 0–3 optional | ✅ APPROVED | HO 05; copy/behaviour detailed by **D54/D55** (2026-09-27) |
| D25 | Interest taxonomy (16 items incl. Other) | ✅ APPROVED (as board/spec) | HO 01 §8 |
| D26 | Music = artists only (no genres/playlists) for MVP; no standalone zodiac screen | ✅ APPROVED | HO 01 §8 |
| D27 | Catalog provider for artists/books/titles | 🔴 OPEN | no paid integration assumed |

## Section 6 — Your Dates

| # | Topic | Status | Source / note |
|---|---|---|---|
| D28 | Two screens: date types (1–2 of six, conditional dinner vibe) and days + time + live summary | ✅ APPROVED — **dinner vibe removed and copy superseded by D57** | HO 05 |
| D29 | Dinner vibe is for venue suggestions only; zero score; removed if Dinner deselected | ⛔ SUPERSEDED by D57 (dinner vibe removed) | HO 01 §9 |

## Section 7 — Build your profile

| # | Topic | Status | Source / note |
|---|---|---|---|
| D30 | Order: photos (≥3) → prompts (2, 3rd optional) → preview → private selfie → email → email code → submit → received | ✅ APPROVED — confirmed by **D58** (2026-09-28, with explicit Submit review before Received) | HO 05; Doğukan 2026-09-28 |
| D31 | Selfie is private and manually reviewed; uploading ≠ verified | ✅ APPROVED | HO 01 §10, consistent with earlier product decisions |
| D32 | "Received" state does not grant discovery; no "You're all set" / 24-hour promise | 🟡 ACCEPTED (inferred) | HO 01 §10 |
| D33 | Start with two suggested prompts: **"I'm most myself when…"** and **"Something I could talk about for hours…"**. Users can change either prompt from a library. **Two answers required, third optional**; helper: "Short answers are welcome." **"A perfect first date looks like…"** remains a selectable alternative, not a default. Never autofill answers. | ✅ APPROVED — **prompt library and starting pair superseded by D59** (2 required / third optional / never autofill still apply) | Doğukan, 2026-09-23. Supersedes the previous suggested pair. Resolves Q6's default/swap behavior; remaining library entries and storage-key mapping are not approved by this decision. |
| D34 | Auto-enforcing clear-face photo | 🔴 OPEN | HO 01 §10 |
| D35 | Rejection and resubmission policy | 🔴 OPEN | must be defined before real users |

## Legacy onboarding screens (decided 2026-09-23)

| # | Topic | Status | Source / note |
|---|---|---|---|
| D40 | The following legacy onboarding screens are **not carried into V2**: Instagram, education level, morning/night, recharge style, standalone bio, first-date expectation | ✅ APPROVED | Doğukan, 2026-09-23. Closes Q2. |
| D41 | Languages and neighborhood/distance preference are **not** part of V2 onboarding. They may be reconsidered later as Settings/Filters items; they create **no new screen and no schema requirement now** | ✅ APPROVED | Doğukan, 2026-09-23. Closes Q2. |

Consequences: no V2 schema/enum is designed for these fields; the submission
RPC must not require them; existing V1 columns (`instagram_handle`,
`education`, `morning_night`, `recharge_style`, `bio`,
`first_date_expectation`, `languages`, `neighborhoods`,
`discovery_max_distance`) are left untouched (no drop in this work) and
simply unused by V2 onboarding. Their removal from profile display/edit, if
wanted, is a separate decision.

## Profile presentation (decided 2026-09-23)

| # | Topic | Status | Source / note |
|---|---|---|---|
| D44 | Interleave profile photos and prompt-answer cards: **primary photo + first name/age → short profile facts / shared interests where applicable → prompt 1 + answer → photo 2 → prompt 2 + answer → photo 3 → optional prompt 3 and remaining photos**. Photos and answers are collected separately during onboarding and assembled in the Section 7 preview. No per-prompt photo selection or thematic photo/answer pairing is required. | ✅ APPROVED | Doğukan, 2026-09-23, approved the alternating layout after the Bumble reference. Profile colors and overall visual styling remain separate from onboarding (D42). |
| D45 | Support the direction of contextual likes/comments on an individual photo or prompt answer, to start a conversation from a specific profile detail. | ✅ APPROVED (direction) | Doğukan, 2026-09-23. Interaction details, limits and delivery behavior are not defined here. No code or database changes authorized in this documentation task. |

## Matching / scoring

| # | Topic | Status | Source / note |
|---|---|---|---|
| D36 | Broad candidate pool + strong priority for aligned intent; no silent hard intent filter | ✅ APPROVED (direction) | HO 02, 05 |
| D37 | The 100-point question-level table | 🔵 PROPOSED — not validated | HO 02; supersedes the old Core 40 / Lifestyle 25 draft |
| D38 | Zodiac 0 points; qualitative explanation instead of percentage | 🔵 PROPOSED | HO 05 |
| D39 | Job/school/hometown/height 0 points; optional omissions never count as mismatch | 🟡 ACCEPTED (inferred) | HO 01 §8, 02 |

## Data / repo facts relevant to decisions (Audit 2026-09-23)

| # | Fact | Consequence |
|---|---|---|
| F1 | Live DB is empty: `auth.users=0`, `profiles=0`, `onboarding_answers=0`; no V2 tables exist | Legacy value migration (e.g. `Socially`→`Occasionally`) has no real rows to move. Still keep `questionnaire_version`. |
| F2 | Private `verification-selfies` bucket exists (private); `user-photos` is public | Selfie storage base is ready |
| F3 | The older proposed migration `20260921100000_v2_schema_proposed.sql` is unapplied and encodes the **old** question set | Must be revised before applying |

## Onboarding visual refinement (approved 2026-09-24)

| # | Topic | Status | Source / note |
|---|---|---|---|
| D46 | Final approved onboarding direction: warm ivory background, dark forest-green CTA, large high-contrast Playfair Display Bold (700) question headings, DM Sans for body/labels/buttons, restrained thin-underlined short text inputs instead of enclosing boxes, and a visible temporary shared Tempa header. Continue remains accessible above the open keyboard. Applies across onboarding; only the P01 name-screen refinement is currently authorized for implementation. | ✅ APPROVED | Doğukan, 2026-09-24, approved the side-by-side name-screen / keyboard-open visual mockup. No dark-theme alternative selected. |

The generated image is a visual reference, not a replacement for written flow rules:
keep the name screen in Section 2, section-local progress **1 of 6**, empty initial
fields, and helper **Only your first name appears on your profile.** Its example
names, seven progress marks, and serif Continue label are illustrative artifacts;
buttons use DM Sans. Preserve existing name/privacy rules. The mockup does not
prove actual keyboard behavior; verify in the running app. P01 remains isolated
UI preview work; no merge, deployment, backend, auth or database work authorized.

## P02 device feedback — 2026-09-24

| # | Topic | Status | Source / note |
|---|---|---|---|
| D47 | Keep birthday entry as separate Day / Month / Year fields, as shown in the P02 device screenshot. | ✅ APPROVED | Doğukan, 2026-09-24. Visual/input approval, not proof of all validation cases. |
| D48 | Height: centered large numeric value with adjacent cm, a scrollable ruler below, and tap-the-number keyboard entry. Ruler and typed input stay synchronized. | ✅ APPROVED | Doğukan, 2026-09-24. Replaces the plain underlined height field. Product min/max bounds remain undecided. |
| D49 | Current location: typing opens selectable suggestions underneath. City and district results are allowed: Istanbul → İstanbul, Turkey; kadikoy → Kadıköy, İstanbul, Turkey. Selection can be changed. No separate neighborhood question, precise address or new distance preference. | ✅ APPROVED | Doğukan, 2026-09-24. Replaces P02's free-text-only implementation; narrowly refines D41 to allow district selection inside the existing location screen. Does not approve public district display, GPS, scoring, paid provider or schema changes. |
| D50 | Compatibility (Section 3) uses the approved simpler English copy: *What are you looking for?* (A serious relationship / Something casual / Not sure yet); *How social are you?*; *How often do you like to text?* + helper "When dating someone"; *How much time together feels right?* + helper "When dating someone"; *Is it easy to share your feelings?*; *When would you like to meet?*; *What matters most to you?* + helper "In a relationship. Pick 1 or 2." No option subtitles. Question IDs and option keys unchanged. Supersedes the D17 full-copy/subtitle wording (full text in `ONBOARDING_FLOW.md` §3). | ✅ APPROVED | Doğukan, 2026-09-25, approved the seven-screen mockup (P03 R1). |
| D51 | Values (3.7): ten values in two equal columns × five rows, row-major — Trust, Growing together, Fun, Stability, Personal space, Adventure, Affection, Family, Health, Respect (Respect directly below Family). Renamed labels keep existing keys (`growth`, `independence`); `respect` is a new local UI key only. Small single-colour outline icons left of text; pale sage selected fill, green border, fixed corner check; 1–2 selections, third blocked, no preselection. Supersedes D19's nine-value, three-column layout. | ✅ APPROVED | Doğukan, 2026-09-25 (P03 R1). Does not approve backend/scoring changes for `respect`. |
| D52 | Your Life (Section 4) copy: *Do you smoke?* No / Sometimes / Yes; *Do you drink alcohol?* I don't drink / Sometimes / Regularly; *How do you feel about pets?* I have pets / No pets, but I like them / I'm neutral about pets / I'd rather not live with pets; *How active are you?* + helper "Physical activity" — Very active / Somewhat active / Not very active. Headings are **text-only** (the heading icons first approved in P04 were removed on 2026-09-27 after phone review, P04 R1); no icons on answer cards. Supersedes D22's older wording. | ✅ APPROVED | Doğukan, 2026-09-27, approved the four-screen Your Life mockup (P04); heading icons removed same day (P04 R1). Local keys do not approve backend schema or scoring. |
| D53 | Pet kind: inline *What kind?* only when "I have pets" is selected — Dog / Cat / Both (dog and cat) / Other, icons before labels, single choice, optional (no new required gate, no default, no free text for Other). Changing away from "I have pets" clears it. One row if it fits, otherwise 2 × 2. | ✅ APPROVED | Doğukan, 2026-09-27 (P04). |
| D54 | Your World (Section 5) copy and rules: *What do you do?* (Full-time / Part-time / Self-employed / Student / Between jobs + optional Job title, no employer); *Where did you study?* + "Add your school to your profile."; *Where are you from?* + "Your hometown, not where you live now." (Hometown, separate from current location); *What are you into?* + "Pick 3–10 interests." (16 interests, required 3–10 — **now 1–10 with "Pick a few things you enjoy." per D59**); *Who do you listen to?* + "Add up to 3 artists you love." (artists only, 0–3); *Books & movies* + "Add a few favorites. You can change them later." (independent Books 0–3 and Movies & series 0–3). All but interests optional with **Add later**. No education attainment, no heading icons. Supersedes D24's older wording. | ✅ APPROVED | Doğukan, 2026-09-27 (P05). Local keys do not approve backend schema or scoring. |
| D55 | Typeahead search for school, hometown, artists, books and movies/series: selectable suggestions appear only after typing (≥ 2 chars, ~300 ms debounce), no popular suggestions on an empty query, stale responses ignored, loading/empty/error states non-blocking, explicit custom entry with custom provenance, no fuzzy merging, duplicate source IDs and exact normalized custom duplicates rejected; verified metadata/images only, otherwise neutral placeholders. | ✅ APPROVED | Doğukan, 2026-09-27 (P05). Live provider connection is pending; D27 (catalog provider) remains OPEN. |
| D56 | Interest chips (Section 5, *What are you into?*) show a small single-colour forest-green outline icon left of each label (e.g. Food → restaurant, Travel → airplane); no emojis. Selected = pale sage fill + green border. | ✅ APPROVED | Doğukan, 2026-09-27, chose outline icons over emojis after phone review. |
| D57 | Your Dates (Section 6): *Your ideal first date?* + "Pick 1 or 2." — Coffee / Drinks, Dinner / A fun activity, A walk / Outdoors (2 × 3, outline icons, keys `coffee`, `drinks`, `dinner`, `activity`, `walk`, `outdoors`), required 1–2, third refused, no defaults. **Dinner's Casual & cozy / Fine dining / Either follow-up is removed**; instead **one optional favorite-spot field for everyone** ("Have a favorite spot?" / "For a first date. Optional." / "Enter a place name") — free text, custom/unverified, never replaces the date-type requirement, no venue search. *When are you free?* + "For a first date." — Days (Weekdays / Weekends / Either) and Time (Daytime / Evening / Either), both required single choice, live summary ("Weekends · Daytime"; Either → "Any day" / "Any time") + "Choose the exact time together."; CTA "Continue to your profile". General preferences, not scheduling. Supersedes D28's dinner vibe and D29. | ✅ APPROVED | Doğukan, 2026-09-28 (P06 handoff). Local keys and the in-memory spot shape do not approve a schema, scoring, provider or venue search. |
| D58 | Your Profile (Section 7) approved visual direction and copy (P07): **Add your photos** / "Add at least 3 photos." — six slots 2 × 3, **3–6 photos**, first = "Main photo", reorder/replace/remove; **A little more you** / "Answer 2 questions. Add a third if you like." — D33 defaults, answers start empty, changeable prompts, preview library adds "My perfect Sunday", "We'll get along if…", "A small thing that makes me happy" (plus D33's "A perfect first date looks like…"), 200-character proposed cap; **Your profile** / "This is how others will see you." (D44 order, Edit profile / Continue); **A quick selfie** / "Help us check it's really you." (private, "Your selfie stays private." / "We'll review it with your profile photos."); **Your email** / "We'll send you a code." ("Your email stays private."); **Check your email** (6-digit code, Resend code / Change email); **Ready to submit?** (checklist Photos / Answers / Selfie / Email, explicit **Submit application** — email verification never submits); **You're on the list** ("We've received your application." / "We'll email you when your profile has been reviewed.", panel "Application received · Review pending", **Review my profile**). No review timeframe, price or acceptance promise. | ✅ APPROVED (visual/copy) | Doğukan, 2026-09-28 (P07 mockup; seven boards + canonical Submit state). Mockup people/answers/email are illustrative, never seeded. Extra prompt IDs are preview copy, not a backend enum (Q6 storage keys still open). DEV preview only: photos/selfie are local URIs, email code and submission are simulated — no upload, email, auth, application record or verification. |
| D59 | P07 phone review (UI only): (1) photos grid must show six slots 2 × 3 with visible main tag and edit controls; reorder via Make main / Move earlier / Move later (no drag promise); 3–6 kept. (2) Prompt library replaced by the shorter set *My weird talent… / Don't judge me, but… / I can't say no to… / My most used phrase… / You pick the topic… / Together, we could… / Guess this about me… / My Sunday usually looks like…*; start with *Don't judge me, but…* and *Together, we could…*; example answers only as placeholders; 2 required, third optional, no duplicates, never lose an answer silently; compact cards. (3) Profile preview shows real data from every section (name + age first; city, height, zodiac, work, school, hometown; intent, interests, values; artists, books, movies; smoking, drinking, pets, activity; date types, days/time, favorite spot) as one scrolling page with consistent photo sizes; private fields excluded; no send/note controls on own preview. (4) Separate "Ready to submit?" state removed: correct code → "Email confirmed" + explicit **Submit application** (re-checks, routes to what's missing) → **You're on the list!** / "Thanks for joining Tempa." / "We'll email you after we review your profile." / Application received · Review pending, light one-off confetti respecting Reduce Motion. Your Profile = 7 states. (5) *What are you into?* minimum 1, maximum 10, helper "Pick a few things you enjoy.", still required. Supersedes the matching parts of D24, D33, D54, D58. | ✅ APPROVED (UI) | Doğukan, 2026-09-28 (P07 R1). Backend, scoring and prompt storage keys are **not** decided by this entry — see V2_BACKEND_SCORING_AUDIT.md / V2_INTEGRATION_PLAN.md (proposals only). |
| D60 | P07 R2 (owner, after phone review): **Photos** — 3 × 2 fixed slots (2 columns when narrow / large text), tap-to-add, tap for a large preview with Replace / Remove / Make main / Move earlier / Move later, hold-and-drag reordering, counter, 3–6 kept, no automatic top-photo ordering. **Prompts** — three empty "Choose a prompt" cards (2 required + 1 optional), helper "Pick 2 prompts. Add a third if you like.", categorised picker (All / About me / Just for fun / You & me / My everyday) over a 20-prompt local catalog with Turkish meanings and EN/TR example hints (help text only), separate editor, answers in Turkish or English stored as typed, 200-char cap, no duplicates, no silent loss or re-attachment. Supersedes D59's prompt library/starting pair and the photo grid description. DEV-only build label (package · commit · worktree). | ✅ APPROVED (UI) | Doğukan, 2026-09-29 (P07 R2 scope). Prompt ids are local keys, not a backend enum (Q6 open). No backend change. |

P02 visual refinements are authorized within the isolated development preview.
Implementation limits and catalog coverage must be reported in the P02 result;
no claim of worldwide autocomplete or real persistence without implementation.

## Matches — daily picks (decided 2026-10-08)

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D61 | Under the **Matches** title, a small line **"Daily picks · Refresh at 12:00"** (Istanbul time). No seconds countdown. | ✅ APPROVED (product) | Doğukan, 2026-10-08. Shown in the DEV Matches preview only; real refresh time comes from the server. |
| D62 | Small secondary captions: **Picked for you** → "Someone new to get to know."; **You both liked** → "A mutual match to get to know." Large photos and the existing buttons (View profile outlined, Say hello filled) stay. | ✅ APPROVED (copy) | Doğukan, 2026-10-08. |
| D63 | Daily picks refresh at **12:00 Istanbul time**. A refresh only changes **which cards are featured** — likes, matches and conversations never end or expire because of it. | ✅ APPROVED (product) | Doğukan, 2026-10-08. In the real app the pick period and refresh time come from the server; opening/closing the app or changing the device clock never produces a new pick. **Selection weights / scoring are NOT decided.** |
| D64 | **You both liked** features a mutual match with **no conversation yet**. After the first message the card shows the existing **Conversation started** state for the rest of that pick period; at the next daily pick that person is **not featured again**. The conversation continues in Chats. | ✅ APPROVED (product) | Doğukan, 2026-10-08. Which mutual match to feature when there are several is not decided (the preview uses a fixed example order). |
| D65 | **One person never appears in both sections.** If the Picked-for-you person becomes a mutual match during the period, that **same card** shows the current relationship state and **Say hello** works — no second copy. | ✅ APPROVED (product) | Doğukan, 2026-10-08. |
| D66 | No suitable new candidate → the section's **empty state**; a person is **never re-offered as a new pick**. Access to other matches does **not** depend on being featured (they stay in Chats). | ✅ APPROVED (product) | Doğukan, 2026-10-08. Preview copy for "matches exist but none left to feature": "No new mutual match to feature today" / "Your matches stay in Chats." (proposed, not separately approved). |

## Matches — integration decisions (decided 2026-10-08)

Adds to D61–D66 (unchanged). Implemented in the proposed package `20261009090000_v2_matches_daily_picks.sql` (**not applied to the shared project**; verified on the local replica).

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D67 | **Temporary pick rule:** among candidates who pass mutual eligibility, a stable per-user / per-period random draw. Not a compatibility score, never presented as "best match". Scoring remains a separate open work item. | ✅ APPROVED (temporary) | Doğukan, 2026-10-08. D37 / D38 unchanged (proposed). |
| D68 | The **period is server-side** and changes at **12:00 Istanbul**. Reopening, concurrent requests or the device clock never produce another person. A person featured before is never re-offered as a pick. Someone who becomes unavailable mid-period is **not replaced** until the next period. | ✅ APPROVED | Doğukan, 2026-10-08. Refines D63 / D66. |
| D69 | **Today's pick is not shown in Discover** for that period. The result doesn't depend on which tab is opened first. | ✅ APPROVED | Doğukan, 2026-10-08. Closes audit Q4. |
| D70 | In V2 a like's **comment never becomes a chat message**. It is shown above the chat as context (which photo / prompt, who sent it). Existing messages are not deleted or reclassified; **V1 keeps** its note-as-first-message behaviour. A mutual like creates the match **immediately**. **Say hello** opens the real chat and sends nothing. For new V2 matches, Conversation started only appears after a real message. | ✅ APPROVED | Doğukan, 2026-10-08. Closes audit Q1. Historic auto-seeded messages can't be told apart reliably and are counted as messages (reported, not guessed). |
| D71 | **Featured mutual rotation:** unmessaged matches may be featured again. Order: never featured first, then least recently featured, ties → older match. A single eligible match may repeat the next day. A pick who likes back turns into Say hello **on the same card** (no copy). Conversation started stays until the end of the period. | ✅ APPROVED | Doğukan, 2026-10-08. Closes audit Q3. |
| D72 | **Plans:** date suggestions are reached **inside the related chat**; data and existing actions are kept. Matches stays two cards; no new date design in this round. | ✅ APPROVED | Doğukan, 2026-10-08. Closes audit Q2. |
| D73 | **Hidden ≠ suspended:** <br>• **Hidden** (the user's own choice) leaves new discovery and daily picks; existing matches and chats continue; profile access is **not** opened to everyone. <br>• **Suspended** (platform) is modelled explicitly as `membership_status = 'suspended'`: no new interaction, messaging closed, the other participant can read the history as "Account unavailable". <br>• A generally inactive membership (e.g. `none`) is **not** treated as suspended. Block, delete and unmatch rules are not relaxed. | ✅ APPROVED | Doğukan, 2026-10-08. Closes audit Q6. |
| D74 | **Like source:** `discover` / `daily_pick` are recorded and validated on the server. Old likes stay unknown (`NULL`), with no backfill. <br>• `daily_pick` is accepted **only for the current period's pick**. A `daily_pick` for an earlier day's pick (e.g. a profile left open since before 12:00) is refused (`stale_pick`) **before any like or quota is spent**, and the app asks for a refresh. Having been featured on some day is never enough. <br>• A **past pick who was not liked** and now appears in normal Discover **can** be liked with source `discover`. <br>• Liking **today's** pick from Discover is refused (`stale_pick`): it isn't shown there (D69) — only a stale card could do it. | ✅ APPROVED | Doğukan, 2026-10-08. Clarified the same day (owner): the discover / past-pick distinction is explicit and covered by a test. Activity UI not built this round. |

## Activity — incoming interest → match (decided 2026-10-12)

Owner approved the three-screen mockup *Activity → Profile → Match & chat* (2026-10-12). Built so far in the **DEV preview only** (`app/dev/activity-preview.tsx`, synthetic data, no backend); the real Activity tab is not changed yet. **Supersedes** the preview-only Activity design of 2026-10-11 (V2_ACTIVITY_DESIGN_PREVIEW_RESULT round 1: separate "Likes you" / "New matches" sections, View profile button, "Like back", "Mark all as read") and the discussed alternatives **"Like back", "Just match", "Match & reply", "Match & send"**.

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D75 | **One vertical feed.** No "Likes you / Updates" tabs. Incoming interest is shown as **large, single-column person cards** (no avatar-led notification list, no two-column grid). About **two cards per normal phone screen**; on small screens the photo gets shorter, the text is not squeezed. The large photo is the **liker's** photo; name, age and area (shared district, else city — same rule as Discover) sit legibly on the photo. | ✅ APPROVED (UI) | Doğukan, 2026-10-12. |
| D76 | **Card content:** a short interaction line + time — **"Liked you"** (whole profile), **"Liked your photo"**, **"Liked your answer"**. If there is a comment, a short quote below it; my liked photo may appear as a small thumbnail. **No comment → nothing** (no "No comment", no empty box). A person's like and its comment are **one card**. Tapping **anywhere on the card** opens the full V2 profile; no large "View profile" button. | ✅ APPROVED (UI) | Doğukan, 2026-10-12. |
| D77 | **Matches in the same feed** as smaller rows: **"You and Selin matched"** + time; tap opens that chat. When a pending person is matched, their card **turns into** the match row — a person never shows as both pending and matched. **Read state is separate from match state:** viewing a card or profile marks it read and **never accepts** the interest. | ✅ APPROVED (product) | Doğukan, 2026-10-12. Server read state for likes does not exist yet (open, see the preview result). |
| D78 | **Profile from Activity = the full existing V2 profile** (all photos, answers and fields — the short profile in the mockup is not a content reference), plus a small context area with the liked content and any comment. **One** primary action: **"Match & chat"** (caption "Match with {name} and open your chat."). It accepts the interest, creates the mutual match **immediately** and opens the chat — no first message needed, no "It's a match!" in this flow, no separate reply screen. Leaving the chat without writing keeps the match. Opening the profile or going back creates nothing. Already matched → the button reads **"Open chat"** and opens the existing chat. Repeated taps never create a second match or chat. On failure nothing looks matched: a clear error and retry. | ✅ APPROVED (product) | Doğukan, 2026-10-12. Supersedes "Like back", "Just match", "Match & reply", "Match & send" — never two accept buttons. Server path (which like target / quota) is an open integration item. |
| D79 | **Chat:** the existing chat is reused (no separate chat system). It may open empty ("Say hello to {name}" / "Send a message whenever you like."). The like / comment may appear as a small **"How it started"** context card — it is **not** a sent message (consistent with D70). Nothing is ever sent on the user's behalf. After the first real message the existing *Conversation started* behaviour continues. | ✅ APPROVED (product) | Doğukan, 2026-10-12. The real chat still shows its old empty text and has no "How it started" heading — follow-up when Activity is wired. |
| D80 | **Visual:** warm ivory, dark green, simple type (Playfair Display + DM Sans), large photos, using the existing design tokens. Safe area, bottom navigation and the sticky button never cover content. The same person keeps one visual identity from feed card to profile to chat avatar. | ✅ APPROVED (UI) | Doğukan, 2026-10-12. |

## Discover — like / pass (decided 2026-10-12)

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D81 | In Discover, the **main heart / swipe right likes the whole profile**; **× / swipe left passes**. On a mutual like Discover **may** show **"It's a match!"** (only there — not in Activity's Match & chat, D78). Per-photo / per-answer hearts with comments stay as approved. | ✅ APPROVED (product) | Doğukan, 2026-10-12. **Not implemented** — separate later work, deliberately not changed with the Activity preview. Supersedes the Discover preview's "No swipe; × passes" note (V2_DISCOVER_DESIGN_PREVIEW_RESULT). |

## Activity — real integration (2026-10-12)

Implements D75–D80 on real services. Package `supabase/proposed/20261012090000_v2_activity_accept.sql` — **applied to the LOCAL Supabase only** (tempa-local), not to the shared DEV/live project. Report: `work-packages/V2_ACTIVITY_INTEGRATION_RESULT.md`.

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D82 | **Match & chat accepts the incoming like on the server** (`accept_like_v2(p_like)`): only the like's **recipient** may call it (anyone else: `not_found`). It creates / upgrades the **one** match row of the pair (accepted, chat open, same shape as a mutual like) and links the incoming like to it. The liked photo / answer stays **context**; the match is between the two people. **No reverse like row, no message, no daily-like unit.** Repeats, concurrent taps and retries after a lost response return the **same** match (pair lock + unique pair index). Blocked, unmatched (`passed`), suspended or no-longer-eligible pairs are refused with nothing written; an unmatched pair is never revived. | ✅ APPROVED (owner brief 2026-10-12) | Closes preview open items 1 (server path / quota) and 3 (pending = like to me, `sent`, still visible under V2 rules, no active match). |
| D83 | **Read state of a like = `likes.seen_at`**, written only by `mark_like_seen_v2` when the liker's full profile is opened from Activity. Loading the list never marks anything; marking never accepts. Notifications rows per like were considered and **not** used (a second record of the same like). Match rows show a dot only for unread **messages** (existing `messages.read_at`). | ✅ APPROVED (owner brief: "smallest consistent solution") — mechanism chosen by Claude Code | Closes preview open item 2. The tab-bar badge does not count unseen likes yet. |
| D84 | **Who sees identities in Activity is unchanged:** the existing rule of `get_my_liker_cards` — premium sees the cards, non-premium sees only a count ("N people like you" → Premium). LOCAL test accounts are made premium **in the local data**; there is no code bypass. | ⏳ INTERIM — premium visibility for V2 is still an **open product decision** (preview open item 4) | Owner, 2026-10-12: test access must not become a production premium decision. |
| D85 | **Chat (D79 follow-up):** the real V2 chat shows the likes under the heading **"How it started"** (a whole-profile like is shown too) and the empty state **"Say hello to {name}" / "Send a message whenever you like."** V1 chat unchanged. | ✅ APPROVED (D79) | — |
| D86 | Activity match rows = all active matches (`get_my_matches_v2`), newest activity first; **how long a match row stays in Activity is not decided** (all are kept for now). | ⏳ OPEN | Preview open item 5. |

## Interests & conversation starter (decided 2026-10-14)

Package `supabase/proposed/20261014090000_v2_interests_takes.sql` — **applied to the LOCAL Supabase only** (tempa-local). Report: `work-packages/V2_INTERESTS_TAKES_RESULT.md`. Product direction: meeting through shared curiosity — interests made visible with a short personal answer; relationship intent is judged separately and a shared book never makes up for an intent mismatch.

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D87 | **One optional personal answer per member** ("conversation starter"), 1–180 characters, Turkish or English (stored as typed; UI stays English). Tied to **one** of the member's own saved **activities, books, movies/series or artists** (existing source ids kept); never to a broad interest category. | ✅ APPROVED | Owner, 2026-10-14. |
| D88 | **Short fixed questions per subject kind** (two each): Activity — "What’s your favourite part?" / "What does a perfect one look like?"; Book — "Why this book?" / "What stayed with you?"; Film & series — "Why this one?" / "A scene you’d watch again?"; Music — "Which song should someone start with?" / "When do you listen to them most?". No analysis, no personality test. | ✅ APPROVED (owner: short fixed questions) — wording by Claude Code, owner to confirm | — |
| D89 | **Activities catalog** (fixed ids, optional, max 5): Running, Walking, Cycling, Hiking, Swimming, Gym, Yoga, Pilates, Dancing, Cooking, Gaming, Photography. Separate from the 16 broad interests (their 1–10 rule unchanged); nothing is derived from the broad categories. | ✅ APPROVED | Owner, 2026-10-14. |
| D90 | **Approved members may edit only** broad interests, activities, books, movies/series, artists and the conversation starter, from Profile → **Interests & conversation starter**. No re-review. Identity, photos, standard prompts and every other application field stay locked; the general `v2_assert_editable` lock is **not** relaxed — narrow server operations for active members only. | ✅ APPROVED | Owner, 2026-10-14. |
| D91 | **Consistency rules:** another subject never inherits the old answer (same subject → same take id; new subject → new take id); the server copy stays until a save succeeds; removing the take's subject is refused until the member confirms, then subject + answer change **atomically** (cancel keeps both); deleting the answer alone keeps the selection; existing matches, messages and like contexts are never changed by an edit. | ✅ APPROVED | Owner, 2026-10-14. |
| D92 | **Display:** the card ("Running · Activity", question, answer) sits under the main photo in the own profile and in the full V2 profile (Discover / Matches / Activity / chat → profile), through the existing visibility rule. No answer → nothing for others; own profile shows **"Add a conversation starter"**. **No like / comment on it yet; no "You both…"** — no commonality is computed. | ✅ APPROVED | Owner, 2026-10-14. Likes on it → later package (with a snapshot of the liked text). |
| D93 | **Next onboarding package (not built now):** an application is complete with **two standard answers OR one standard answer + one personal interest answer**. Submission rules are **unchanged in this package**; existing members' standard answers (incl. the optional third) are not touched. | ✅ APPROVED — recorded, not implemented | Owner, 2026-10-14. |

## Conversation starters — up to three (decided 2026-10-15)

Package `supabase/proposed/20261015090000_v2_takes_multi.sql` — **LOCAL Supabase only**. Report: `work-packages/V2_INTERESTS_TAKES_RESULT.md` (Round 2). Adds to D87–D93; D93 (onboarding rule) unchanged and still not built.

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D94 | **0–3 conversation starters per member**, each about a **different** saved activity / book / movie-series / artist (one per subject; mixing kinds is allowed, not required). Each 1–180 characters, edited and deleted on its own. Adding never overwrites another; editing the text keeps the record id; changing the subject creates a new record **in the same display position** (nothing carried over; cancel keeps the saved one). Removing a selection removes **only** the starters about it, after explicit confirmation, in one transaction. Limits hold on the server under concurrent requests. The existing single starter is kept with its id and content (position 1). Display order = stable position, never edit time. Supersedes D87's "one per member". | ✅ APPROVED | Owner, 2026-10-15. |
| D95 | **Editing screen "Your interests"**: section **"Conversation starters"** with a small "n of 3" counter; saved starters as compact cards (Edit / Change / Remove); "Add a conversation starter" only below three; the subject list opens only while adding or changing. Below: Interests, Activities, Artists, Books, Movies & series — one heading each, no repeated labels or catalog notes; a search failure shows a short error with **Try again** in place. | ✅ APPROVED | Owner, 2026-10-15. |
| D96 | **Question wording:** for **Running**, `activity_perfect_day` reads **"What does your ideal run look like?"** (same key, same meaning as "What does a perfect one look like?", so stored answers keep their meaning). All other question texts unchanged and listed in the report for a separate review. | ✅ APPROVED (Running); others ⏳ to review | Owner, 2026-10-15. |
| D97 | **Profile display:** one compact "Conversation starters" section (0–3 rows: subject line, question, answer in regular body text — no large bold serif), under the main photo in the own profile and the full V2 profile. Nothing for others when empty; own profile keeps "Add a conversation starter". Still no like / comment and no "You both…". | ✅ APPROVED | Owner, 2026-10-15. |

## D93 implementation — onboarding (2026-10-16)

Package `supabase/proposed/20261016090000_v2_onboarding_takes.sql` — **LOCAL Supabase only**. Report: `work-packages/V2_INTERESTS_TAKES_RESULT.md` (Round 4).

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D98 | **D93 rule enforced on the server** (`v2_missing_for`): an application's answers are complete with **≥ 2 valid standard answers**, or **≥ 1 valid standard answer + ≥ 1 valid conversation starter** (non-blank, its subject still saved). Starters alone never count; 0–3 starters unchanged; every other requirement unchanged. A direct `submit_application_v2` call can't bypass it. | ✅ APPROVED (D93) | Owner, 2026-10-14 / 2026-10-16. |
| D99 | **Who may write starters:** active approved members (unchanged) **or the applicant themself while their application is editable** (draft / changes requested — the existing `v2_assert_editable` rule). Submitted (pending), rejected, suspended and signed-out callers are refused. The general application lock and `save_prompts_v2` are **not** changed (applicants' prompt rows have no likes; members' prompt ids untouched). | ✅ APPROVED (owner brief: narrow path, lock not relaxed) — mechanism chosen by Claude Code | — |
| D100 | **Onboarding UI (live, supporting servers only):** "What are you into?" shows the 12 **Activities (optional, max 5)** under the broad interests; "A little more you" keeps the prompt cards and adds the **same Conversation starters editor** as Profile → Your interests ("Prefer one prompt? Add a conversation starter… instead of a second prompt"). With a saved starter, the second prompt card reads "Optional". Removing a Your-World item that a starter is about asks first (Cancel keeps both; Remove deletes only that starter, atomically) and the completeness is recomputed from the server. Servers without the package get exactly the old payload and screens. | ✅ APPROVED (D93) — layout by Claude Code, phone test pending | Owner, 2026-10-16. |

## Shared selections on a profile (decided 2026-10-16)

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D101 | **"Both into this"**: on **another member's full V2 profile** (Discover, Matches, Activity, chat → profile), a small secondary line under an existing item the viewer also has saved. **Exact intersection only:** kind + source + canonical id (broad interests / activities: their fixed key); typed ("custom") entries and same-title different ids never count. **At most two** marks per profile, fixed priority **book → movie/series → artist → activity → broad interest**, ties in their profile order; an item that is already the subject of one of their conversation starters is not marked again. Nothing when nothing is shared (no text, empty state or card); never on the own profile or the onboarding preview; conversation starters unchanged. Computed on the device from the viewer's own `get_my_interests_v2` + the already-visible `get_profile_v2`, re-read on every open / focus, never persisted; errors show nothing and retry on the next focus. **No new table, migration or RPC.** No score, badge, animation or AI. | ✅ APPROVED | Owner, 2026-10-16. Discover ranking, Daily picks, D81, likes and the chat quiz out of scope. |

## Member photo order (decided 2026-10-21)

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D102 | **Narrow exception to D90:** an approved, **active** member may **reorder their own existing approved profile photos and choose the main photo** (Profile → Photos; local draft, Save, discard warning). Only the order changes: **no adding, deleting, replacing a file or changing review / approval state**; photo ids stay, so likes on a photo keep their target. Server: `reorder_member_photos_v2(p_ids, p_expected)` — exact current id set required, a stale `p_expected` order is refused (`photos_changed`, no silent overwrite), atomic, keeps the `profiles.photos` copy in order. The application lock (`v2_assert_editable`) and every other D90 lock are unchanged. | ✅ APPROVED | Owner, 2026-10-21. Package `supabase/proposed/20261021090000_v2_member_photo_order.sql`, LOCAL only. Adding / replacing / deleting photos and other profile fields: later packages. |

## Profile visits (decided 2026-10-22)

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D103 | **Activity → Profile visits.** A visit = an active member **successfully loaded another member's full V2 profile** (Activity → profile, Matches → profile, chat → profile). Not a visit: Discover cards / previews, preloading, the own profile, design previews, failed loads. **One record per person**, updated on the last counted visit; within **24 h** (`v2_profile_visit_window()`, a named product constant) a reopen changes nothing, so repeats / re-renders never fake a later visit. Shown as **"Viewed your profile"** or, for a later separate visit, **"Visited again"** — never an exact number. A small "Profile visits" entry in Activity, never mixed into the like cards, **not part of the unseen-like badge**, creates no like / match / notification. Blocked, deleted, suspended or no-longer-visible people are not listed; only one's own visitors can be read; the visitor is always the caller. **Before the first recorded visit** the visitor is told visits are visible — no hidden visits. Notice (owner, 2026-10-23): a small inline area, "People whose profiles you visit can see you in their profile visitors.", one primary button **Got it** (acknowledges, then records); closing it or going back records nothing and saves no acknowledgement, so it shows again on the next eligible open. **Identities (proposal = current implementation, not a final owner decision):** like D84 — premium → name + photo; otherwise "N people visited your profile" + the premium offer. No back-filling from history. | ✅ APPROVED, except the premium identity rule: ⏳ proposal / current implementation, awaiting the owner's final confirmation | Owner, 2026-10-22 (visit rules). The premium rule was the recommended option in a question during implementation; it is recorded as a proposal, not as a final decision. Package `supabase/proposed/20261022090000_v2_profile_visits.sql`, LOCAL only. |

## Optional connection questions (decided 2026-10-22)

| # | Decision | Status | Source / notes |
|---|---|---|---|
| D104 | **"How do you connect?"** — optional questions **just before the first submit** (first draft; the questions will change). Invite: title "How do you connect?", "A few optional questions about what feels right for you in a relationship.", **Explore** / **Skip for now**. Explore → 4 single-choice questions with the existing onboarding option cards (meeting someone new · when something bothers me · spending time together · showing care). Every question can be skipped and "Skip for now" always leads to the normal submit. **Not required** for completeness or acceptance (`v2_missing_for` and D93 unchanged). **Private:** not on the profile, not used for matching or review; a short note says so. No test, type, result or compatibility claim. Stored per applicant as question **version + stable question / option ids** (`connection_answers_v2`, RPCs only); partial answers and an empty set are valid; persisted on reopen, never read by another account, not cached on the device. Only **V2 applicants who haven't submitted yet** (draft) are asked; approved members, submitted and changes-requested applications are not; servers without the package don't show it. | ✅ APPROVED (first draft) | Owner, 2026-10-22. Package `supabase/proposed/20261022120000_v2_connection_answers.sql`, LOCAL only. |
