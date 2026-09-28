# V2 drafts archive — NOT an approved schema

These four files were preserved on 2026-09-28 from the **uncommitted** working
tree of `~/dating-app-recovered` (main checkout). They are byte-identical copies
(SHA-256 prefixes below); the originals were left untouched.

| File here | Original path | SHA-256 (prefix) |
|---|---|---|
| `docs/v2-drafts/v2-schema-spec.md` | `docs/v2-schema-spec.md` | `94d69c08217ce029` |
| `docs/v2-drafts/matching-engine-v2.md` | `docs/matching-engine-v2.md` | `bfb32cd8c9039781` |
| `docs/v2-drafts/onboarding-v2-gap-analysis.md` | `docs/onboarding-v2-gap-analysis.md` | `aff2f7bf87c68d9a` |
| `supabase/drafts/20260921100000_v2_schema_proposed.sql` | `supabase/migrations/20260921100000_v2_schema_proposed.sql` | `20be892f68afd8e9` |

The SQL file is deliberately stored **outside `supabase/migrations/`** so no
CLI command can apply it. It has **never been applied** (live
`list_migrations` on 2026-09-28 ends at `20260921091500`).

Not included on purpose: `AGENTS.md`, `docs/brand.md` (unrelated),
`.codex/` (tool config), `supabase/.temp/` (CLI link state — project/pooler
details), and the uncommitted edits to tracked app files (Matches screens,
`lib/matchInvite.ts`, `lib/placeSearch.ts`, `lib/turkishGeo.ts`). A pattern scan
for keys, tokens, passwords, e-mail addresses and phone numbers found **no
matches** in the four archived files.

## Status
Schema **Revision 2** (2026-09-20/21). It predates decisions **D15–D59**,
so it is **out of date** and must be revised (Revision 3) before any use.
Treat it as design history plus reusable patterns (server-controlled account
state, RPC-gated photo/prompt writes, private DOB table, live discovery
gate), **not** as the target schema.

## Differences against D15–D59 (found 2026-09-28)

| Area | Draft (Revision 2) | Approved now | Decision |
|---|---|---|---|
| Gender | `gender_v2` incl. `self_describe` + `gender_self_describe` | Woman / Man / Non-binary only | D15 |
| Interested in | `interested_in_v2` vocabulary incl. `self_describe` | Women / Men / Non-binary people, or Everyone alone | D15b |
| Compatibility answers | `connection_pace`, `communication_style`, `closeness_preference`, `children_view`, `exclusivity_view` | intent + social energy, texting, time together, sharing feelings, meeting pace + values 1–2 (incl. `respect`); no children/exclusivity questions | D17, D21, D50, D51 |
| Values | not present | 1–2 of ten incl. `respect` | D51 |
| Smoking / drinking | `never/occasionally/regularly/trying_to_quit`, `never/socially/regularly/sober` | `no/sometimes/yes`, `none/sometimes/regularly` (code keys) | D52 |
| Pets | `pets_v2 text[]` species (`no_pets/dog/cat/other`) | attitude (`have_pets/like_no_pets/neutral/rather_not`) + optional kind (`dog/cat/both/other`) | D52, D53 |
| Activity | `activity_level occasionally/few_times_week/most_days` | `very/somewhat/not_very` | D52 |
| Work / school / hometown | `school`, `hometown` free text ≤120; no work status | work status (5 keys) + optional job title; school/hometown as search-or-enter items with provenance | D54, D55 |
| Interests / taste | none (reuses V1 `hobbies`) | 16 fixed interests, **1–10**; artists/books/movies 0–3 each with source IDs | D25, D54, D55, D59 |
| Dates | `availability_v2` (`weekday_evenings/saturdays/sundays/flexible`), `meeting_environment_v2` | date types 1–2 (`coffee/drinks/dinner/activity/walk/outdoors`), days `weekdays/weekends/either`, time `daytime/evening/either`, one optional favorite spot; no dinner vibe | D57 |
| Prompts | CHECK on 8 old keys (`sunday_looks_like`, `win_me_over`, …), 1–300 chars | 8 new preview keys (`weird_talent` … `sunday_usually`), 2 required + optional 3rd, 200-char proposed cap; keys still not an approved enum | D33, D58, D59, Q6 |
| Photos | `profile_photos`, ≥3 enforced at submit, no max | 3–6 | D58, D59 |
| Discovery prefs required at submit | age range, distance, smoking/drinking strength, pets tolerance | **not** onboarding inputs; must not be required by submit | D41, SCHEMA_MAPPING |
| Email / phone | assumes phone identity + email later | same direction (D7/D8); not implemented anywhere yet | D7, D8 |
| Submit / application | `submit_application` + account state machine | matches the direction; Received ≠ accepted; the UI's separate checklist state was removed (Submit sits on the confirmed email screen) | D32, D59 |

See `docs/tempa/V2_BACKEND_SCORING_AUDIT.md` and `V2_INTEGRATION_PLAN.md` on
`tempa/p07-r1-profile-fixes` for the current analysis and the Revision 3 plan.
