# Onboarding V2 — Schema Design Spec (Revision 2)

**Status: DESIGN ONLY. Nothing in this document or its companion migration has
been applied to the live database. No application code has been changed.
No seed data has been generated. No auth accounts have been created.**

This is **Revision 2**, produced after a blocking-issue review of Revision 1
identified 14 concrete problems — most importantly, that Revision 1 put
sensitive and operational data (birthdate, discovery preferences, account
state) directly on the broadly-readable `profiles` table. This revision
restructures the schema around a hard separation of concerns instead. If
you reviewed Revision 1, §0 below maps every one of the 14 fixes to where
it's addressed; the rest of the document reads standalone.

This follows `docs/v2-clean-start-plan.md` (the destructive cleanup that
emptied every user-linked table — `auth.users=0`, `profiles=0`,
`onboarding_answers=0`, and everything else, `venues=10` the sole
non-user-linked exception) and `docs/onboarding-v2-gap-analysis.md` (the
field-by-field KEEP/CHANGE/REMOVE-FREEZE/ADD audit this spec turns into an
actual schema).

The companion proposed migration is
`supabase/migrations/20260921100000_v2_schema_proposed.sql` — unapplied,
reviewed inline below. It is **purely additive**: no V1 table, column,
policy, or grant is altered, renamed, or dropped anywhere in it.

---

## 0. The 14 blocking fixes — where each one lives

| # | Issue raised | Where it's fixed |
|---|---|---|
| 1 | No sensitive/operational field on `profiles` | §1 — five-table split |
| 2 | Audit `verification_selfie_path` etc.; V2 uses a private table; no V1 `DROP` | §1.3, §8 |
| 3 | Remove `age_years` storage/trigger; derive age dynamically in RPCs; zodiac server-derived | §0 of the migration (`compute_age_years`, `compute_zodiac_sign`) |
| 4 | `profile_photos`: stable id, storage_path, order, one primary, min-3-at-submission, Storage ownership check | §3 |
| 5 | `profile_prompts`: max 3, unique display_order, valid range, min-2-at-submission, no DML bypass | §4 |
| 6 | `onboarding_answers_v2.user_id` is a real `PRIMARY KEY` | §2 |
| 7 | NULL≠anywhere for distance | §5.3 |
| 8 | Canonical `gender_v2`/`interested_in_v2` vocabulary; `everyone` mutually exclusive; `self_describe` matching category explicit | §5.1–§5.2 |
| 9 | Strict state-transition guards | §6 |
| 10 | Discovery gate = accepted + active + verified + not hidden + not deleted, both sides | §6.4 |
| 11 | `mark_verification_submitted` verifies real Storage object + ownership | §7.6 |
| 12 | Internal reviewer notes vs. user-facing feedback are separate; append-only application review log added | §6.5, §7 |
| 13 | Array fields validated (allowed values, duplicates, mutual exclusivity) in the submission RPC | §7.7 |
| 14 | Drop low-selectivity blanket indexes; use partial indexes | §9 |

---

## 1. Table split (fix #1) — the central structural change

Revision 1 added preference and state columns directly to `profiles`.
`profiles` is readable by any authenticated user for whom
`profiles_select_authenticated` returns true (self, not hidden/deleted, or
matched) — meaning anything placed there is, in practice, visible to
strangers. Discovery preferences (a narrow age band, a smoking
dealbreaker, an "everyone" vs. narrow `interested_in_v2`) and account
state (`application_status`, `is_seed_data`, verification internals) have
no business being readable that broadly. Five tables now exist:

| Table | Contains | Visibility |
|---|---|---|
| `profiles` (V1, extended) | Public/display profile facts | Broad (existing `profiles_select_authenticated` policy, unchanged) |
| `profile_private_v2` | `date_of_birth` | **Self only — no cross-user policy at all** |
| `discovery_preferences_v2` | Every V2 discovery preference | **Self only** |
| `profile_account_state_v2` | onboarding/application/verification/membership state | Self can `SELECT` a column-allowlisted subset; **no INSERT/UPDATE grant to anyone but service_role/RPCs** |
| `profile_photos`, `profile_prompts` | Ordered profile content | Visible like the owning profile (same rule as `profiles`); **no direct INSERT/UPDATE/DELETE grant — RPC-gated only** |

