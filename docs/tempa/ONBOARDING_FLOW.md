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

## Section 3 — Compatibility (7 screens) ✅ exact copy

All required. Q1–Q6 single choice; Q7 choose 1–2. No preselected answers.
"1/7…7/7" is section-local progress.

**3.1 What are you looking for?**
- A long-term relationship — Something meaningful
- Something casual — Keeping things light
- Figuring it out — I'm open to seeing where it goes

**3.2 What's your social life like?**
- Mostly low-key — I like quiet plans and small groups
- A mix of both — It depends on the day
- Pretty social — I like going out and meeting people

**3.3 When you're dating someone, how often do you like to message?**
- A little each day — A few messages are enough
- A few check-ins — I like checking in throughout the day
- Often throughout the day — I enjoy an ongoing conversation

**3.4 How much space do you like in a relationship?**
- Plenty of space — I value my independence
- A balance of both — Time together and time apart
- Lots of time together — I like feeling close and connected

**3.5 How open are you with your feelings?**
- More reserved — I take time to open up
- Warm once I'm comfortable — I open up as we get closer
- Pretty open — I like showing how I feel

**3.6 How soon would you like to meet a match?**
- Pretty quickly — I'd rather meet than text for days
- After a little chatting — I like getting a feel for someone first
- I take my time — I like feeling comfortable first

**3.7 In a relationship, I value…** — helper "Choose up to 2." (min 1, max 2)

| | | |
|---|---|---|
| Trust | Growth | Fun |
| Stability | Independence | Adventure |
| Affection | Family | Health |

Rules: messaging (3.3) and space (3.4) are separate traits. Reserved is not
inferior to expressive. Intent mismatch lowers ranking only; no hard block.

## Section 4 — Your Life (4 screens) ✅

1. **Do you smoke?** No / Occasionally / Yes
2. **Do you drink alcohol?** I don't drink / Occasionally / Regularly
3. **How do pets fit into your life?** I have pets / I don't have pets, but I like them / I'm neutral about pets / I'd rather not live with pets
   - If "I have pets": in-context **What kind?** Dog / Cat / Both / Other (not a new screen; Both = dog and cat)
4. **How physically active are you?** Very active / Moderately active / Not very active

Single choice each. Pet kind is context, never a penalty. No lifestyle
dealbreakers derived from own habits.

## Section 5 — Your World (6 screens) ✅

| Screen | Rules |
|---|---|
| What do you do? | Full-time / Part-time / Self-employed / Student / Currently between roles; optional job title; no employer. Whole screen "Add later". |
| Where did you study? | Search/select or enter school. Helper "Add your school to your profile." "Add later". No attainment question. |
| Where are you from? | Hometown. Helper "Your hometown, not where you live now." "Add later". |
| What are you into? | **Required 3–10.** Helper "Choose 3–10 interests." Live count, block over-limit. Travel, Food, Sports, Music, Art, Movies, Books, Outdoors, Tech, Gaming, Fashion, Wellness, Animals, Nightlife, Culture, Other. |
| Your taste in music | Optional 0–3 **artists**. "Add up to 3 artists you love." No genres/playlists. |
| Books & movies | Optional, independent: books 0–3; movies/series 0–3. "Add a few favorites — you can always change them." |

Search errors / no results never block. Stable catalog IDs where available,
provenance for custom entries, no fuzzy merging. Edit/remove on selections.
Job/school/hometown carry zero score.

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
