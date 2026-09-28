# V2 backend & scoring audit (P07 R1)

Date 2026-09-28 · Branch `tempa/p07-r1-profile-fixes` · Author: Claude Code.
**Analysis only.** No migration, data change, scoring activation, deploy or
merge was performed. Everything under "Proposal" is a **🔵 PROPOSAL**, not an
approved decision.

## 0. Evidence and how it was gathered

| Tag | Source | Trust |
|---|---|---|
| **[live]** | Read-only `execute_sql` / `list_migrations` against project `fyqwjduzpnjuxqsloxih` on 2026-09-28: schema, `pg_get_functiondef`, `pg_policies`, column privileges, row **counts** only (no personal data read or printed) | Current live state |
| **[mig]** | `supabase/migrations/*.sql` on this branch (63 files; `list_migrations` also returns 63 → history is in sync today, unlike the older CLAUDE.md note) | What was applied, as written |
| **[code]** | App code on this branch (`app/`, `lib/`, `components/`) | Current client behaviour |
| **[draft]** | **Uncommitted** files in `~/dating-app-recovered` (main checkout, not on any branch): `docs/v2-schema-spec.md` (Revision 2), `supabase/migrations/20260921100000_v2_schema_proposed.sql`, `docs/matching-engine-v2.md`, `docs/onboarding-v2-gap-analysis.md`, `AGENTS.md` | Design intent, **not applied, not versioned** |
| **[doc]** | `docs/tempa/*.md` on this branch | Approved product decisions (D-numbers) |

Where a doc says one thing and live code another, both are shown.

## 1. Current state — facts