`profile_private_v2`'s self-only-with-no-cross-user-policy design is a
stronger fix than Revision 1's proposed `REVOKE SELECT (date_of_birth)` +
RPC combination: physically separating the sensitive column into its own
table means there is no table-level grant that could ever expose it to
another user by mistake later — the absence of a cross-user policy is the
entire enforcement mechanism, not a column-privilege detail someone has to
remember to preserve during a future refactor.

---

## 2. `onboarding_answers_v2` — "How you connect" (rules from original brief #1, #2, #3, #6, #7; fix #6)

Unchanged in content from Revision 1, with one structural fix: **`user_id`
is now the actual `PRIMARY KEY`** (Revision 1 used a redundant surrogate
`id uuid primary key` plus a separate `unique` constraint on `user_id` —
removed; for a strict 1:1 table, `user_id` being the primary key directly
is more correct and is what the migration now does).

| Column | Type | Values |
|---|---|---|
| `user_id` | `uuid` **primary key** | FK → `profiles(id) on delete cascade` |
| `intent` | `text` | `long_term`, `casual`, `figuring_out` |
| `connection_pace` | `text` | `slowly_with_time`, `naturally_no_forcing`, `know_when_chemistry` |
| `communication_style` | `text` | `stay_in_touch_throughout_day`, `meaningful_checkins`, `let_rhythm_develop` |
| `closeness_preference` | `text` | `lots_of_shared_time`, `balance_closeness_independence`, `room_for_own_lives` |
| `children_view` | `text` | `want_children`, `no_children`, `open_to_either`, `undecided` — only when `intent in ('long_term','figuring_out')` |
| `exclusivity_view` | `text` | `one_person_at_a_time`, `keeping_it_open`, `decide_together` — only when `intent = 'casual'` |

**Intent values, exactly:** `long_term`, `casual`, `figuring_out` — this
corrects the original master-spec document's prose, which wrote
`figuring_it_out`; the spelling given explicitly in this session is
authoritative.

`relationship_pace`/`connection_style`/`connection_energy` (the legacy
`onboarding_answers` column names) are never reused with this meaning —
`connection_pace`/`communication_style`/`closeness_preference` are
deliberately different names on a deliberately different table.

RLS: self-only `SELECT`/`INSERT`/`UPDATE`, no `DELETE` policy (removed
only via the `profiles` cascade).

---

## 3. `profile_photos` (fix #4)

```
id             uuid primary key
user_id        uuid → profiles(id) on delete cascade
storage_path   text, unique across the whole table
display_order  smallint, unique per user
is_primary     boolean
created_at     timestamptz
```

- **Unique ordering per user:** `unique (user_id, display_order)`.
- **Exactly one primary per user:** a plain `UNIQUE` constraint can't
  express "unique only when true," so a **partial unique index**
  (`create unique index ... on profile_photos (user_id) where is_primary`)
  enforces it — the standard Postgres idiom for this shape of rule.
- **Minimum 3 at submission:** not a blanket table `CHECK` (which would
  block saving 1–2 photos mid-onboarding) — enforced inside
  `submit_application()` (§7.7), which counts rows before allowing the
  status transition.
- **Storage object ownership/existence verification:** `add_profile_photo()`
  (§7.2) checks the referenced path against `storage.objects` directly —
  the object must exist in the `user-photos` bucket, its path must be
  prefixed with the caller's own `auth.uid()`, and if Storage's own
  `owner` column is populated it must match the caller. A `CHECK`
  constraint cannot reference another table in Postgres, so this has to be
  RPC-level, not declarative — the RPC is the only INSERT path (no direct
  `INSERT` grant to `authenticated` exists on this table at all, matching
  the "doğrudan DML bypass edemez" principle the brief stated for
  `profile_prompts` and which applies here for the same reason: the
  storage-ownership check has no declarative equivalent, so bypassing the
  RPC would bypass the entire safeguard).
