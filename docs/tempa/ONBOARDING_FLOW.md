# Canonical onboarding flow

> **Visual:** the green/ivory warm editorial design (D2) applies to every onboarding screen, all seven sections (D42).

> **Not in V2 onboarding (D40/D41, 2026-09-23):** Instagram, education level,
> morning/night, recharge style, standalone bio, first-date expectation,
> languages, neighborhood/distance preference. Do not add screens or fields
> for these. Languages and neighborhood/distance may be reconsidered later in
> Settings only.

Source: `Tempa_Final_Handoff_2026-09-22` (files 01 and 04). Status markers:
see [README](README.md) and [DECISIONS](DECISIONS.md). Mockup copy and sample
answers are illustrative; the copy written here governs.

36 depicted states across seven sections (3+6+7+4+6+2+8). This counts
welcome, preview, submission and confirmation — it is **not** 36 questions.

## Section 1 — Account (3 states) ✅ structure, 🟡 copy

| Screen | Copy / behavior |
|---|---|
| Welcome | "People, not profiles." / "Meet people you connect with. Make plans to meet in real life." CTA **Get started**; **Log in** for returning users. "How membership works" link explains real review/activation conditions — no invented price or review SLA. |
| Phone | "What's your phone number?" / "We'll send you a code to verify your number." / **Send code** |
| SMS code | "Enter your code" / masked number / **Verify number**. States: resend cooldown, number correction, expiry, wrong code, delivery failure. |

After verification → Section 2 name directly (🟡 D9). Returning users log in
with phone OTP only. Email is collected in Section 7.

## Section 2 — Basics (6 screens) ✅

| Screen | Fields / behavior |
|---|---|
| What's your name? | First + last name. Only first name public. Surname removal is 🔵 not approved. |
| When's your birthday? | Full DOB private; only age displayed; zodiac derived silently. |
| What's your gender? | Woman / Man / Non-binary — single choice (✅ D15). No "Prefer not to say" or self-describe. |
| Who are you interested in? | Women / Men / Non-binary people — multi-select; **Everyone** covers all and is exclusive (✅ D15b). Discovery eligibility, not similarity; mutual on both sides. |
| Where do you live? | Current city/location (≠ hometown). Manual entry; GPS optional. |
| How tall are you? | Centimeters. Profile context, zero ranking weight. |

No Instagram, school, hometown, job, age-range or distance-range here. Add
clear privacy copy for first name and DOB.

## Section 3 — Compatibility (7 screens) ✅ approved copy (P03 R1, D50/D51 — supersedes the earlier full-copy/subtitle version)

All required. Q1–Q6 single choice; Q7 choose 1–2. No preselected answers.
"1 of 7…7 of 7" is section-local progress. No option subtitles. Question IDs and
option keys are unchanged; only display copy changed.

**3.1 What are you looking for?**
- A serious relationship (`long_term`)
- Something casual (`casual`)
- Not sure yet (`figuring_out`)

**3.2 How social are you?**
- I like quiet plans
- Somewhere in between
- I love going out

**3.3 How often do you like to text?** — helper "When dating someone"
- A few messages a day
- A few times a day
- Often during the day

**3.4 How much time together feels right?** — helper "When dating someone"
- More time for myself
- A balance of both
- Lots of time together

**3.5 Is it easy to share your feelings?**
- I need time
- Once I feel comfortable
- Yes, I'm open

**3.6 When would you like to meet?**
- Soon
- After some chatting
- When I feel ready

**3.7 What matters most to you?** — helper "In a relationship. Pick 1 or 2." (min 1, max 2)

Two columns × five rows, row-major, small outline icon left of each label:

| | |
|---|---|
| Trust (`trust`, link) | Growing together (`growth`, sprout) |
| Fun (`fun`, sun) | Stability (`stability`, anchor) |
| Personal space (`independence`, feather) | Adventure (`adventure`, compass) |
| Affection (`affection`, heart) | Family (`family`, house) |
| Health (`health`, leaf) | Respect (`respect`, handshake) |

`respect` is a new local preview key only (no backend/scoring approval). Third
selection is blocked without replacing; selected values stay deselectable.
Selected card: pale sage fill + green border + fixed corner check (space always
reserved). Words never split; cards stack in one column when needed.

Rules: messaging (3.3) and time together (3.4) are separate traits. Reserved is
not inferior to expressive. Intent mismatch lowers ranking only; no hard block.

## Section 4 — Your Life (4 screens) ✅ approved copy (P04, D52/D53 — supersedes the earlier Section 4 wording)

Header section "Your Life", local progress 1 of 4 … 4 of 4. All four primary
questions required, single choice, no default. Headings are text-only, aligned
like Compatibility (heading icons removed in P04 R1, 2026-09-27); no icons on
answer cards; no emojis or illustrations. Small icons remain only on the pet-kind
chips.

1. **Do you smoke?** — No / Sometimes / Yes
2. **Do you drink alcohol?** — I don't drink / Sometimes / Regularly
3. **How do you feel about pets?** — I have pets / No pets, but I like them / I'm neutral about pets / I'd rather not live with pets
   - If **I have pets**: inline **What kind?** — Dog / Cat / Both / Other (icons before labels: dog, cat, dog + cat, paw). Single choice, **optional**: Continue needs only the primary answer; no default kind; Both = dog and cat; Other needs no free text. Changing away from "I have pets" clears and hides the kind. One row if it fits, otherwise 2 × 2.
