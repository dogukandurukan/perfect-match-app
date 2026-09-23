# Schema mapping — logical field → current DB → proposed destination

Audit date 2026-09-23. "Live" = columns present in the live DB today (tables
empty). "Draft" = unapplied `supabase/migrations/20260921100000_v2_schema_proposed.sql`
(Revision 2). **All proposed names and enums below are 🔵 PROPOSED** until
Schema Revision 3 is approved. Nothing here is applied.

Legend for Gap: **OK** usable as-is · **REVISE** exists but wrong values/place ·
**NEW** needs schema · **DROP-FROM-DRAFT** remove from the draft.

## Account / auth

| Logical | Live today | Proposed destination | Privacy | Gap |
|---|---|---|---|---|
| phone_verified | `profiles.phone_verified` (never written) | Supabase Auth `phone_confirmed_at` (source of truth) | private | NEW flow |
| email_verified | — | Supabase Auth `email_confirmed_at` on the same user | private | NEW flow |
| privacy consent | `profiles.privacy_consent_at` | keep | private | OK (placement 🔴) |

## Section 2 — Basics

| Logical | Live today | Proposed | Rule | Privacy | Gap |
|---|---|---|---|---|---|
| first_name | `profiles.first_name` | keep | required | public | OK |
| last_name | `profiles.last_name` | keep, move off public read path | required (D12) | private | REVISE (privacy) |
| dob | `profiles.date_of_birth` | `profile_private_v2.date_of_birth` (draft) | required, 18+ | private; age derived | OK in draft |
| gender | `profiles.gender` (Man/Woman/Non-binary) | `profiles.gender_v2` (draft: woman/man/non_binary/self_describe) | required | public | REVISE (🔴 taxonomy) |
| interested_in | `profiles.meeting_preferences` (Men/Women/Non-binary/Everyone) | `discovery_preferences_v2.interested_in_v2` (draft) | required | private | REVISE (🔴 taxonomy) |
| current_location | `profiles.city`, `district`, `lat/lng` | keep | required | city/district public, coords private | OK |
| height_cm | `profiles.height_cm` | keep | required (D12) | public | OK |

## Section 3 — Compatibility (all NEW; draft's `onboarding_answers_v2` must be rewritten)

| Logical | Proposed column (🔵) | Proposed values (🔵) | Rule | Gap |
|---|---|---|---|---|
| intent | `intent` | `long_term`, `casual`, `figuring_out` (✅) | required | OK in draft |
| social_energy | `social_energy` | `low_key`, `mix`, `social` | required | NEW |
| message_frequency | `message_frequency` | `little_each_day`, `few_checkins`, `often` | required | NEW |
| relationship_space | `relationship_space` | `plenty_of_space`, `balance`, `lots_together` | required | NEW |
| emotional_expression | `emotional_expression` | `reserved`, `warm_when_comfortable`, `open` | required | NEW |
| meeting_pace | `meeting_pace` | `quickly`, `after_chatting`, `take_my_time` | required | NEW |
| values | `values text[]` | trust, growth, fun, stability, independence, adventure, affection, family, health | 1–2, no duplicates | NEW |
| — | `connection_pace`, `communication_style`, `closeness_preference`, `children_view`, `exclusivity_view` | — | — | DROP-FROM-DRAFT |

## Section 4 — Your Life

| Logical | Live today | Proposed (🔵) | Rule | Gap |
|---|---|---|---|---|
| smoking | `profiles.smoking` (Yes/No/Socially, lossy) | `smoking_v2`: `no`, `occasionally`, `yes` | required | REVISE (draft enum wrong) |
| drinking | `profiles.drinking` (Yes/No/Socially) | `drinking_v2`: `none`, `occasionally`, `regularly` | required | REVISE (draft enum wrong) |
| pet_attitude | — (`profiles.pets` = species) | `pet_attitude`: `have_pets`, `like_no_pets`, `neutral`, `rather_not` | required | NEW |
| pet_kind | `profiles.pets` | `pet_kind`: `dog`, `cat`, `both`, `other` | only if `have_pets` | REVISE |
| activity_level | — | `activity_level`: `very`, `moderate`, `not_very` | required | REVISE (draft labels wrong) |

## Section 5 — Your World

| Logical | Live today | Proposed (🔵) | Rule | Gap |
|---|---|---|---|---|
| work_status | — | `work_status`: `full_time`, `part_time`, `self_employed`, `student`, `between_roles` | optional | NEW |
| job_title | `profiles.occupation` (free text) | keep `occupation` as job title | optional | OK |
| school | `profiles.education` (level) | `profiles.school` (draft) | optional | OK in draft |
| hometown | — | `profiles.hometown` (draft) | optional | OK in draft |
| interest_ids | `profiles.hobbies` (0–5, free text) | `interests text[]` over fixed 16 keys | 3–10 | NEW |
| artist_ids | `profiles.favorite_music` (free text) | `profile_taste_items` (user_id, kind, catalog_id, display_name, source) | 0–3 per kind | NEW (🔴 D27 catalog) |
| book_ids | `profiles.favorite_book` | same table, kind=`book` | 0–3 | NEW |
| screen_title_ids | `profiles.favorite_movie` | same table, kind=`screen` | 0–3 | NEW |

## Section 6 — Your Dates

| Logical | Live today | Proposed (🔵) | Rule | Gap |
|---|---|---|---|---|
| date_types | `profiles.meeting_environment` (5 emoji labels) | `date_types text[]`: coffee, drinks, dinner, walk, activity, outdoors | 1–2 | NEW (draft `meeting_environment_v2` wrong) |
| dinner_style | — | `dinner_style`: `casual_cozy`, `fine_dining`, `either` | optional, only if dinner ∈ date_types (else NULL, enforced) | NEW |
| days_pref | `profiles.availability_days` | `days_pref`: `weekdays`, `weekends`, `either` | required | NEW |
| time_pref | `profiles.availability_hours` | `time_pref`: `daytime`, `evening`, `either` | required | NEW |
| — | draft `availability_v2` | — | — | DROP-FROM-DRAFT |

## Section 7 — Profile

| Logical | Live today | Proposed | Rule | Privacy | Gap |
|---|---|---|---|---|---|
| photos / primary | `profiles.photos text[]` | `profile_photos` (draft) | ≥3 at submit, one primary | public | OK in draft |
| prompt_answers | — | `profile_prompts` (draft) | 2–3 | public | REVISE prompt-key list (D33) |
| private_selfie | `verification-selfies` bucket + `profiles.verification_selfie_path` | `profile_account_state_v2.verification_*` (draft) | required at submit | private | OK in draft |
| application/membership state | — | `profile_account_state_v2` + review RPCs (draft) | server-only transitions | private | OK in draft |

## Metadata

| Logical | Proposed | Gap |
|---|---|---|
| questionnaire_version | `profile_account_state_v2.questionnaire_version` | NEW |
| last_completed_step | `profile_account_state_v2.last_completed_step` (section + screen key) | NEW |
| draft_status | draft `onboarding_status` (draft/in_progress/submitted) | OK in draft |

## Also DROP-FROM-DRAFT (not in the new onboarding)

`discovery_preferences_v2` fields `distance_pref`, `smoking_strength`,
`drinking_strength`, `pets_tolerance`, `age_min/max`, `height_min/max_cm`
as **onboarding** inputs. The table can stay for later Filters/eligibility;
the submission RPC must no longer require them.