- **RPCs:** `add_profile_photo`, `remove_profile_photo` (auto-promotes the
  lowest-order remaining photo to primary if the removed one was primary,
  so a user with photos is never left without one), `set_primary_photo`,
  `swap_profile_photo_order` (a two-photo swap — the simplest reorder
  primitive that can't collide with the unique-order constraint mid-swap;
  a full-list reorder RPC is a reasonable future addition, not built here
  since it wasn't specified).

`profiles.photos` (V1, `text[]`) is completely untouched; V2 code uses
`profile_photos` exclusively.

---

## 4. `profile_prompts` (fix #5)

```
id             uuid primary key
user_id        uuid → profiles(id) on delete cascade
prompt_key     text, CHECK against the fixed 8-item library
answer_text    text, 1–300 chars
display_order  smallint, CHECK between 0 and 2
created_at / updated_at
unique (user_id, prompt_key)
unique (user_id, display_order)
```

- **Max 3:** `display_order between 0 and 2` bounds the *value*; the
  *count* (can't insert a 4th even at a fresh, unused order value like a
  hypothetical `3`) is enforced in `add_profile_prompt()` (§7.3), which
  counts existing rows before inserting — a `CHECK` constraint has no way
  to see sibling rows, so this genuinely can't be purely declarative.
- **Unique, valid `display_order`:** both the range `CHECK` and the
  `unique(user_id, display_order)` constraint are declarative and hold
  regardless of write path.
- **Min 2 at submission:** counted in `submit_application()`, same
  pattern as photos.
- **No direct-DML bypass:** no `INSERT`/`UPDATE`/`DELETE` grant to
  `authenticated` exists on this table — only `add_profile_prompt`,
  `update_profile_prompt`, `remove_profile_prompt` (§7.3) can touch it,
  which is what actually makes the max-3 rule impossible to bypass (the
  unique/range constraints alone don't stop a 4th prompt at a *reused*
  slot's neighbor value if slots opened up after a deletion — the RPC's
  `count(*) >= 3` check is the real backstop for the cardinality rule).

8-key library (unchanged from Revision 1):
`sunday_looks_like`, `win_me_over`, `small_thing_means_a_lot`,
`well_get_along_if`, `looking_for_someone_who`, `ideal_first_date`,
`never_get_tired_of`, `relationship_feels_right`.

---

## 5. `discovery_preferences_v2` (fixes #7, #8)

```
user_id            uuid primary key → profiles(id) on delete cascade
interested_in_v2   text[]
age_min / age_max  int
distance_pref      text
smoking_strength   text
drinking_strength  text
pets_tolerance     text
height_min_cm / height_max_cm  int
created_at / updated_at
```

### 5.1 Canonical gender/interested-in vocabulary (fix #8)

`profiles.gender_v2` and `discovery_preferences_v2.interested_in_v2` share
one lower-case vocabulary: `woman`, `man`, `non_binary`, `self_describe`.
`interested_in_v2` additionally allows the sentinel `everyone`, which
**cannot coexist with any other value** — enforced by a table `CHECK`:

```sql
check (
  interested_in_v2 is null
  or not ('everyone' = any(interested_in_v2))
  or cardinality(interested_in_v2) = 1
)
```

### 5.2 `self_describe`'s matching category, made explicit (fix #8)

Revision 1 left this ambiguous: if a user's own `gender_v2` is
`self_describe`, who can find them? Because `interested_in_v2` uses the
**exact same vocabulary** as `gender_v2` (including `self_describe` as a
first-class value, not a special case), the rule is now explicit and
symmetric: a `self_describe` person is discoverable by anyone whose
`interested_in_v2` array contains `self_describe` or `everyone` — same
mechanism as every other gender value, no separate handling required
anywhere in matching logic.

The same mutual-exclusivity pattern is applied to `profiles.pets_v2`:
`no_pets` cannot coexist with `dog`/`cat`/`other` in the same array (a new
`CHECK` constraint on `profiles`, added in the same migration).

### 5.3 NULL vs. "anywhere" (fix #7)

`distance_pref` is a `text` `CHECK` over
`('within_5km','within_15km','within_30km','anywhere')`. `NULL` means
"not answered yet" (a legitimate mid-onboarding state); `'anywhere'` is a
real, explicit answer meaning no distance restriction. The two are never
conflated — this was Revision 1's actual bug (`discovery_distance_km int`
with `NULL` documented as meaning "Anywhere," which is indistinguishable
from "hasn't answered"). No other field in this schema has the same
ambiguity: `children_view`/`exclusivity_view`'s `NULL` genuinely only ever
means "no answer on record" (whether because it's inapplicable to the
user's intent or because they haven't gotten there yet) — there's no
competing *real answer* that NULL could be mistaken for in those columns,
so no equivalent fix was needed there.