4. **How active are you?** — helper "Physical activity" — Very active / Somewhat active / Not very active

Pet kind is context, never a penalty. No lifestyle dealbreakers, partner
restrictions or scoring derived from own habits. No diet, sleep, children, job
or dealbreaker questions here.

## Section 5 — Your World (6 screens) ✅ approved copy + typeahead behaviour (P05, D54/D55 — supersedes the earlier Section 5 wording)

Header section "Your World", local progress 1 of 6 … 6 of 6, no defaults, no
heading icons. Only interests are required; every other screen has **Add later**
(advances without deleting valid selections; uncommitted search text is dropped).

| # | Title | Helper | Content |
|---|---|---|---|
| 1 | What do you do? | — | Single choice Full-time / Part-time / Self-employed / Student / Between jobs; optional **Job title (optional)** "e.g. Designer". No employer. Partial answers can continue. |
| 2 | Where did you study? | Add your school to your profile. | Search or enter your school → pick a suggestion (school + verified city/country) **or** explicit *Use “typed name”*. No attainment question. |
| 3 | Where are you from? | Your hometown, not where you live now. | **Hometown**, "Search or enter a city" → suggestion or explicit custom entry. Separate from current location; no GPS/map/distance. |
| 4 | What are you into? | Pick 3–10 interests. | Travel, Food, Sports, Music, Art, Movies, Books, Outdoors, Tech, Gaming, Fashion, Wellness, Animals, Nightlife, Culture, Other. **Required 3–10**, "N of 10 selected", 11th refused (no replacement), deselect allowed, no Add later, Other adds no free-text question. Each chip has a small outline icon left of the label, no emojis (D56). |
| 5 | Who do you listen to? | Add up to 3 artists you love. | Search **artists only** (no songs/playlists/genres). 0–3, "N of 3 added", removable. |
| 6 | Books & movies | Add a few favorites. You can change them later. | Two independent groups: **Books · N of 3** ("Search books") and **Movies & series · N of 3** ("Search movies or series"); 0–3 each. |

**Typeahead (D55):** suggestions appear only after typing (≥ 2 trimmed
characters, ~300 ms debounce); none on an empty query; cleared with the query.
Results sit directly under the input; selected items below, visually distinct,
removable (edit = remove + reselect). Loading, no-results and error states never
block optional screens. Explicit custom entries keep the exact typed text with
custom provenance; nothing is fuzzy-merged. Duplicate source IDs and exact
normalized duplicate custom entries are rejected. Metadata/images only when
verified (artist photo; book cover + author; poster + year/type), otherwise
neutral placeholders. Live providers are not connected yet — the dev preview uses
a labelled sample catalog (see P05_RESULT.md).

## Section 6 — Your Dates (2 screens) ✅

**6.1 What sounds like a good first date?** — "Choose up to 2." (min 1)
Coffee / Drinks / Dinner / Walk / Something to do / Outdoors.
If Dinner: optional **What's your dinner vibe?** Casual & cozy / Fine dining / Either.
Deselecting Dinner removes the active dinner vibe from summary, scoring and planning.

**6.2 When do dates fit into your week?**
- Preferred days: Weekdays / Weekends / Either
- Preferred time: Daytime / Evening / Either
- One choice each, no default. Helper "Just a preference — you'll pick an exact time together."
- Live **Your kind of date** summary built only from current answers (dinner line only if Dinner + a vibe).
- CTA **Continue to your profile** → Section 7.

## Section 7 — Build your profile (8 states) 🟡 order

1. **Photos** — min 3, choose primary, batch upload, remove/reorder. Encourage clear face (auto-enforcement 🔴 open).
2. **Prompts** — two answers required, third optional (✅ D33). Initially show "I'm most myself when…" and "Something I could talk about for hours…". Users can change either prompt from the library; "A perfect first date looks like…" is an alternative, not a default. Helper: "Short answers are welcome." Never autofill answers. Remaining library entries/key mapping are still open (Q6).
3. **Preview** — real assembled profile; edit and return without restarting. Apply D44's alternating layout: primary photo + first name/age → short profile facts (shared interests only where applicable) → prompt 1 + answer → photo 2 → prompt 2 + answer → photo 3 → optional prompt 3 and remaining photos. Photos and answers are collected separately; no photo-to-prompt assignment is required. This decides content order, not the wider app's color scheme.
4. **Private selfie** — "Verify it's you." / "A private selfie, reviewed by our team." / "Not shown on your profile." Manual review.
5. **Email** — "Where can we reach you?" / "We'll email you about your application." / **Send code**
6. **Email code** — "Check your email" / **Verify email**; resend/correction/error; attach to the same phone-auth user.
7. **Submit** — checklist (profile complete, selfie added, email verified); explain manual review and membership activation; **Submit application**; idempotent server-side.
8. **Received** — "Application received" / "Your profile is under review" / "We'll email you when there's an update." View status and own profile. No discovery access.

## State chain

onboarding complete → application submitted → under review → accepted →
membership activation → discovery eligible.
Application, verification and membership are separate state machines;
server controls privileged transitions. Rejection/resubmission policy 🔴 open.
