# V2 fields → scoring, and current filter bugs (review only)

2026-09-30 · Branch `tempa/v2-persist` · Author: Claude Code.

Evidence: the live `get_top_matches` body (read-only snapshot
`supabase/proposed/tests/live_snapshot_2026-09-29.json`) and the V2 code keys
(`lib/onboardingV2/*`). **No weights were invented or changed; nothing was
applied.** Weight and hard-filter decisions stay with the owner (`SCORING.md`, 🔵).

## 1. Do V2 answers reach scoring today? — No

`get_top_matches` reads only V1 columns of `profiles` plus
`onboarding_answers.intent`. V2 answers live in `onboarding_v2`, a new
owner-only table. So **no V2 answer affects ranking or eligibility yet**.

It is worse than "no effect": V2 users would not even be *eligible*.
- The candidate filter requires `profiles.setup_completed = true`, and the mutual-gender check compares V1 labels (`'Women'`/`'Woman'`).
- A V2 member has lowercase V2 keys (`women`/`woman`) in `onboarding_v2` and nothing in `profiles.gender` / `meeting_preferences`.
- Either a projection into `profiles` or a `get_top_matches_v2` (WP4) is required before V2 members can be discovered. Until then, an activated V2 member reaches Home but sees and is seen by nobody.

## 2. Component-by-component mapping (existing V1 components only)

| V1 scoring component (live) | V1 input | V2 field | Mapping status |
|---|---|---|---|
| location_score (+20 same district / +8 same city) | `profiles.district`, `city` | `location_district`, `location_city` | **Direct** (same meaning). District stays server-side only (P0) |
| age_score | `date_of_birth` | `date_of_birth` | **Direct** |
| zodiac (+5 / +2) | `zodiac_sign` | derived from DOB | **Direct** (compute, don't store) |
| intent_score (40 / 20 / 10 / 5 / 0) | `onboarding_answers.intent` ∈ keeping_it_casual, open_to_relationship, just_friends, not_sure_yet | `intent` ∈ long_term, casual, figuring_out | **Key sets differ.** "Same intent → 40" carries over as a rule. The partial-credit rules reference V1-only values (`just_friends`, `open_to_relationship`), so how `figuring_out` pairs with the other two needs **owner decision** (not inferred) |
| hobby overlap | `hobbies` (V1 labels, e.g. "Music") | `interests` (16 lowercase keys) | Same concept, **different vocabulary**. Works only within one vocabulary; a V1↔V2 comparison needs an explicit label map |
| availability overlap | `availability_days` (weekday names) | `days_pref` (weekdays / weekends / either) + `time_pref` | **Different granularity.** No faithful mapping without a rule (decision) |
| drinking / smoking equality | V1 `No / Socially / Yes` | V2 `none / sometimes / regularly`, `no / sometimes / yes` | **Different keys.** Equality works within V2; cross-version needs a map |
| meeting environment overlap | `meeting_environment` (emoji labels) | `date_types` (coffee, drinks, dinner, activity, walk, outdoors) | Same concept, **different keys** |
| favorite spot equality (+5) | `favorite_spots` (per environment) | `favorite_spot` (one free text) | Partial: one field vs several |
| morning_night, recharge, education, languages | V1 columns | **not collected in V2** (D40/D41) | Component contributes 0; the completeness multiplier (`applicable_fields`) must treat "not asked" as not applicable, **not** as missing, or V2 users are penalised |
| — | — | social_energy, message_frequency, relationship_space, emotional_expression, meeting_pace, core_values, activity, pets attitude, work_status, taste items | **No component exists.** Any weight is a new decision (`SCORING.md` 🔵) |

## 3. Current filter bugs in `get_top_matches` (live, V1)

| # | Bug | Effect | Fix direction (needs approval) |
|---|---|---|---|
| F1 | `discovery_age_min/max` are **not applied** at all (neither the viewer's range nor the candidate's) | Users see people outside the age range they set, and appear to people who excluded their age | Apply both ranges, mutually |
| F2 | `discovery_nonsmokers_only` excludes only `smoking = 'Yes'` | A "Socially" smoker passes a non-smokers-only filter. With V2 keys (`yes`/`sometimes`) it would exclude **nobody** (case-sensitive `'Yes'`) | Define which values count as smoking; use V2 keys |
| F3 | `discovery_religion` is still applied | Religion collection was removed for KVKK; a stale stored filter can still exclude people by a frozen special-category field | Remove the condition (data stays frozen) |
| F4 | `discovery_education` filters on `education` (a level) | V2 no longer collects a level (D40), so the filter silently passes every V2 user | Retire it or map to a V2 field (decision) |
| F5 | `discovery_pets` compares V1 species (`profiles.pets`) | V2 stores an attitude (`have_pets` / `like_no_pets` / `neutral` / `rather_not`) + kind; the filter would be meaningless for V2 | Redefine on V2 fields (decision) |
| F6 | Cooldown windows use `matches.created_at` | "Passed 42 days ago" counts from candidate creation, not from the pass | Record the pass time |
| F7 | Discover passes are not persisted (V1 client-only) | A passed person can come back immediately | Persist passes |
| F8 | Mutual gender eligibility is V1-label based | V2 members never qualify (see §1) | WP4 |
| F9 | `same_district` / `same_neighborhood` | **Handled in P0** (normalised to whole city) | — |

None of these are fixed on this branch. F1, F3 and F2 are independent of V2 weights and could be a small separate proposal.
