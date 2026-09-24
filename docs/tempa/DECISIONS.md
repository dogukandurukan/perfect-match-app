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
| D17 | Seven required questions in fixed order with exact copy in `ONBOARDING_FLOW.md` §3 | ✅ APPROVED | HO 04, 05 |
| D18 | Messaging frequency and personal space are separate questions and must not be double-weighted | ✅ APPROVED | HO 04 |
| D19 | Values: choose 1–2 of nine | ✅ APPROVED | HO 04 |
| D20 | Intent keys `long_term` / `casual` / `figuring_out` | ✅ APPROVED | HO 04 + earlier session (`figuring_out` spelling authoritative) |
| D21 | No love languages, conflict style, politics or children questions | ✅ APPROVED | HO 01 §6 |

## Section 4 — Your Life

| # | Topic | Status | Source / note |
|---|---|---|---|
| D22 | Four questions: smoking, drinking, pets (+ in-context kind), physical activity — copy in `ONBOARDING_FLOW.md` §4 | ✅ APPROVED | HO 05 |
| D23 | Own habits do not create partner dealbreakers; no new lifestyle hard exclusions | ✅ APPROVED | HO 01 §7 |

## Section 5 — Your World

| # | Topic | Status | Source / note |
|---|---|---|---|
| D24 | Work, school, hometown optional ("Add later"); interests required 3–10; artists 0–3; books 0–3 and movies/series 0–3 optional | ✅ APPROVED | HO 05 |
| D25 | Interest taxonomy (16 items incl. Other) | ✅ APPROVED (as board/spec) | HO 01 §8 |
| D26 | Music = artists only (no genres/playlists) for MVP; no standalone zodiac screen | ✅ APPROVED | HO 01 §8 |
| D27 | Catalog provider for artists/books/titles | 🔴 OPEN | no paid integration assumed |

## Section 6 — Your Dates

| # | Topic | Status | Source / note |
|---|---|---|---|
| D28 | Two screens: date types (1–2 of six, conditional dinner vibe) and days + time + live summary | ✅ APPROVED | HO 05 |
| D29 | Dinner vibe is for venue suggestions only; zero score; removed if Dinner deselected | ✅ APPROVED | HO 01 §9 |

## Section 7 — Build your profile

| # | Topic | Status | Source / note |
|---|---|---|---|
| D30 | Order: photos (≥3) → prompts (2, 3rd optional) → preview → private selfie → email → email code → submit → received | 🟡 ACCEPTED (inferred) | HO 05 "working direction requested and retained" |
| D31 | Selfie is private and manually reviewed; uploading ≠ verified | ✅ APPROVED | HO 01 §10, consistent with earlier product decisions |
| D32 | "Received" state does not grant discovery; no "You're all set" / 24-hour promise | 🟡 ACCEPTED (inferred) | HO 01 §10 |
| D33 | Start with two suggested prompts: **"I'm most myself when…"** and **"Something I could talk about for hours…"**. Users can change either prompt from a library. **Two answers required, third optional**; helper: "Short answers are welcome." **"A perfect first date looks like…"** remains a selectable alternative, not a default. Never autofill answers. | ✅ APPROVED | Doğukan, 2026-09-23. Supersedes the previous suggested pair. Resolves Q6's default/swap behavior; remaining library entries and storage-key mapping are not approved by this decision. |
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