### 5.4 Self-only RLS, and why it matters even for "reused" concepts

Every column here is new for V2 (age/height ranges included) rather than
reusing `profiles.discovery_age_min/max`/`discovery_height_min/max` —
those V1 columns remain exactly as they are (still readable by any
authenticated user via `profiles_select_authenticated`, still used only by
the V1 RPC). Keeping V2's equivalents in this dedicated, self-only table
means the *entire* V2 preference surface gets the privacy treatment
uniformly, rather than fragmenting "some preferences are private, some
aren't" depending on incidental column history.

Advanced V1 filters (`discovery_zodiac_signs`, `discovery_education`,
`discovery_verified_only`, `discovery_active_today`, and the pet-*types*
filter `discovery_pets`) are **not** moved into this table in this
revision — out of scope for the specific fixes requested, though the same
privacy argument now visibly applies to them too; noted here as a
candidate for a later, explicitly-scoped follow-up rather than folded in
opportunistically.

---

## 6. `profile_account_state_v2` — state machine (fixes #1, #9, #10, #12)

```
user_id                       uuid primary key → profiles(id) on delete cascade
onboarding_version            text  ('v1'|'v2')
onboarding_status             text  ('draft'|'in_progress'|'submitted')
application_status            text  ('draft'|'submitted'|'under_review'|'waitlisted'|'changes_requested'|'accepted'|'rejected')
application_submitted_at      timestamptz
application_reviewed_at       timestamptz
application_user_feedback     text   -- user-facing only, see §6.5
verification_status           text  ('not_submitted'|'pending'|'verified'|'retry_required'|'rejected')
verification_selfie_path      text  -- NOT exposed to the client, see §6.2 grants
verification_submitted_at     timestamptz
verification_reviewed_at      timestamptz
verification_user_feedback    text   -- user-facing only
membership_status             text  ('none'|'pending_activation'|'active'|'expired'|'cancelled')
membership_activated_at       timestamptz
membership_expires_at         timestamptz
is_founding_member            boolean
is_seed_data                  boolean  -- NOT exposed to the client
created_at / updated_at
```

### 6.1 Row creation — never client-controlled

There is **no `INSERT` grant to `authenticated`** on this table at all. A
row is created automatically by a trigger
(`create_account_state_for_new_profile`, `SECURITY DEFINER`) firing
`AFTER INSERT ON profiles`, which inserts hardcoded defaults
(`is_seed_data = false`, every status at its safe starting value) —
structurally, a client can never influence the initial values of a single
one of these columns, not even at account-creation time.

### 6.2 Column-level SELECT allowlist (fix #12)

