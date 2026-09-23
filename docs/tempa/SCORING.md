# Scoring — live today vs. proposed

## 1. Live today (V1, unchanged)

`public.get_top_matches(p_user_id, p_limit)` in Supabase (not in git).
Components: same-city eligibility, age curve (≤-5 for 7+ years, 85% display
cap when negative), V1 intent match, lifestyle bucket (morning/night,
recharge, hobbies, availability, drinking, smoking, education, languages,
meeting environment, zodiac, favorite spot) capped at 65, normalizer 140,
completeness multiplier, liked-me and verified as sort-only boosts,
percentage + category + up to 3 reasons returned to the client.

None of the new Section 3–6 answers exist, so **no part of the proposed model
is implemented**. It requires a new `get_top_matches_v2`, not a patch.
Live DB is empty, so no real-data calibration is possible yet.

## 2. Proposed model — 🔵 PROPOSED, not validated

Direction ✅ APPROVED: broad candidate pool, strong priority for aligned
intent, no silent hard intent filter. **Every number below is proposed.**
Supersedes the old Core 40 / Lifestyle 25 / World 10 / Age 10 / Proximity 10 / Date Fit 5 draft.

Pipeline: eligibility (reciprocal discovery, account/application/membership
state, blocks, strict filters) → internal ranking points → truthful
explanations → Date Fit / dinner vibe for planning only.

| Section | Signal | Max |
|---|---|---:|
| 1 Account | verification | 0 |
| 2 Basics | age gap | 10 |
| 2 Basics | proximity | 10 |
| 2 Basics | name, gender/interested-in (eligibility), height | 0 |
| 3 Compatibility | intent | 30 |
| 3 | social energy | 2 |
| 3 | messaging frequency | 4 |
| 3 | personal space | 4 |
| 3 | emotional expression | 0 |
| 3 | meeting pace | 4 |
| 3 | values | 1 |
| 4 Your Life | smoking | 6 |
| 4 | drinking | 4 |
| 4 | pet attitude | 6 |
| 4 | activity | 4 |
| 4 | pet kind | 0 |
| 5 Your World | shared interests | 7 |
| 5 | artists / books / movies-series | 1 each |
| 5 | job, school, hometown, zodiac | 0 |
| 6 Your Dates | date types | 2.5 |
| 6 | days / time | 1.25 each |
| 6 | dinner vibe | 0 |
| 7 Profile | tasks | 0 |
| **Total** | | **100** |

### Intent matrix (30)

| Pair | Points |
|---|---:|
| long_term + long_term | 30 |
| casual + casual | 30 |
| figuring_out + figuring_out | 20 |
| long_term + figuring_out | 15 |
| casual + figuring_out | 15 |
| long_term + casual | 0 |

### Per-question conversion (proposed)

- **Age (10):** 0–1y 10 · 2y 9.5 · 3–4y 8.5 · 5y 7 · 6y 6 · 7–8y 4.5 · 9+ 3.
- **Proximity (10):** bands not agreed; city-only → neutral 5, low confidence.
- **Social energy (2):** same 2 · adjacent 1.5 · extremes 1.
- **Messaging (4):** same 4 · adjacent 3 · extremes 2.
- **Space (4):** same 4 · adjacent 3.2 · extremes 2.2 (messaging + space cap 8).
- **Emotional expression:** 0 until a reasoned model exists.
- **Meeting pace (4):** same 4 · adjacent 3 · extremes 1.8.
- **Values (1):** two shared 1 · one shared 0.7 · none 0.4 (actual overlap, not divided by 2).
- **Smoking (6):** same 6 · adjacent 4.2 · opposite 1.8.
- **Drinking (4):** same 4 · adjacent 2.8 · opposite 1.4.
- **Pet attitude (6):** owner/owner 6 · owner/likes 5.1 · owner/neutral 3.6 · owner/rather-not 1.8 · neutral/neutral 5.4; other cells from the provisional 0–100 matrix × 0.06 (matrix still to be written down).
- **Activity (4):** same 4 · adjacent 3 · extremes 2.
- **Interests (7):** 0→0 · 1→2 · 2→4 · 3→5.5 · 4→6.5 · 5+→7 (compare a normalized-overlap variant).
- **Artists/books/titles (1 each):** ≥1 exact shared catalog id → 1, else 0; missing = unknown, never mismatch.
- **Date types (2.5):** ≥1 shared explicit type → 2.5, else 0 (Walk ≠ Outdoors).
- **Days, time (1.25 each):** same or either picked Either → 1.25; opposing → 0.5.

## 3. Display rules (proposed)

- No "85% chance of compatibility" from an internal rank. Percentage UI is a separate 🔴 open decision; qualitative explanation 🔵 proposed.
- Explanations come from real shared facts and conflicts; an intent difference must not be hidden behind a shared hobby.
- Store `score_version`, `questionnaire_version`, per-question breakdown, answer coverage.

## 4. Validation scenarios (to become SQL tests)

Matched goals · long_term/casual with many hobbies · figuring_out mixed ·
severe pet/smoking difference · age/distance tradeoff · opposite day/time ·
optional taste skipped · gender/interested-in ineligible pair.
Handoff sandbox: `scoring_sandbox.py`, `scoring_scenarios.csv`
(example: other=55 → 85 / 75 / 70 / 55 by intent pair).
