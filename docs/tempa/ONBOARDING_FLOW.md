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
| 4 | What are you into? | Pick a few things you enjoy. | Travel, Food, Sports, Music, Art, Movies, Books, Outdoors, Tech, Gaming, Fashion, Wellness, Animals, Nightlife, Culture, Other. **Required 1–10** (P07 R1, D59), "N of 10 selected", 11th refused (no replacement), deselect allowed, no Add later, Other adds no free-text question. Each chip has a small outline icon left of the label, no emojis (D56). |
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

## Section 6 — Your Dates (2 screens) ✅ approved copy (P06, D57 — supersedes the earlier Section 6 wording and the dinner-vibe follow-up)

Header section "Your Dates", local progress 1 of 2 / 2 of 2, no defaults (mockup
example selections are not defaults), text-only headings.

**6.1 Your ideal first date?** — helper "Pick 1 or 2." (required, min 1, max 2)

Two columns × three rows, row-major, small outline icon in each card:

| | |
|---|---|
| Coffee (`coffee`, cup) | Drinks (`drinks`, wine glass) |
| Dinner (`dinner`, cutlery) | A fun activity (`activity`, ticket) |
| A walk (`walk`, footsteps) | Outdoors (`outdoors`, mountain) |

"N of 2 selected"; a third selection is refused (never replaces); deselect
allowed. Selected card: pale sage fill + green outline + corner check that does
not move the label. One column at large text sizes.

Always below the cards (for everyone, whatever types are chosen — Coffee +
Dinner still gives one field): **Have a favorite spot?** / "For a first date.
Optional." — one optional free-text field, placeholder "Enter a place name".
Empty or whitespace-only = no venue. The typed spelling/case is kept; it is
custom, unverified text (no place ID, coordinates or address) and never
satisfies the date-type requirement. **No dinner follow-up** (Casual & cozy /
Fine dining / Either removed). No venue search yet.

**6.2 When are you free?** — helper "For a first date."
- **Days**: Weekdays / Weekends / Either — single choice, three full-width rows.
- **Time**: Daytime / Evening / Either — single choice, one row when it fits, otherwise stacked.
- Both required, no default; each Either covers its own group only.
- Live summary once both are chosen, e.g. "Weekends · Daytime" ("Either" reads "Any day" / "Any time"), with "Choose the exact time together."
- General preferences only — not availability, exact dates or a reservation.
- CTA **Continue to your profile** → Section 7.

## Section 7 — Your Profile (7 states) ✅ approved copy + order (P07 D58, revised by P07 R1 D59; D30)

Header section "Your Profile", local progress 1 of 7 … 7 of 7 (photo/prompt
editors and pickers are not extra states). Mockup people, answers and email are
illustrative only — never seeded into a draft.

1. **Add your photos** — "Add at least 3 photos." Six fixed slots, **3 columns × 2 rows** on a standard phone (2 columns on narrow screens / large text); **3 required, 6 max**; first slot = **Main photo**; counter "N of 6 photos". Tap an empty slot to add (batch pick within the free capacity, one picker at a time); tap a photo for a large preview with **Replace / Remove / Make main / Move earlier / Move later**; **hold and drag** to reorder (VoiceOver actions as the accessible alternative). No automatic "top photo" reordering. Duplicates are skipped only by a non-null library asset id. A photo that fails to load shows an error with Try again / Replace / Remove and never counts (P07 R2, D60).
2. **A little more you** — "Pick 2 prompts. Add a third if you like." Three cards, all starting as **Choose a prompt** (two required, one optional); no preselected prompts. Choosing happens in a wide picker with categories **All / About me / Just for fun / You & me / My everyday** (20 local prompts, `lib/onboardingV2/promptCatalog.ts`); a prompt already used is disabled. Writing happens in a separate editor: prompt title, **Change**, "Türkçesi" (Turkish meaning), "Türkçe veya İngilizce yazabilirsin.", 200-character counter, placeholder examples in **EN / TR** with **Show another example**. Answers are stored exactly as typed (no translation / ASCII folding); examples are never stored, never count and never appear on the profile. Changing the prompt of a written answer asks keep or start fresh; cancelling edits asks before discarding. Filled cards show the prompt, an answer preview and **Edit**; the optional third can be removed (P07 R2, D60 — supersedes D59's prompt part).
3. **Your profile** — "This is how others will see you." One scrolling profile from the real drafts (the mockup's "top / continued" boards are two views of this one page): **first name, age** above the main photo → about (city, height, zodiac from DOB, job/work, school, hometown) → prompt 1 → photo 2 → looking for · values · interests → prompt 2 → photo 3 → lifestyle (smoking, drinking, pets, activity) → prompt 3 → photo 4 → first dates (types, days · time, favorite spot) → photo 5 → favorites (artists, books, movies & series) → photo 6. All photos share one 4:5 frame. Empty optional fields and empty groups are hidden. Never surname, exact DOB, phone, email, selfie, scoring or a verification badge; no invented images (artist placeholder when no provider image). No note/send controls on your own preview (contextual notes are a future visitor-profile feature, D45). **Edit profile** (photos, answers, and each earlier section) with **Back to preview**; **Continue** re-checks photos/answers.
4. **A quick selfie** — "Help us check it's really you." Front camera only (no gallery), oval frame, **Retake** / **Use selfie**. "Your selfie stays private." / "We'll review it with your profile photos." Never on the public profile; manual review (D31); no face recognition or liveness claims.
5. **Your email** — "We'll send you a code." Label "Email", private, "Your email stays private." **Send code**.
6. **Check your email** — code sent to the shown email; six-digit code (paste/autofill); **Verify email**; **Resend code** (cooldown) / **Change email** (clears the code and any check). After a correct code the same screen shows **Email confirmed** and the CTA becomes **Submit application** — verifying never submits by itself. Submit re-checks everything and, if something is missing, takes the user to that step. The separate "Ready to submit?" checklist state was **removed** (D59). Attaches to the same phone-auth user (D8).
7. **You're on the list!** — "Thanks for joining Tempa." / "We'll email you after we review your profile." Status "Application received" / "Review pending". Small celebration mark and one short confetti burst (skipped with Reduce Motion). **Review my profile** (own profile, back to status). Received ≠ accepted, verified or member; no discovery access (D32).

DEV preview (P07/R1) boundaries: photos and selfie are local device URIs in
memory; email sending, code check and submission are **simulated** and
labelled on screen. No upload, email, auth, application record, verification
or membership.

## State chain

onboarding complete → application submitted → under review → accepted →
membership activation → discovery eligible.
Application, verification and membership are separate state machines;
server controls privileged transitions. Rejection/resubmission policy 🔴 open.