`authenticated` is granted `SELECT` on an explicit column list that
**excludes** `is_seed_data` and `verification_selfie_path` — neither has
any legitimate client read use (the client already knows what it
uploaded; there's no display need for the raw storage path), and
excluding them removes any future risk of accidentally widening access
through a careless table-level grant. Internal reviewer notes don't even
exist as columns on this table (see §6.5) — there's no column to
accidentally over-expose.

### 6.3 State-transition guards, not just value-domain checks (fix #9)

Revision 1's RPCs validated that a target status was a *legal value*
(e.g., `p_new_status in (...)`) but never checked that the transition
*from the current state* made sense — `review_application()` would have
happily accepted an application whose verification was still
`not_submitted`. Revision 2 adds real guards, each reading the current
state with `SELECT ... FOR UPDATE` (row-locked, avoiding a race against a
concurrent status change) before writing:

- `mark_verification_submitted`: only callable from `not_submitted` or
  `retry_required`. Blocked from `pending` (already awaiting review),
  `verified` (already done), and `rejected` (terminal — consistent with
  how a hard application rejection is also terminal below).
- `review_application`: target `'accepted'` is rejected unless the
  row's *current* `verification_status = 'verified'` at the moment of the
  call.
- `activate_membership`: rejected unless `application_status = 'accepted'`
  at the moment of the call.

### 6.4 Discovery gate, computed live (fixes #9's revocation clause, #10)

**`application_status = 'accepted' AND membership_status = 'active' AND
verification_status = 'verified' AND profiles.is_hidden = false AND
profiles.deleted_at IS NULL`** — applied to **both** the caller and the
candidate. This is the `WHERE`-clause fragment the (not-yet-written) V2
matching RPC must use; it is not itself a stored/cached value anywhere.

That "not cached" property is what satisfies the revocation requirement:
if a reviewer later moves a previously-verified account to `rejected`
(via `review_verification`, which has no FROM-state restriction — a
reviewer can revoke a verification at any time, e.g. after a report), the
account's discovery eligibility disappears on the *very next* matching
call, automatically, because the gate re-reads `verification_status` from
scratch every time. No separate "eligibility" flag exists to go stale, and
no additional revocation code was needed to make this true — it follows
directly from never caching the gate's inputs.

### 6.5 Internal vs. user-facing feedback (fix #12)

Two, entirely separate mechanisms:

- **User-facing** (`application_user_feedback`, `verification_user_feedback`
  on `profile_account_state_v2`) — the *current* explanation shown to the
  applicant (e.g., "please retake your selfie with better lighting"),
  settable only by `review_application`/`review_verification`, readable
  by the owner via the §6.2 allowlist.
- **Internal** (`internal_note` on the two append-only log tables below) —
  never exposed anywhere; these tables have **zero grants to
  `authenticated` or `anon`**, not even `SELECT`. There is no column
  shared between the internal and external mechanisms, so there's no way
  a future grant change could conflate the two.

`verification_review_log` and the new `application_review_log` (fix #12's
explicit ask — Revision 1 only had the verification one) are both
append-only: `user_id, reviewer_id, old_status, new_status, internal_note,
created_at`, `INSERT`ed only by `review_verification`/`review_application`.

---

## 7. RPCs (full list)

Every RPC: `SECURITY DEFINER`, `search_path` fixed to `public, pg_temp`, an
explicit `auth.uid()` self-check for self-service RPCs, `EXECUTE` revoked
from `PUBLIC`/`anon`/`authenticated` and re-granted only where intended.

| # | RPC | Caller | Purpose |
|---|---|---|---|
| 7.1 | `set_onboarding_progress(p_user, p_status)` | self-only | `draft`/`in_progress` only — never `submitted` |
| 7.2 | `add_profile_photo`, `remove_profile_photo`, `set_primary_photo`, `swap_profile_photo_order` | self-only | the only way `profile_photos` is ever mutated (§3) |
| 7.3 | `add_profile_prompt`, `update_profile_prompt`, `remove_profile_prompt` | self-only | the only way `profile_prompts` is ever mutated (§4) |
| 7.4 | `submit_application(p_user)` | self-only | the real completion + array-integrity gate (§7.7) |
| 7.5 | `mark_verification_submitted(p_user, p_storage_path)` | self-only | the only client-triggerable `verification_status` transition; validates the Storage object (§7.6) |
| 7.6 | `review_verification(p_user, p_new_status, p_internal_note, p_user_feedback, p_reviewer)` | **service_role only** | writes state + append-only log |
| 7.7 | `review_application(p_user, p_new_status, p_internal_note, p_user_feedback, p_reviewer)` | **service_role only** | writes state + append-only log; guards on verification (§6.3) |
| 7.8 | `activate_membership(p_user, p_founding, p_expires_at)` | **service_role only** | guards on application acceptance (§6.3) |
| 7.9 | `get_my_contact_info()` | self-only, implicit | reads own `email`/`phone` from `auth.users` |

**Open item, unchanged from Revision 1:** 7.6–7.8 are `service_role`-only
because no formal reviewer role/table exists yet
(`docs/onboarding-v2-gap-analysis.md` §H #4) — run from a Dashboard
console or an internal Edge Function, not from the consumer app, matching
the project's existing manual photo-verification precedent.

### 7.6 Storage validation inside `mark_verification_submitted` (fix #11)

```sql
if p_storage_path !~ ('^' || p_user::text || '/') then raise exception ...;
select * into v_object from storage.objects
  where bucket_id = 'verification-selfies' and name = p_storage_path;
if v_object is null then raise exception ...;
if v_object.owner is not null and v_object.owner is distinct from p_user then raise exception ...;
```

An arbitrary/foreign path is rejected before `verification_status` ever
moves to `pending` — the RPC does not trust the client's claim that a
given path is a real, owned object; it checks `storage.objects` directly.
`add_profile_photo` applies the identical pattern for the `user-photos`
bucket (§3).

### 7.7 `submit_application` — array validation (fix #13)

In addition to Revision 1's presence checks (≥3 photos, ≥2 prompts,
required basic/lifestyle fields, complete `onboarding_answers_v2`,
`discovery_preferences_v2` complete), the RPC now also rejects a
submission if any array field contains duplicates —
`public.array_has_duplicates(arr)` (a small reusable `IMMUTABLE` helper:
`cardinality(arr) <> cardinality(array(select distinct unnest(arr)))`) is
checked against `pets_v2`, `availability_v2`, `meeting_environment_v2`,
`hobbies`, `languages`, and `interested_in_v2`. Allowed-value membership
(`<@ array[...]`) and the `everyone`/`no_pets` mutual-exclusivity rules
are enforced declaratively at write time via table `CHECK` constraints
(§5.1) — belt-and-suspenders: the `CHECK` is the real backstop (it can't
be bypassed by any write path at all), and the RPC's duplicate check adds
a legitimate, friendlier-error-message layer for the one thing a `CHECK`
constraint genuinely cannot express cleanly (distinct-count comparison is
possible in a `CHECK` but was judged clearer to centralize in one reusable
function called at submission time, per the brief's explicit instruction
to validate this "submission RPC'sinde").

---

## 8. Storage & V1-column audit (fix #2)

Re-read (not assumed) both existing Phase 0 migrations before writing this
revision:

- `supabase/migrations/20260920090000_lockdown_profiles_column_grants.sql`
  — the `UPDATE` allowlist. Confirmed this revision's new
  `grant update (...)` statement only adds the ten purely-cosmetic V2
  `profiles` columns (§1's public-facts table) and does **not** re-touch
  anything Phase 0 already locked down.
- `supabase/migrations/20260920091500_verification_selfies_private_bucket.sql`
  — the private bucket + own-folder policies. Confirmed these already
  satisfy "server/admin-readable only" as-is; nothing new needed at the
  Storage-policy level.

`profiles.verification_selfie_path` (V1) and the sync trigger Revision 1
proposed (`sync_photo_verified`, mirroring `verification_status` back onto
`profiles.photo_verified`) are **both removed from this revision**. V2
verification lives entirely in `profile_account_state_v2` now — per fix
#1, no operational field (and no operational *sync mechanism*, which is
just as much an "operational field" in spirit) writes to the public
`profiles` table anymore. `profiles.photo_verified` (V1 boolean) is left
exactly as V1 set it (via the existing manual-approval process) —
untouched, unsynced, frozen — since there is no longer any V2 write path
that touches it at all. This is a stricter reading of "don't add
operational fields to profiles" than Revision 1's compromise (which kept
a sync trigger writing to `profiles` for V1-code convenience); the
tradeoff is that a V1 code path reading `profiles.photo_verified` will not
reflect a V2 review outcome until that code is migrated to read
`profile_account_state_v2.verification_status` instead (tracked in §10's
file list) — an acceptable gap since no V1 code produces V2 accounts in
the first place during the period both systems coexist.

