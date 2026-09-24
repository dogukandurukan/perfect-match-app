# Implementation status — Tempa onboarding V2

**Last updated:** 2026-09-23 (read-only audit by Claude Code; no code, schema
or live data changed). Status markers: see [README](README.md).

## 0. Key findings

1. **The existing V2 docs and migration target an older spec.**
   `docs/onboarding-v2-gap-analysis.md`, `docs/v2-schema-spec.md` and the
   unapplied `supabase/migrations/20260921100000_v2_schema_proposed.sql` were
   written against the earlier "Tempa-Onboarding-V2-Master-Spec". They
   conflict with the 2026-09-22 handoff on: Section 3 questions
   (`children_view`/`exclusivity_view`, `connection_pace` values), smoking
   (`never/occasionally/regularly/trying_to_quit`), drinking
   (`never/socially/regularly/sober`), an 8-prompt library, discovery
   preferences inside onboarding (km distance, dealbreaker strengths), and
   availability (`weekday_evenings/saturdays/...`).
   → **Do not apply that migration.** Its security architecture (5-table
   split, RPC-gated writes, state machine, private selfie) fits the new flow
   and can be kept; the field/enum layer must be rewritten.
2. **Live DB is empty** (`auth.users`, `profiles`, `onboarding_answers` = 0;
   no V2 tables). No real legacy answers to remap. Keep
   `questionnaire_version` anyway.
3. **No OTP / mock auth provider exists in the repo.** Auth is email+password
   (`app/(auth)/register.tsx` `signUp`, `login.tsx` `signInWithPassword`).
   Phone is an unverified text field (`app/profile-setup/step1/index.tsx`).

## 1. Cross-cutting infrastructure

| Item | Today | Status |
|---|---|---|
| One question per screen, progress bar, back/next | `components/ui/QuestionScreen.tsx`, one Context per step (`lib/onboardingStep{1..4}Context.tsx`) | ✅ exists (reusable) |
| Back keeps answers | in-memory per step; persisted only at end of each step via `submitAll()` | ⚠️ partial |
| Per-screen draft save + resume | only coarse `profiles.current_step` (1–4) | ❌ missing |
| Honest pending/failed save UI | not per screen | ❌ missing |
| Visual direction (ivory + dark green + serif) | onboarding is black/monochrome (`#1A1A1A`); rest of app black; Home uses coral `#B65F54` (`lib/homeTheme.ts`). No custom fonts loaded (`expo-font` installed, no font assets) | ❌ missing |
| Phone OTP | none | ❌ missing |
| Email verification | a confirm link is sent at sign-up but never checked | ❌ missing |
| Application / review / membership state machine | none in code; only in the unapplied draft | ❌ missing |
| Private selfie storage | `verification-selfies` bucket (private) live | ✅ exists |
| KVKK consent | checkbox on `register.tsx` + `profiles.privacy_consent_at` | ✅ exists, 🔴 needs a new place in the new flow |

## 2. Per-section gap

| Section | Target | What exists today | Gap |
|---|---|---|---|
| **1 Account** | Welcome → phone → SMS code | Phone field (no OTP); separate email+password register screen | Welcome screen, OTP, SMS states (resend cooldown, correction, expiry, wrong code, delivery failure), mock provider for dev. Password-based register must be retired or repurposed. |
| **2 Basics** | Name → DOB → gender → interested in → location → height | All six exist but spread across steps (height is in step3). Step1 also contains **photos, selfie, Instagram, languages**, plus a distance preference on the location screen. | Regroup into one section; move photos/selfie to S7; drop Instagram, languages and distance (D40/D41); confirm surname screen; gender and interested-in decided (D15/D15b, mutual eligibility). |
| **3 Compatibility** | 7 fixed questions (exact copy) | step2: 4 intents incl. `just_friends`, each with its own 3-question set | Entirely new. None of the 7 questions exist. |
| **4 Your Life** | Smoking, drinking, pets (+kind), activity | Combined drink/smoke chip (lossy); pets = species list; no activity; extra morning/night + recharge questions | Split smoking/drinking; pet attitude + conditional kind; add activity; drop morning/night + recharge (D40). |
| **5 Your World** | Work (+title), school, hometown, interests 3–10, artists 0–3, books/titles 0–3 | Free-text `occupation`; education *level* question; hobbies 0–5 with free text; free-text favorite music/movie/book | Work status, school, hometown, fixed 16-item interests with 3–10 limit, catalog-backed taste lists (provider open), drop education level (D40). |
| **6 Your Dates** | Date types 1–2 (+dinner vibe) ; days + time + live summary | 5 emoji-labelled meeting environments, no limit; availability days & hours multi-select on separate screens; plus neighborhoods, first-date expectation, bio screens | New option sets, limits, conditional dinner vibe, single combined screen with summary; drop neighborhoods, first-date expectation and standalone bio (D40/D41). |
| **7 Profile** | Photos ≥3 → prompts 2–3 → preview → private selfie → email → code → submit → received | Photos 1–6 (min 1, auto slot, no reorder); selfie optional in step1; no prompts, preview, email step, submit or received | Almost all new. |

## 3. Schema summary

Details in [`SCHEMA_MAPPING.md`](SCHEMA_MAPPING.md).