### 1.1 Database [live]
- Public tables: `blocks, events, likes, matches, messages, notifications, onboarding_answers, profiles, reports, venues`. **No V2 table exists** (`profile_account_state_v2`, `profile_private_v2`, `onboarding_answers_v2`, `discovery_preferences_v2`, `profile_photos`, `profile_prompts` are only in [draft]).
- Row counts: `auth.users` 2, `profiles` 2, every other table 0, `storage.objects` 0. Both accounts are email+password, `email_confirmed`, **no phone**, `setup_completed=false`, `current_step=1`. (The 2026-09-21 clean start removed the earlier seed; the 2026-09-23 audit's "all empty" is now "2 test accounts".)
- Buckets: `user-photos` (public), `profile-photos` (public, **no policies**, looks unused), `verification-selfies` (private).
- Functions: `get_top_matches` (SQL, SECURITY DEFINER, `auth.uid() = p_user_id` guard inside `me`), `try_send_invite`, `increment_daily_views`, `get_daily_views_state`, `get_my_likers`, `handle_mutual_like`, `handle_match_notification`, `auto_hide_after_reports`, `pair_is_blocked`, `upsert_match` (SECURITY INVOKER, EXECUTE also granted to `anon` — RLS still requires `auth.uid()` to be a party, so low risk), legacy triggers `handle_mutual_accept` / `update_match_status` (no-ops on today's flow).

### 1.2 Auth, gating and why V2 is DEV-only [code][live]
- **Sign-up/in = email + password only** (`app/(auth)/register.tsx` `signUp` + `signInWithPassword`, `login.tsx`). There is **no phone OTP** anywhere; `phone_number` is a self-typed profile column (V1 step1). V2's phone-first entry (D8) is not implemented.
- **Routing after login:** `app/(tabs)/index.tsx` `refreshProfileState()` → `lib/profileCompletion.ts` `getProfileSetupState()` reads `profiles.setup_completed` / `current_step` / `first_name` and `router.replace`s to `/profile-setup/step1…4` (V1 onboarding). `setup_completed=true` → Home. **There is no waiting/"under review" screen and no application state at all.**
- **The gate is client-writable:** `setup_completed` and `current_step` are in the `authenticated` column UPDATE grant (`20260920090000_lockdown_profiles_column_grants.sql`; [live] `has_column_privilege` = true). A user can mark themselves complete. Fine for V1-alpha, **not acceptable as the V2 access gate**.
- `app/_layout.tsx` `LocationBridge` writes location, `last_active_at` and the push token on every signed-in start (a known P05 limitation — it would also fire for a V2 draft user).
- **V2 is DEV-only because:** (1) nothing persists — every V2 draft lives in `PreviewFlow` React state; (2) no V2 schema exists live; (3) the post-login gate still routes to V1 `profile-setup`; (4) the route `app/dev/onboarding-v2-name.tsx` returns `<Redirect href="/" />` when `__DEV__` is false and its entry button is stripped from production bundles (verified by `expo export` in P02–P07 R1); (5) email code, selfie review and submission are simulated.

### 1.3 RLS / storage / privacy [live][mig]
| Area | Finding | Severity |
|---|---|---|
| `profiles` SELECT | `profiles_select_authenticated`: any signed-in user can read **every column** of any non-hidden, non-deleted profile. Column privileges confirm `authenticated` can SELECT `last_name, date_of_birth, phone_number, full_address, lat, lng, verification_selfie_path, expo_push_token, instagram_handle`. The app only shows safe fields, but the REST API exposes the rest. | **P0 before any real user** |
| `profiles` UPDATE | Column-level grant (good, 20260920090000). Still writable by the user: `setup_completed`, `current_step`, `is_hidden`, `verification_selfie_path`. Not writable: `photo_verified`, `is_premium`, `waitlist_*`, daily counters. | P1 for V2 gate |
| `user-photos` | Public bucket; SELECT policies `photos are public` (role **public**) and `Anyone can view photos` → anyone, even signed-out, can read and list object names (`{uid}/…` reveals user IDs). Duplicate INSERT/DELETE policies (two names each). | P1 (listing), cleanup |
| `verification-selfies` | Private; INSERT/DELETE own folder only; **no SELECT** for anyone but service role → correct for private review. | OK |
| `profile-photos` bucket | Public, no policies, no code reference found → unused leftover. | cleanup |
| `onboarding_answers` | Own-row ALL; matching reads it inside the SECURITY DEFINER RPC (20260921090000). | OK |
| `matches` / `messages` | Block-aware (20260916…). Invite/accept state machine still client-driven (`lib/matchInvite.ts` updates rows directly; see CLAUDE.md 2026-09-16 note). | P2 |
| `venues` | Duplicate SELECT policies (`public` + `authenticated`). | cleanup |

### 1.4 Matching today (V1) [live]
One RPC: `public.get_top_matches(p_user_id, p_limit)`. It is called from `app/(tabs)/index.tsx` `loadFeed` (limit 10) and from `app/(tabs)/matches.tsx` (refill of candidate rows).

**Hard eligibility (WHERE):**
- The candidate has `setup_completed=true`, is not hidden, is not deleted, and is not the caller.
- **Same city**: case/space-insensitive text equality.
- `discovery_max_distance='same_district'` → district equality (Turkish diacritics folded).
- Mutual gender ↔ `meeting_preferences` (V1 labels Men/Women/Non-binary/Everyone).
- Blocks in both directions.
- No active or recent `matches` row: pending/accepted, expired < 14 d, passed < 42 d.
- Optional filters:
  - verified only, non-smokers (`smoking <> 'Yes'`).
  - Height, zodiac, pets, education and religion lists (a candidate with the value missing passes).
  - Active in the last 24 h (a candidate with the value missing does **not** pass).
- **`discovery_age_min/max` are never read** — the age-range filter in Filters has no effect (also noted in [draft] matching-engine-v2 §A.1; still true).

**Points:**
- `location` 20 (same district) / 8 (same city).
- `age` 20 / 10 / 5 / −5 by raw year gap ≤2 / ≤4 / ≤6 / more.
- `intent` 40 same / 20 if either is `not_sure_yet` / 10 casual×relationship / 5 `just_friends` — **V1 keys**. V2 keys `long_term/casual/figuring_out` would only score on exact equality, so V2 answers are effectively unscored.
- Lifestyle bucket, capped at **65**:
  - morning/night 15, recharge 15.
  - Hobbies 5 each, max 25.
  - Availability days 15/8/3.
  - Drinking and smoking −6…10 each (V1 labels Yes/No/Socially).
  - Education 8, language ≥1 → 5.
  - Meeting environment 12/6.
  - Zodiac 5/2, favorite spot 5.

**Normalizing and ranking:**
- × completeness multiplier 0.85–1.0, over 9 applicable fields.
- Percentage = adjusted/140 × 100, clamped 20–99, capped at 85 if the age score is negative.
- Sort = adjusted + `sort_boost`: verified +15, liked-me +40.

**Outputs:**
- `match_percentage` and `match_category` (emoji labels at 80/60/40).
- `reasons[]`: up to 3 from a fixed priority list.

**Duplication and drift** [code]:
- `lib/matchReason.ts` `computeFallbackReasons()` re-implements the RPC's reason rules in TypeScript. It is used for older `matches` rows whose frozen score has no reasons.
- `app/(tabs)/matches.tsx` has its own `matchCategory()` thresholds.
- `matches.match_score` is **frozen at insert** by `upsert_match`, so formula changes do not update existing rows (CLAUDE.md 2026-09-15).
- `lib/profileMatching.ts` holds V1 hard-filter/score helpers used by `lib/vibeCategories.ts` (the Vibe tab).
- `lib/intentMatching.ts`, `lib/setup1Matching.ts` and `lib/setup2Matching.ts` are **not imported anywhere**.
- So scoring lives in the RPC, with partial copies in the client.

**Missing-data behaviour:**
- Lifestyle fields score 0 when missing, and the multiplier lowers the score by up to 15 %. **Missing optional data therefore pulls a candidate down.**
- The age penalty applies inside the user's own range; there is no range filter at all.
- Pass on Discover is not stored anywhere (`handlePass` is local), so passed people can reappear.

## 2. V1 → V2 field mapping

Legend — Purpose: **E** eligibility (hard, mutual), **S** soft score (proposed), **D** display only, **P** private/operational. "Draft" = [draft] Revision 2 name. Visibility is what the P07 R1 preview shows.

| Section / field | V2 draft (in `PreviewFlow`) | Live DB today | Gap / change | Req. | Public | Purpose | Legacy V1 users |
|---|---|---|---|---|---|---|---|
| **Basics** first name | `string` | `profiles.first_name` | ok | req | yes | D | keep |
| last name | `string` | `profiles.last_name` | move off public read (P0 above; draft: keep but restrict) | req | **no** | P | keep, restrict |
| DOB | `dobDay/Month/Year` strings → `Date` | `profiles.date_of_birth` | move to `profile_private_v2` (draft); age + zodiac computed | req 18+ | age + zodiac only | E (age range) / S (gap) / D | keep value |
| gender | `'woman'\|'man'\|'non_binary'` | `profiles.gender` `Woman/Man/Non-binary` | new keys (draft `gender_v2` still has `self_describe` → remove, D15) | req | yes | E | deterministic map (Woman→woman …) |
| interested in | `('women'\|'men'\|'non_binary_people'\|'everyone')[]` | `profiles.meeting_preferences` `Men/Women/Non-binary/Everyone` | new keys; everyone exclusive | req ≥1 | no | E (mutual) | deterministic map |
| location | `LocationResult {id, kind, city, district}` | `city`, `district`, `lat/lng` text | store local catalog `id` + city/district; district not public (D49) | req | city | E (city) / S (proximity) | keep city/district text; no id until re-picked |
| height | `heightCm` string → int | `profiles.height_cm` | ok | req (D12) | yes | D (+ optional filter) | keep |
| **Compatibility** intent | `long_term\|casual\|figuring_out` | `onboarding_answers.intent` V1 keys (`open_to_relationship`, `keeping_it_casual`, `not_sure_yet`, `just_friends`) | new column, V2 keys (D20) | req | yes ("Looking for") | S (dominant) | **no auto-mapping of meaning** — mark `questionnaire_version='v1'`, ask again |
| social energy / texting / time together / feelings / meeting pace | 5 single-choice keys (see `compatibility.ts`) | none | NEW columns (draft `onboarding_answers_v2` must be rewritten to these) | req | no | S (feelings 0) | ask; never fabricate |
| values | `string[]` 1–2 incl. **`respect`** | `profiles.core_value` (free text) | NEW `text[]`; `respect` not in any draft/CHECK — add if approved | req 1–2 | yes | S (tiny) | ask |
| **Your Life** smoking | `no\|sometimes\|yes` | `profiles.smoking` `Yes/No/Socially` | new enum (SCHEMA_MAPPING said `occasionally`; code uses **`sometimes`** — pick one) | req | yes | S (+ optional non-smoker filter) | `Socially` is lossy → ask again |
| drinking | `none\|sometimes\|regularly` | `profiles.drinking` | same as above | req | yes | S | ask again |
| pets | `have_pets\|like_no_pets\|neutral\|rather_not` + `petKind dog\|cat\|both\|other` | `profiles.pets` (species) | NEW attitude + kind | req / kind opt. | yes | S (attitude) / D (kind) | ask |
| activity | `very\|somewhat\|not_very` | none | NEW (SCHEMA_MAPPING said `moderate`; code uses **`somewhat`**) | req | yes | S | ask |
| **Your World** work status / job title | `workStatus` key, `jobTitle` string | `occupation` (free text) | NEW `work_status` (code `between_jobs` vs doc `between_roles` — align); `occupation` = title | opt | yes | D | keep occupation as title |
| school / hometown | `TasteItem` (source + id + title + subtitle) | none (`education` = level, D40) | NEW; store provenance `source`, `catalog_id` (sample/custom today) | opt | yes | D (0 score, D39) | none |
| interests | `string[]` 16 keys, **1–10** (D59) | `profiles.hobbies` (free text) | NEW `text[]` with CHECK | req | yes | S | map only exact matches of the 16 labels; else ask |
| artists / books / movies & series | `TasteItem[]` 0–3 each — `source` `musicbrainz`/`openlibrary`/`wikidata`/`custom`, `id` `mb:artist:<MBID>` / `ol:work:<OLID>` / `wd:<QID>` / `custom:<kind>:<folded>`, optional `imageUrl` (OL cover) | `favorite_music/book/movie` free text | NEW `profile_taste_items(user_id, kind, source, catalog_id, display_name, subtitle, image_url, position)`; unique `(user_id, kind, catalog_id)`; custom entries keep exact text | opt | yes | S (tiny, capped) / D | keep V1 text as read-only legacy, never convert to IDs |
| **Your Dates** date types | `string[]` 1–2 `coffee, drinks, dinner, activity, walk, outdoors` | `meeting_environment` (emoji labels) | NEW `date_types text[]` | req | yes | S (small) / planning | ask |
| favorite spot | `spotText` raw → `{source:'custom', displayName}` | `favorite_spots` jsonb per environment (different concept) | NEW single optional `favorite_spot_text` (+ future `provider, provider_place_id, address`); **one field for everyone** (D57) | opt | yes | D / planning | do not merge from V1 jsonb automatically |
| days / time | `weekdays\|weekends\|either`, `daytime\|evening\|either` | `availability_days/hours` arrays | NEW scalar keys | req | yes | S (small) / planning | ask |
| **Profile** photos | `LocalPhoto[]` (3–6, order = array order, first = main) | `profiles.photos text[]` (paths in public `user-photos`) | draft `profile_photos(storage_path, display_order, is_primary)` + RPCs; enforce 3–6 at submit (draft says ≥3) | req 3–6 | yes | D | V1 paths can seed rows in stored order |
| prompts | `{promptId, answer}[]` 2 req + opt 3rd, 200-char proposed cap, keys D59 | none | draft `profile_prompts` CHECK lists an **older 8-key set** and 300-char cap → must be rewritten to the D59 keys (or a lookup table) | req 2 | yes | D | ask |
| selfie | local URI only | `profiles.verification_selfie_path` + private bucket | move path to server-only `profile_account_state_v2.verification_selfie_path` (draft); client must not be able to write/read it | req | **no** | P | — |
| email | `email` + demo check bound to email | Supabase Auth email (today = the login identity) | V2: phone is identity (D8), email attached later with a real OTP | req | no | P | existing email users: keep email, add phone later |
| application | local `applicationPreview` marker | none | `profile_account_state_v2` (draft) | — | no | P | V1 users start as `onboarding_version='v1'` |

Things **not** carried (D40/D41): Instagram, education level, morning/night, recharge, bio, first-date expectation, languages, neighborhoods/distance, religion (frozen, KVKK). They must not be required by any V2 RPC.

### 2.1 Specific issues
1. **Enum spelling drift** between docs and code: `sometimes` vs `occasionally`, `somewhat` vs `moderate`, `between_jobs` vs `between_roles`. Proposal: treat the **code keys** (what the approved UI emits) as canonical and fix SCHEMA_MAPPING, then CHECK constraints.
2. **`respect`** is a UI-only key (D51); no draft CHECK includes it.
3. **Prompt keys**: the draft CHECK (`sunday_looks_like`, `win_me_over`, …) matches neither D58 nor D59. Proposal: a small `prompt_catalog` table (key, label, active) instead of a CHECK, so copy changes don't need a migration.
4. **Taste provenance**: keep `source` + stable provider ID; custom entries never get a fake ID; duplicates rejected by `(kind, catalog_id)`; no image unless the provider supplies and licenses it.
5. **Photo order**: store `display_order` 0–5 + `is_primary` (= order 0); reorder via one RPC taking the full ordered id list (atomic), not pairwise swaps.
6. **Legacy users**: never fill V2 answers from V1 guesses. Mark them `questionnaire_version='v1'` and route to a short "complete your profile" V2 flow before V2 discovery.

## 3. Scoring — V2 proposal (🔵 not approved)

### 3.1 Principles
- **Eligibility is separate from soft points.** Eligibility is mutual and never shown as a percentage. It covers:
  - The account/application/membership/verification gate: live, never cached ([draft] §6.4).
  - Mutual gender ↔ interested-in (D15b), and the age range on **both** sides.
  - City (or a distance band later), blocks, hidden/deleted, recent pass/decline cooldown.
- **Soft points only rank people who are already eligible.** The table in `SCORING.md` §2 is the starting proposal:
  - Intent 30 dominates.
  - Communication (texting 4, time together 4, cap 8) and meeting pace 4.
  - Lifestyle (smoking 6, drinking 4, pet attitude 6, activity 4).
  - Interests 7, values 1.
  - Taste 1 each, date types 2.5, days/time 1.25 each, age 10, proximity 10.
- **Own trait ≠ partner preference.** Someone who smokes is not saying "only smokers". Similarity points may use both answers, but a *filter* only comes from an explicit preference (e.g. the existing "non-smokers only" toggle). No lifestyle dealbreakers are derived from one's own habits (D23).
- **Missing optional data is unknown, not a mismatch.** Taste, school and so on are skipped: they do not score 0-as-penalty, and there is no completeness multiplier on them. Show a separate **coverage** value (answered comparable fields / possible) for tie-breaking and explanations only.
- **Taste can't dominate.** Artists/books/movies are 1 point each (max 3 of 100). Proposal: cap all taste + interests at ~10 and never let them offset an intent mismatch in explanations.
- **Display only:** zodiac, school, job and hometown carry 0 points. This matches `SCORING.md` (zodiac 0, D38 🔵) and D39. It **contradicts live V1**, where zodiac adds +5/+2. V1's behaviour would simply not be carried into V2.
- **Emotional expression** stays 0 until a model is agreed (`SCORING.md`).
- Store `score_version`, `questionnaire_version`, per-signal breakdown and coverage; no user-facing "% compatibility" until decided (`SCORING.md` §3, 🔴).

### 3.2 Worked example (illustrative, not calibrated)
Viewer: long_term; mix social; "a few times a day"; balance; after chatting; values Trust + Respect; doesn't smoke; drinks sometimes; likes pets but has none; somewhat active; interests Food, Travel, Books, Music; 1 artist + 1 book; Coffee + A walk; Weekends · Daytime; 29.
Proximity is a neutral 5 for everyone (city only). Points come from `SCORING.md` §2. Pet cells that `SCORING.md` hasn't written down yet (`like_no_pets` pairs) use **my provisional values** 6 / 4.8 / 2.4.

| Candidate | Intent | Lifestyle (of 20) | Interests (of 7) | Taste (of 3) | **Total / 100** |
|---|---:|---:|---:|---:|---:|
| D — long_term, 33, no taste added, Either/Either, 1 shared interest | 30 | 20 | 2 | 0 | **84.9** |
| A — long_term, 31, 1 shared interest, different date types/times | 30 | 20 | 2 | 0 | **82.5** |
| C — figuring_out, 27, smokes, drinks regularly, would rather not live with pets, 2 shared interests | 15 | 11 | 4 | 2 | **64.0** |
| B — **casual**, same age, identical habits, 4 shared interests + shared artist/book/movie | 0 | 20 | 6.5 | 2 | **63.5** |

Why the order changes compared with a "most in common" model:
- B shares the most, but the intent mismatch (0 of 30) outweighs all shared taste and interests. This is the D36 direction: strong priority for aligned intent, no hard filter.
- D has empty optional taste and is **not** pulled down, because missing ≠ mismatch.
- C gets partial intent credit, but three lifestyle gaps pull it down. It still lands above B.

Under **V1 today**, V2 answers would barely register:
- Intent only scores on equal keys (40).
- The lifestyle bucket reads V1 columns that V2 doesn't write.
- So the ranking would be driven by city, age and liked-me.

That is why a separate `get_top_matches_v2` is needed rather than a patch (`SCORING.md` §1).

### 3.3 Decisions waiting for approval
1. Final weights and the full pet-attitude matrix (`SCORING.md` §2 is 🔵).
2. Whether any answer becomes a *hard* filter (e.g. long_term × casual) — D36 currently says no.
3. Age: range filter both ways + small in-range gap points, or no gap points at all.
4. Proximity bands (city-only today; lat/lng unused).
5. Coverage: tie-break only, or a small weight.
6. Percentage vs qualitative explanation in the UI (🔴 open) — affects ~10 files that render `match_percentage`.
7. Where scoring runs: SQL RPC (today, fast, single transaction) vs precomputed table/Edge Function. **Proposal:** keep one SQL `get_top_matches_v2`, and delete the client copies (`matchReason.computeFallback*`, `matchCategory`, dead `*Matching.ts`) once V2 is live.
8. Separate recommendations from real matches (today a candidate is a `matches` row via `upsert_match`).

## 4. Other findings worth fixing independently (not done)
- `discovery_age_min/max` ignored by `get_top_matches` (V1 bug).
- Discover "pass" not persisted.
- `profiles` over-exposed columns (P0 above); public listable photo bucket.
- `setup_completed` client-writable (fine for V1 alpha, not for V2 gate).
- Unused `profile-photos` bucket, duplicate storage/venues policies, `upsert_match` EXECUTE for `anon`.
- The V2 design files are **uncommitted** in the main checkout — at risk of loss; proposal: commit them to a docs branch before starting WP1.

## 5. Limits of this audit
Read-only; no device or simulator; the live DB has 2 test accounts, so no data-driven calibration is possible. The [draft] files were read but not re-validated line by line against every current decision — the mismatches listed in §2.1 are the ones found.