No V1 table or column is `DROP`ped anywhere in this migration — see §11
for the unchanged removal timeline.

---

## 9. Index plan (fix #14)

Revision 1 proposed plain btree indexes on `application_status`,
`membership_status`, a composite of the two, and `is_seed_data` — each a
column with single-digit cardinality, where a full index has weak
selectivity and adds write overhead for comparatively little query
benefit. Revision 2 replaces all four with **partial indexes** shaped
around the actual anticipated query, each considerably smaller than a
full index would be:

| Index | Predicate | Serves |
|---|---|---|
| `profile_account_state_v2_discovery_eligible_idx` | `application_status='accepted' AND membership_status='active' AND verification_status='verified'` | the discovery gate (§6.4) directly — the one combination that actually matters |
| `profile_account_state_v2_submitted_idx` | `application_status='submitted'` | reviewer queue |
| `profile_account_state_v2_verification_pending_idx` | `verification_status='pending'` | verification reviewer queue |
| `profile_account_state_v2_active_members_idx` | `membership_status='active'` | membership renewal/expiry scans (ordered by `membership_expires_at`) |
| `profile_account_state_v2_seed_data_idx` | `is_seed_data` (true only — the minority case queries actually filter for) | seed cleanup/audit |

Also removed vs. Revision 1: `onboarding_answers_v2.intent` (3-value
cardinality, no query pattern that benefits from a point-lookup index —
matching will scan the eligible candidate set wholesale regardless).
Matches this project's own established discipline (CLAUDE.md's 2026-09-08
note: "DB perf sorunlarında ilk adım her zaman `EXPLAIN ANALYZE` olmalı" —
don't index speculatively; add one later with real query-plan evidence if
a pattern actually needs it).