- **Already in live V1 `profiles`:** `first_name`, `last_name`, `date_of_birth`, `gender`, `meeting_preferences`, `city`, `district`, `lat/lng`, `height_cm`, `occupation`, `hobbies`, `phone_verified`, `photo_verified`, `privacy_consent_at`.
- **Reusable from the unapplied draft:** table split (`profile_private_v2`, `profile_account_state_v2`), `profile_photos`, `profile_prompts` (structure), `school`, `hometown`, submission/review/membership RPCs.
- **Needs new schema:** all Section 3 fields; Section 4 new enums; `work_status`, `job_title`; interest/taste storage; Section 6 fields; `questionnaire_version`, `last_completed_step`.
- **Remove from the draft:** discovery preferences in onboarding, `children_view`/`exclusivity_view`, `availability_v2`, old smoking/drinking enums, 8-prompt check list (pending D33).

## 4. Scoring summary

Details in [`SCORING.md`](SCORING.md). Live: V1 `get_top_matches` (lifestyle
bucket cap 65, normalizer 140, zodiac, liked-me/verified sort boost,
percentage + reasons). The 100-point model is 🔵 PROPOSED only; nothing of it
exists because the new answers don't exist yet → it requires a new
`get_top_matches_v2`, not a patch.

## 5. Recommended order

| # | Work package | Depends on | Status |
|---|---|---|---|
| 0 | Decision round on [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) | — | ⏳ next |
| 1 | Schema Revision 3 (file only): keep security architecture, rewrite fields/enums to this flow | 0 | not started |
| 2 | Shared components: onboarding tokens (ivory/green), serif font (scope: all onboarding, D42), OptionCard/Chip/Field, local progress; per-screen draft save + resume | 0 | 🟡 **P01 implemented for review** on branch `tempa/p01-onboarding-ui` (tokens, fonts, wordmark, header, underline field, CTA, shell + Basics name screen in a dev preview; D46 refinement applied 2026-09-24; owner phone validation pending). OptionCard/Chip, draft save + resume not yet. |
| 3 | Sections 2 → 3 → 4 → 6 (pure forms, no external dependency) | 1, 2 | 🟡 **Section 2 Basics: P02 UI preview implemented for review** on `tempa/p02-basics-ui` (six screens, in-memory draft, no persistence/backend; D47–D49 revision: height ruler + preview location suggestions; owner phone validation pending). 🟡 **Section 3 Compatibility: P03 UI preview implemented for review** on `tempa/p03-compatibility-ui` (Q1–Q7 connected after Basics, in-memory only; DEV entry on signed-out landing; P03 R1: approved simpler copy D50 + 10-value 2-column grid D51; owner phone validation pending). Sections 4, 6 not started. |
| 4 | Section 5 (free text + provenance first; catalog later) | 1, 2, D27 | not started |
| 5 | Section 7 profile part: photos, prompts, preview, selfie | 1, 2 | not started |
| 6 | Auth: phone OTP (mock provider in dev), email code on same user, submit, received, route guards | SMS provider decision | not started |
| 7 | `get_top_matches_v2` behind versioned config, handoff scenarios as tests | 3–5 | not started |

Applying any migration to the live DB requires explicit approval.

## 6. Validation checklist (from handoff, to be ticked during implementation)

- [ ] Same auth identity after email verification
- [ ] Resuming incomplete photo uploads
- [ ] No double submission (idempotent server-side submit)
- [ ] Public queries cannot read selfie / DOB / contact info
- [ ] Min/max choice limits enforced server-side
- [ ] Deselecting Dinner removes active dinner vibe
- [ ] Catalog outage never blocks optional screens
- [ ] "Received" state cannot access discovery before eligibility

## Change log

| Date | Change |
|---|---|
| 2026-09-23 | Initial gap analysis from handoff + repo/DB audit |
| 2026-09-23 | Q2 closed (D40/D41): legacy screens not carried into V2; languages & neighborhood/distance deferred to possible future Settings, no schema now |
| 2026-09-23 | D15 gender options approved (Q1 partly resolved); D42 green/ivory across all onboarding (Q3 closed) |
| 2026-09-23 | D15 revised to three single-choice gender options; D15b interested-in (multi-select, exclusive Everyone, mutual eligibility) approved; Q1 closed |
| 2026-09-23 | P01 (onboarding visual foundation + Basics name screen, dev preview only) implemented for review on `tempa/p01-onboarding-ui` — see `work-packages/P01_RESULT.md`. Not merged; no DB/auth/matching change. |
| 2026-09-24 | P01 D46 visual refinement applied on `tempa/p01-onboarding-ui` (underline fields, larger heading, keyboard-aware spacing). Owner phone validation pending. |
| 2026-09-24 | P02 connected Basics UI preview (six Section 2 screens, dev route `datingapp://dev/onboarding-v2-name`) implemented for review on `tempa/p02-basics-ui` — see `work-packages/P02_RESULT.md`. Not merged; no DB/auth/matching change. |
| 2026-09-24 | P02 D47/D48/D49 revision on `tempa/p02-basics-ui`: height ruler, City-or-district suggestions from a bundled 5-city preview catalog. Not merged; no DB/auth/matching change. |
| 2026-09-24 | P03 Compatibility UI preview (7 questions after Basics, section-labelled progress, DEV "Preview new onboarding" button on the signed-out landing) implemented for review on `tempa/p03-compatibility-ui` — see `work-packages/P03_RESULT.md`. Not merged; no DB/auth/matching change. |
| 2026-09-25 | P03 R1 on `tempa/p03-compatibility-ui`: simpler Compatibility copy (D50), ten values incl. local `respect` in a 2-column icon grid (D51), compact reserved title block. See `work-packages/P03_R1_RESULT.md`. Not merged; no backend/scoring change. |