`profile_photos.user_id` and `profile_prompts.user_id` keep their plain
btree indexes — these are genuine high-cardinality FK lookup columns (many
distinct `user_id` values), not low-selectivity status flags, and Postgres
does not auto-index the referencing side of a foreign key (a documented,
pre-existing gap in this project noted in CLAUDE.md's 2026-09-13 advisor
review — this design doesn't repeat it for new tables).

---

## 10. Existing app code files that will need to change for V2

Inventory only — **no code in this list has been edited.**

**Onboarding flow (full rewrite expected, screen-by-screen):**
`app/profile-setup/step{1..4}/*.tsx` and their `lib/onboardingStep{1..4}Context.tsx`
— now additionally need to write to `profile_private_v2` (birthdate),
`discovery_preferences_v2` (preferences step), and call
`add_profile_photo`/`add_profile_prompt` instead of writing arrays
directly.

**Profile display/edit:**
- `app/profile-edit.tsx`, `lib/hingeProfile.ts`, `lib/labels.ts`,
  `lib/meetingVenues.ts`, `HingeProfileCard.tsx`, `components/home/*` —
  same as Revision 1's list, now also needing to read `profile_photos`
  instead of `profiles.photos` and never fetching raw `date_of_birth`
  directly (compute age/zodiac via the new SQL functions, or a future
  thin "my own profile" RPC).

**Filters:** `app/filters.tsx` — now reads/writes
`discovery_preferences_v2` (a different table, not new `profiles`
columns as Revision 1 assumed).

**Matching:** `get_top_matches` RPC (lives in Supabase, not a repo file)
needs a V2 sibling — tracked in `docs/matching-engine-v2.md`, still
explicitly out of scope here; it will need to join across `profiles`,
`profile_private_v2`, `discovery_preferences_v2`,
`profile_account_state_v2`, and `onboarding_answers_v2` where Revision 1
only anticipated joining `profiles` and `onboarding_answers_v2`.
`lib/matchReason.ts` — same as before.

**Verification:** `lib/onboardingStep1Context.tsx`'s
`uploadSelfieToSupabase` — needs to call `mark_verification_submitted()`
after upload (unchanged intent from Revision 1, now hitting a different
target table under the hood).

**Contact info:** `register.tsx`, `settings.tsx` — unchanged from
Revision 1.

**Not expected to need any change:** `lib/matchInvite.ts`, `chat.tsx`,
`messages.tsx`, `notifications.tsx`, `micro-intro.tsx`, `plan-detail.tsx`,
`app/(tabs)/matches.tsx` and `components/matches/*` — unchanged from
Revision 1, still true (the post-match funnel doesn't touch any table
this schema affects).

---

## 11. V1 → V2 removal timeline (unchanged from Revision 1)

Nothing is `DROP`ped in this migration. Removal happens later, in a
dedicated migration, only after (1) app code fully migrates to the V2
tables, (2) a verification window with real V2 accounts confirms no code
path still reads the frozen V1 columns/tables, at which point (3) a
separate, reviewable `DROP` migration removes them — never bundled with
additive work.

---

## 12. What this design deliberately does not do

- Does not write `get_top_matches_v2`.
- Does not move the V1 "advanced filter" columns
  (`discovery_zodiac_signs`, `discovery_education`,
  `discovery_verified_only`, `discovery_active_today`, `discovery_pets`)
  into `discovery_preferences_v2` — flagged as a good future candidate for
  the same privacy argument, not done here since it wasn't part of the
  requested fix set.
- Does not seed any data, create any auth account, or migrate any
  application code.
- Does not apply the proposed migration to any database.

**Stopping here for review, per the explicit instruction this revision was
requested under.**
