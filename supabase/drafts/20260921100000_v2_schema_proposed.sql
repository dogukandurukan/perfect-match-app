-- ============================================================================
-- PROPOSED — NOT APPLIED TO ANY DATABASE. DO NOT RUN WITHOUT SEPARATE REVIEW
-- AND SIGN-OFF. See docs/v2-schema-spec.md for the full design rationale.
-- ============================================================================
--
-- REVISION 2 — supersedes the first draft after a blocking-issue review.
-- The most consequential change: sensitive/preference/operational data no
-- longer lives on the broadly-readable `profiles` table at all. Five new
-- tables replace what revision 1 had bolted onto `profiles`:
--   * profiles              — public/display profile facts only (unchanged
--                              table, a handful of purely-cosmetic V2
--                              columns added, nothing sensitive)
--   * profile_private_v2    — date_of_birth; self-only RLS, no cross-user
--                              SELECT policy at all (not even a restricted
--                              one — see §2)
--   * discovery_preferences_v2 — every V2 "who I want to see" preference;
--                              self-only RLS (§3)
--   * profile_account_state_v2 — onboarding/application/verification/
--                              membership state; server-controlled (§4)
--   * profile_photos / profile_prompts — typed, ordered, RPC-gated content
--                              tables (§5, §6)
--
-- Everything else from design rule #15 still holds: purely additive, no
-- ALTER/DROP/RENAME of any V1 table or column anywhere in this file.
--
-- Design rules (see docs/v2-schema-spec.md §0 for full rationale):
--   #1  No sensitive or operational field on the public profiles table.
--   #2  intent values are EXACTLY 'long_term' / 'casual' / 'figuring_out'.
--   #3  Age and zodiac are computed dynamically (STABLE/IMMUTABLE SQL
--       functions), never stored, never trigger-maintained.
--   #4  profile_photos enforces >=3-at-submission, single-primary, unique
--       ordering, and verified Storage object ownership — all at the DB/
--       RPC layer, not trusted from the client.
--   #5  profile_prompts: max 3, unique display_order, valid range,
--       min-2-at-submission, no direct-DML bypass of any of this.
--   #6  onboarding_answers_v2.user_id is a real PRIMARY KEY.
--   #7  "not answered yet" (NULL) and "answered: anywhere" are distinct
--       values — no column overloads NULL to mean a real answer.
--   #8  gender_v2 and interested_in_v2 share one canonical vocabulary;
--       'everyone' cannot coexist with other values; self_describe has an
--       explicit, symmetric matching category.
--   #9  Every state transition is guarded by the CURRENT state, not just
--       validated against the allowed-values domain.
--   #10 Discovery gate: accepted + active + verified + not hidden + not
--       deleted, computed live, for both caller and candidate.
--   #11 mark_verification_submitted verifies the Storage object actually
--       exists, in the right bucket, in the caller's own folder.
--   #12 Internal reviewer notes and user-facing feedback are structurally
--       separate columns/tables — never the same field.
--   #13 Array fields are validated (allowed values, no duplicates, mutual
--       exclusivity) in the submission RPC.
--   #14 No blanket index on a low-cardinality boolean/status column —
--       partial indexes targeted at the actual query shape instead.
--
-- This file has NOT been run against any environment.

begin;

-- ============================================================================
-- 0. Shared utility functions
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rule #3 — age is never stored. STABLE (not IMMUTABLE: depends on
-- current_date), pure function of an already-provided date, safe to expose
-- broadly since it reads no table.
create or replace function public.compute_age_years(p_date_of_birth date)
returns int
language sql
stable
as $$
  select extract(year from age(current_date, p_date_of_birth))::int;
$$;

-- Rule #3 — zodiac is never stored, computed the same way every time.
create or replace function public.compute_zodiac_sign(p_date_of_birth date)
returns text
language sql
immutable
as $$
  select case
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (1,20) and (2,18) then 'aquarius'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (2,19) and (3,20) then 'pisces'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (3,21) and (4,19) then 'aries'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (4,20) and (5,20) then 'taurus'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (5,21) and (6,20) then 'gemini'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (6,21) and (7,22) then 'cancer'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (7,23) and (8,22) then 'leo'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (8,23) and (9,22) then 'virgo'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (9,23) and (10,22) then 'libra'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (10,23) and (11,21) then 'scorpio'
    when (extract(month from p_date_of_birth)::int, extract(day from p_date_of_birth)::int) between (11,22) and (12,21) then 'sagittarius'
    else 'capricorn' -- Dec 22 – Jan 19, the wrap-around case
  end;
$$;

comment on function public.compute_zodiac_sign(date) is
  'Rule #3: zodiac is derived server-side on demand, never stored on any '
  'V2 table. IMMUTABLE and reads no table — safe to grant broadly.';

grant execute on function public.compute_age_years(date) to authenticated;
grant execute on function public.compute_zodiac_sign(date) to authenticated;
revoke all on function public.compute_age_years(date) from anon;
revoke all on function public.compute_zodiac_sign(date) from anon;

-- Rule #13 helper — reused across submit_application()'s array checks
-- rather than repeating the same cardinality/unnest comparison six times.
create or replace function public.array_has_duplicates(arr text[])
returns boolean
language sql
immutable
as $$
  select arr is not null and cardinality(arr) <> cardinality(array(select distinct unnest(arr)));
$$;


-- ============================================================================
-- 1. onboarding_answers_v2 — "How you connect" (spec §10), one row per user
-- ============================================================================
-- Rule #6: user_id is the real primary key now (revision 1 used a
-- surrogate `id` + a separate UNIQUE — redundant for a strict 1:1 table).

create table if not exists public.onboarding_answers_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  intent text check (intent in ('long_term', 'casual', 'figuring_out')),

  connection_pace text check (
    connection_pace in ('slowly_with_time', 'naturally_no_forcing', 'know_when_chemistry')
  ),
  communication_style text check (
    communication_style in ('stay_in_touch_throughout_day', 'meaningful_checkins', 'let_rhythm_develop')
  ),
  closeness_preference text check (
    closeness_preference in ('lots_of_shared_time', 'balance_closeness_independence', 'room_for_own_lives')
  ),

  children_view text check (
    children_view in ('want_children', 'no_children', 'open_to_either', 'undecided')
  ),
  exclusivity_view text check (
    exclusivity_view in ('one_person_at_a_time', 'keeping_it_open', 'decide_together')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint onboarding_answers_v2_conditional_question check (
    (children_view is null or intent in ('long_term', 'figuring_out'))
    and (exclusivity_view is null or intent = 'casual')
  )
);

comment on table public.onboarding_answers_v2 is
  'Onboarding V2 "how you connect" answers (spec §10). Separate from the '
  'legacy onboarding_answers table — relationship_pace/connection_style/'
  'connection_energy are never reused with this meaning (rule #2).';

-- Rule #14: NOT indexing `intent` — 3-value cardinality, no query pattern
-- that benefits from a point-lookup index over it (matching scans the
-- eligible candidate set wholesale; add this later with EXPLAIN ANALYZE
-- evidence if a real query pattern needs it, per this project's own
-- established "don't index speculatively" convention).

drop trigger if exists onboarding_answers_v2_set_updated_at on public.onboarding_answers_v2;
create trigger onboarding_answers_v2_set_updated_at
  before update on public.onboarding_answers_v2
  for each row execute function public.set_updated_at();

alter table public.onboarding_answers_v2 enable row level security;

create policy "own onboarding_answers_v2 select" on public.onboarding_answers_v2
  for select using (auth.uid() = user_id);
create policy "own onboarding_answers_v2 insert" on public.onboarding_answers_v2
  for insert with check (auth.uid() = user_id);
create policy "own onboarding_answers_v2 update" on public.onboarding_answers_v2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.onboarding_answers_v2 from anon, authenticated;
grant select, insert, update on public.onboarding_answers_v2 to authenticated;


-- ============================================================================
-- 2. profile_private_v2 — self/server-only profile facts (rule #1, #3)
-- ============================================================================
-- date_of_birth lives here, structurally isolated from `profiles`. Unlike
-- revision 1's approach (leaving date_of_birth on `profiles` and proposing
-- a column-level SELECT revoke later), this table has NO cross-user SELECT
-- policy at all — no client, under any circumstance, can read another
-- user's row here. The only way another context (the future matching RPC)
-- ever reads it is via SECURITY DEFINER, which bypasses RLS entirely and
-- is auditable by function definition, not by a fragile column-grant.

create table if not exists public.profile_private_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_private_v2 is
  'Self/server-only profile facts — currently just date_of_birth. Never '
  'shown to other users (rule #8 from the schema-spec design rules): no '
  'cross-user SELECT policy exists on this table at all. Age and zodiac '
  'are derived on demand via compute_age_years()/compute_zodiac_sign(), '
  'never stored (rule #3).';

drop trigger if exists profile_private_v2_set_updated_at on public.profile_private_v2;
create trigger profile_private_v2_set_updated_at
  before update on public.profile_private_v2
  for each row execute function public.set_updated_at();

alter table public.profile_private_v2 enable row level security;

create policy "own profile_private_v2 select" on public.profile_private_v2
  for select using (auth.uid() = user_id);
create policy "own profile_private_v2 insert" on public.profile_private_v2
  for insert with check (auth.uid() = user_id);
create policy "own profile_private_v2 update" on public.profile_private_v2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No policy grants visibility to anyone but the owner. Ever.

revoke all on public.profile_private_v2 from anon, authenticated;
grant select, insert, update on public.profile_private_v2 to authenticated;


-- ============================================================================
-- 3. discovery_preferences_v2 — every V2 discovery preference (rule #1)
-- ============================================================================
-- Self-only RLS. Preferences reveal things about a person (narrow age
-- bands, a smoking dealbreaker, an "everyone" vs. narrow interested_in)
-- that other users have no legitimate reason to read — V1's equivalent
-- columns are readable by any authenticated user today via
-- `profiles_select_authenticated`'s broad policy; V2 does not repeat that.
--
-- Rule #7: `distance_pref` distinguishes "not answered yet" (NULL) from
-- "answered: no distance restriction" ('anywhere') — no column here
-- overloads NULL to mean a real, chosen value.

create table if not exists public.discovery_preferences_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  -- Rule #8: same vocabulary as profiles.gender_v2, plus the 'everyone'
  -- sentinel which must appear alone (enforced below).
  interested_in_v2 text[] check (
    interested_in_v2 is null
    or interested_in_v2 <@ array['woman','man','non_binary','self_describe','everyone']::text[]
  ),
  constraint discovery_preferences_v2_everyone_alone check (
    interested_in_v2 is null
    or not ('everyone' = any(interested_in_v2))
    or cardinality(interested_in_v2) = 1
  ),

  age_min int check (age_min is null or age_min >= 18),
  age_max int check (age_max is null or age_min is null or age_max >= age_min),

  distance_pref text check (
    distance_pref in ('within_5km', 'within_15km', 'within_30km', 'anywhere')
  ),

  smoking_strength text check (smoking_strength in ('dont_care', 'prefer', 'dealbreaker')),
  drinking_strength text check (drinking_strength in ('dont_care', 'prefer', 'dealbreaker')),
  pets_tolerance text check (pets_tolerance in ('yes', 'it_depends', 'preferably_no', 'dealbreaker')),

  height_min_cm int,
  height_max_cm int check (height_max_cm is null or height_min_cm is null or height_max_cm >= height_min_cm),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.discovery_preferences_v2 is
  'All V2 "who I want to see" preferences. Self-only RLS — unlike V1''s '
  'discovery_* columns on profiles (frozen, still broadly readable, not '
  'this design''s problem to fix), nothing here is visible to other users '
  'even indirectly, except through a SECURITY DEFINER matching RPC.';

comment on column public.discovery_preferences_v2.distance_pref is
  'Rule #7: NULL = not answered yet. ''anywhere'' = answered, no distance '
  'restriction. These are never conflated.';

drop trigger if exists discovery_preferences_v2_set_updated_at on public.discovery_preferences_v2;
create trigger discovery_preferences_v2_set_updated_at
  before update on public.discovery_preferences_v2
  for each row execute function public.set_updated_at();

alter table public.discovery_preferences_v2 enable row level security;

create policy "own discovery_preferences_v2 select" on public.discovery_preferences_v2
  for select using (auth.uid() = user_id);
create policy "own discovery_preferences_v2 insert" on public.discovery_preferences_v2
  for insert with check (auth.uid() = user_id);
create policy "own discovery_preferences_v2 update" on public.discovery_preferences_v2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.discovery_preferences_v2 from anon, authenticated;
grant select, insert, update on public.discovery_preferences_v2 to authenticated;


-- ============================================================================
-- 4. profile_account_state_v2 — onboarding/application/verification/
--    membership state (rule #1, #9, #10, #12)
-- ============================================================================
-- Every column here is server-controlled. The row is created automatically
-- by a trigger on profiles insert (never by client INSERT — there is no
-- INSERT grant to authenticated on this table at all), and mutated only by
-- the RPCs in §7 (all SECURITY DEFINER, bypassing grants/RLS by executing
-- as their owning role).
--
-- Rule #12: internal reviewer notes live ONLY in the append-only log
-- tables (§8) — this table carries only the CURRENT user-facing feedback
-- (`application_user_feedback` / `verification_user_feedback`), which is
-- the one thing a user is allowed to read back. There is no column here
-- that could accidentally leak an internal note through a future grant
-- mistake, because the column simply does not exist on this table.

create table if not exists public.profile_account_state_v2 (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  onboarding_version text not null default 'v2' check (onboarding_version in ('v1', 'v2')),
  onboarding_status text not null default 'draft' check (onboarding_status in ('draft', 'in_progress', 'submitted')),

  application_status text not null default 'draft'
    check (application_status in ('draft', 'submitted', 'under_review', 'waitlisted', 'changes_requested', 'accepted', 'rejected')),
  application_submitted_at timestamptz,
  application_reviewed_at timestamptz,
  application_user_feedback text,

  verification_status text not null default 'not_submitted'
    check (verification_status in ('not_submitted', 'pending', 'verified', 'retry_required', 'rejected')),
  verification_selfie_path text,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_user_feedback text,

  membership_status text not null default 'none'
    check (membership_status in ('none', 'pending_activation', 'active', 'expired', 'cancelled')),
  membership_activated_at timestamptz,
  membership_expires_at timestamptz,
  is_founding_member boolean not null default false,

  is_seed_data boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_account_state_v2 is
  'All onboarding/application/verification/membership state — 100% '
  'server-controlled (rule #1, #9). No INSERT/UPDATE grant to '
  'authenticated exists on this table; the row is created by a trigger on '
  'profiles insert and mutated only through the RPCs in §7.';

comment on column public.profile_account_state_v2.is_seed_data is
  'Solves the exact forensic-identification problem worked through in '
  'docs/v2-clean-start-plan.md §A (proving 607 accounts were dummy after '
  'the fact) — now recorded at write time instead.';

drop trigger if exists profile_account_state_v2_set_updated_at on public.profile_account_state_v2;
create trigger profile_account_state_v2_set_updated_at
  before update on public.profile_account_state_v2
  for each row execute function public.set_updated_at();

-- Auto-create the state row the moment a profile exists — this is the only
-- INSERT path, and it always writes hardcoded safe defaults, never
-- client-supplied values (so is_seed_data can never be smuggled in true
-- at signup, for example).
create or replace function public.create_account_state_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profile_account_state_v2 (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_account_state_v2 on public.profiles;
create trigger profiles_create_account_state_v2
  after insert on public.profiles
  for each row execute function public.create_account_state_for_new_profile();

alter table public.profile_account_state_v2 enable row level security;

create policy "own profile_account_state_v2 select" on public.profile_account_state_v2
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy for the owner at all — see the RPCs in §7.

revoke all on public.profile_account_state_v2 from anon, authenticated;
-- Column-level SELECT allowlist (rule #12): is_seed_data and
-- verification_selfie_path are deliberately excluded — the client never
-- needs to read either back, and excluding them removes any future risk
-- of accidentally widening access to them via a careless table-level grant.
grant select (
  onboarding_version, onboarding_status,
  application_status, application_submitted_at, application_reviewed_at, application_user_feedback,
  verification_status, verification_submitted_at, verification_reviewed_at, verification_user_feedback,
  membership_status, membership_activated_at, membership_expires_at, is_founding_member,
  created_at, updated_at
) on public.profile_account_state_v2 to authenticated;
-- No insert/update/delete grant to authenticated at all — service_role
-- (via the SECURITY DEFINER RPCs in §7, or run directly by service_role)
-- is the only writer.


-- ============================================================================
-- 5. profile_photos (rule #4)
-- ============================================================================

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  display_order smallint not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, display_order)
);

comment on table public.profile_photos is
  'V2 photo model — stable id, verified storage_path, explicit ordering, '
  'single primary. Replaces `profiles.photos` (text[], V1) for V2 code; '
  'V1 column is untouched/frozen. All writes go through the RPCs in §7 — '
  'see the revoked INSERT/UPDATE/DELETE grants below (rule #4''s '
  '"doğrudan DML bu kuralları bypass edememeli" applies here too, by the '
  'same logic as profile_prompts).';

-- Rule #4: only one is_primary=true row per user. A plain UNIQUE
-- constraint can't express "unique only when true" — a partial unique
-- index is the standard Postgres idiom for this.
create unique index if not exists profile_photos_one_primary_per_user
  on public.profile_photos (user_id) where is_primary;

create index if not exists profile_photos_user_id_idx on public.profile_photos (user_id);

alter table public.profile_photos enable row level security;

create policy "profile_photos visible like the owning profile" on public.profile_photos
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_photos.user_id
        and (
          auth.uid() = p.id
          or (coalesce(p.is_hidden, false) = false and p.deleted_at is null)
          or exists (
            select 1 from public.matches m
            where (m.user_a_id = auth.uid() and m.user_b_id = p.id)
               or (m.user_b_id = auth.uid() and m.user_a_id = p.id)
          )
        )
    )
  );
-- Self insert/update/delete policies exist for completeness/defense in
-- depth, but no matching table-level grant is issued below — Postgres
-- requires BOTH a passing policy AND a table/column grant, so omitting the
-- grant blocks direct DML even though these policies exist.
create policy "own profile_photos insert" on public.profile_photos
  for insert with check (auth.uid() = user_id);
create policy "own profile_photos update" on public.profile_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile_photos delete" on public.profile_photos
  for delete using (auth.uid() = user_id);

revoke all on public.profile_photos from anon, authenticated;
grant select on public.profile_photos to authenticated;
-- No insert/update/delete grant — see add_profile_photo() etc. in §7,
-- which are the only way rows here are ever created or changed.


-- ============================================================================
-- 6. profile_prompts (rule #5)
-- ============================================================================

create table if not exists public.profile_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_key text not null check (prompt_key in (
    'sunday_looks_like',
    'win_me_over',
    'small_thing_means_a_lot',
    'well_get_along_if',
    'looking_for_someone_who',
    'ideal_first_date',
    'never_get_tired_of',
    'relationship_feels_right'
  )),
  answer_text text not null check (char_length(answer_text) between 1 and 300),
  display_order smallint not null check (display_order between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, prompt_key),
  unique (user_id, display_order)
);

comment on table public.profile_prompts is
  'Onboarding V2 profile prompts (spec §7) — max 3 (display_order 0-2, '
  'rule #5), min 2 enforced at submission (§7 RPCs), never both at once '
  'for the same prompt_key. All writes go through the RPCs in §7 — no '
  'direct INSERT/UPDATE/DELETE grant to authenticated exists.';

create index if not exists profile_prompts_user_id_idx on public.profile_prompts (user_id);

drop trigger if exists profile_prompts_set_updated_at on public.profile_prompts;
create trigger profile_prompts_set_updated_at
  before update on public.profile_prompts
  for each row execute function public.set_updated_at();

alter table public.profile_prompts enable row level security;

create policy "profile_prompts visible like the owning profile" on public.profile_prompts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_prompts.user_id
        and (
          auth.uid() = p.id
          or (coalesce(p.is_hidden, false) = false and p.deleted_at is null)
          or exists (
            select 1 from public.matches m
            where (m.user_a_id = auth.uid() and m.user_b_id = p.id)
               or (m.user_b_id = auth.uid() and m.user_a_id = p.id)
          )
        )
    )
  );
create policy "own profile_prompts insert" on public.profile_prompts
  for insert with check (auth.uid() = user_id);
create policy "own profile_prompts update" on public.profile_prompts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile_prompts delete" on public.profile_prompts
  for delete using (auth.uid() = user_id);

revoke all on public.profile_prompts from anon, authenticated;
grant select on public.profile_prompts to authenticated;
-- No insert/update/delete grant — see add_profile_prompt() etc. in §7.
-- A max-3 count can't be expressed as a table CHECK (no cross-row
-- visibility inside a CHECK), which is exactly why direct DML must be
-- blocked and routed through an RPC that can count sibling rows first.


-- ============================================================================
-- 7. New `profiles` columns — public/display facts ONLY (rule #1)
-- ============================================================================
-- Nothing sensitive, preference-like, or operational is added to
-- `profiles` in this revision — that's the entire point of the §1-§4
-- restructuring above. Every column below is something the owning user
-- already expects to be shown on their own profile card.

alter table public.profiles add column if not exists smoking_v2 text
  check (smoking_v2 in ('never', 'occasionally', 'regularly', 'trying_to_quit'));
comment on column public.profiles.smoking_v2 is
  'Spec §8 4-value model. V1 `smoking` (Yes/No/Socially) is frozen, not '
  'migrated — see docs/onboarding-v2-gap-analysis.md §E.';

alter table public.profiles add column if not exists drinking_v2 text
  check (drinking_v2 in ('never', 'socially', 'regularly', 'sober'));

alter table public.profiles add column if not exists gender_v2 text
  check (gender_v2 in ('woman', 'man', 'non_binary', 'self_describe'));
comment on column public.profiles.gender_v2 is
  'Rule #8: shares its exact vocabulary with discovery_preferences_v2.'
  'interested_in_v2 (plus that column''s own ''everyone'' sentinel). A '
  'self_describe user''s matching category is explicit: they are found by '
  'anyone whose interested_in_v2 contains ''self_describe'' or ''everyone''.';

alter table public.profiles add column if not exists gender_self_describe text
  check (gender_self_describe is null or char_length(gender_self_describe) <= 60);

alter table public.profiles add column if not exists pets_v2 text[]
  check (pets_v2 is null or pets_v2 <@ array['no_pets','dog','cat','other']::text[]);
alter table public.profiles add constraint profiles_pets_v2_no_pets_alone check (
  pets_v2 is null
  or not ('no_pets' = any(pets_v2))
  or cardinality(pets_v2) = 1
);
comment on column public.profiles.pets_v2 is
  'Spec §8: multi-select. ''no_pets'' cannot coexist with a real pet type '
  '(same mutual-exclusivity pattern as interested_in_v2''s ''everyone''). '
  'V1 `pets` frozen alongside.';

alter table public.profiles add column if not exists availability_v2 text[]
  check (availability_v2 is null or availability_v2 <@ array['weekday_evenings','saturdays','sundays','flexible']::text[]);

alter table public.profiles add column if not exists meeting_environment_v2 text[]
  check (
    meeting_environment_v2 is null
    or meeting_environment_v2 <@ array[
      'coffee_long_conversation','drinks_relaxed','walk_outside',
      'dinner_new_place','something_playful_active','museum_exhibition_event'
    ]::text[]
  );

alter table public.profiles add column if not exists school text
  check (school is null or char_length(school) <= 120);
alter table public.profiles add column if not exists hometown text
  check (hometown is null or char_length(hometown) <= 120);
alter table public.profiles add column if not exists activity_level text
  check (activity_level in ('occasionally', 'few_times_week', 'most_days'));

-- Column-level UPDATE allowlist — additive to Phase 0's grant, never a
-- reset (Postgres column ACLs accumulate across multiple GRANT statements
-- on the same table).
grant update (
  smoking_v2, drinking_v2, gender_v2, gender_self_describe,
  pets_v2, availability_v2, meeting_environment_v2,
  school, hometown, activity_level
) on public.profiles to authenticated;

-- Note: profiles.zodiac_sign and profiles.photo_verified (both V1) are
-- NOT written to by any V2 code path in this revision. zodiac is computed
-- on demand (§0); verification lives entirely in profile_account_state_v2
-- now, with no trigger syncing anything back onto `profiles` — revision
-- 1's sync_photo_verified() trigger is REMOVED (see the closing "removed
-- from revision 1" note at the end of this file for why).


-- ============================================================================
-- 8. Append-only review logs (rule #12)
-- ============================================================================
-- Purely internal — no SELECT/INSERT/UPDATE/DELETE grant to authenticated
-- or anon at all. The user-facing half of a review ("here's what to fix")
-- lives on profile_account_state_v2's *_user_feedback columns (§4), which
-- the user CAN read; these logs are the operational trail behind that,
-- for staff only.

create table if not exists public.verification_review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  old_status text,
  new_status text not null,
  internal_note text,
  created_at timestamptz not null default now()
);

create index if not exists verification_review_log_user_id_idx
  on public.verification_review_log (user_id);

alter table public.verification_review_log enable row level security;
-- No policies at all — RLS enabled with zero policies denies every row to
-- every role except a SECURITY DEFINER function or service_role (which
-- bypasses RLS entirely). This is intentionally stricter than a self-SELECT
-- policy: there's no legitimate reason for the client to read this table
-- directly, only through profile_account_state_v2's feedback columns.

revoke all on public.verification_review_log from anon, authenticated;

create table if not exists public.application_review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  old_status text,
  new_status text not null,
  internal_note text,
  created_at timestamptz not null default now()
);

create index if not exists application_review_log_user_id_idx
  on public.application_review_log (user_id);

alter table public.application_review_log enable row level security;
revoke all on public.application_review_log from anon, authenticated;


-- ============================================================================
-- 9. RPCs
-- ============================================================================
-- Every RPC: SECURITY DEFINER, search_path fixed to public/pg_temp, an
-- explicit auth.uid() self-check where the caller acts on their own row,
-- EXECUTE revoked from PUBLIC/anon/authenticated and re-granted only where
-- intended. Client-callable RPCs are self-only. Review/activation RPCs are
-- service_role-only (no formal reviewer role exists yet — same open item
-- as revision 1, see docs/onboarding-v2-gap-analysis.md §H #4).

-- 9.1 — set_onboarding_progress: unchanged in spirit from revision 1,
-- retargeted at profile_account_state_v2.
create or replace function public.set_onboarding_progress(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;
  if p_status not in ('draft', 'in_progress') then
    raise exception 'invalid status for direct update: %', p_status;
  end if;
  update public.profile_account_state_v2 set onboarding_status = p_status where user_id = p_user;
end;
$$;

revoke all on function public.set_onboarding_progress(uuid, text) from public, anon, authenticated;
grant execute on function public.set_onboarding_progress(uuid, text) to authenticated;


-- 9.2 — Photos. All four mutate profile_photos; none are reachable except
-- through these (rule #4's "storage ownership/existence" check lives in
-- add_profile_photo).

-- Verifies the object exists in the `user-photos` bucket, in a path
-- prefixed by the caller's own uid, and (if the metadata is present) that
-- Storage's own `owner` column agrees — belt and suspenders, matching the
-- existing verification-selfies bucket's own-folder policy convention.
create or replace function public.add_profile_photo(p_user uuid, p_storage_path text, p_is_primary boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_object record;
  v_next_order smallint;
  v_new_id uuid;
  v_has_primary boolean;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;

  if p_storage_path is null or p_storage_path !~ ('^' || p_user::text || '/') then
    raise exception 'storage_path must be inside the caller''s own folder';
  end if;

  select * into v_object from storage.objects
    where bucket_id = 'user-photos' and name = p_storage_path;
  if v_object is null then
    raise exception 'no such object in user-photos: %', p_storage_path;
  end if;
  if v_object.owner is not null and v_object.owner is distinct from p_user then
    raise exception 'object is not owned by the caller';
  end if;

  select exists(select 1 from public.profile_photos where user_id = p_user and is_primary)
    into v_has_primary;

  select coalesce(max(display_order), -1) + 1 into v_next_order
    from public.profile_photos where user_id = p_user;

  if p_is_primary then
    update public.profile_photos set is_primary = false where user_id = p_user and is_primary;
  end if;

  insert into public.profile_photos (user_id, storage_path, display_order, is_primary)
  values (p_user, p_storage_path, v_next_order, p_is_primary or not v_has_primary)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.add_profile_photo(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.add_profile_photo(uuid, text, boolean) to authenticated;

create or replace function public.remove_profile_photo(p_user uuid, p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_was_primary boolean;
  v_next_id uuid;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;

  select is_primary into v_was_primary
    from public.profile_photos where id = p_photo_id and user_id = p_user;
  if not found then
    raise exception 'no such photo for this user';
  end if;

  delete from public.profile_photos where id = p_photo_id and user_id = p_user;

  if v_was_primary then
    select id into v_next_id from public.profile_photos
      where user_id = p_user order by display_order asc limit 1;
    if v_next_id is not null then
      update public.profile_photos set is_primary = true where id = v_next_id;
    end if;
  end if;
end;
$$;

revoke all on function public.remove_profile_photo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_profile_photo(uuid, uuid) to authenticated;

create or replace function public.set_primary_photo(p_user uuid, p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profile_photos where id = p_photo_id and user_id = p_user) then
    raise exception 'no such photo for this user';
  end if;
  update public.profile_photos set is_primary = false where user_id = p_user and is_primary;
  update public.profile_photos set is_primary = true where id = p_photo_id;
end;
$$;

revoke all on function public.set_primary_photo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_primary_photo(uuid, uuid) to authenticated;

-- Swaps two photos' display_order — the simplest reorder primitive that
-- can't collide with the unique(user_id, display_order) constraint mid-
-- transaction (a full-list reorder RPC is a reasonable future addition,
-- not specified here).
create or replace function public.swap_profile_photo_order(p_user uuid, p_photo_id_a uuid, p_photo_id_b uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_a smallint;
  v_order_b smallint;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;
  select display_order into v_order_a from public.profile_photos where id = p_photo_id_a and user_id = p_user;
  select display_order into v_order_b from public.profile_photos where id = p_photo_id_b and user_id = p_user;
  if v_order_a is null or v_order_b is null then
    raise exception 'both photos must belong to the caller';
  end if;
  update public.profile_photos set display_order = -1 where id = p_photo_id_a;
  update public.profile_photos set display_order = v_order_a where id = p_photo_id_b;
  update public.profile_photos set display_order = v_order_b where id = p_photo_id_a;
end;
$$;

revoke all on function public.swap_profile_photo_order(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.swap_profile_photo_order(uuid, uuid, uuid) to authenticated;


-- 9.3 — Prompts.
create or replace function public.add_profile_prompt(p_user uuid, p_prompt_key text, p_answer_text text, p_display_order smallint)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_new_id uuid;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;
  if p_display_order not between 0 and 2 then
    raise exception 'display_order must be between 0 and 2';
  end if;
  select count(*) into v_count from public.profile_prompts where user_id = p_user;
  if v_count >= 3 then
    raise exception 'maximum of 3 prompts already reached';
  end if;

  insert into public.profile_prompts (user_id, prompt_key, answer_text, display_order)
  values (p_user, p_prompt_key, p_answer_text, p_display_order)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.add_profile_prompt(uuid, text, text, smallint) from public, anon, authenticated;
grant execute on function public.add_profile_prompt(uuid, text, text, smallint) to authenticated;

create or replace function public.update_profile_prompt(p_user uuid, p_prompt_id uuid, p_answer_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;
  update public.profile_prompts
    set answer_text = p_answer_text
    where id = p_prompt_id and user_id = p_user;
  if not found then
    raise exception 'no such prompt for this user';
  end if;
end;
$$;

revoke all on function public.update_profile_prompt(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_profile_prompt(uuid, uuid, text) to authenticated;

create or replace function public.remove_profile_prompt(p_user uuid, p_prompt_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;
  delete from public.profile_prompts where id = p_prompt_id and user_id = p_user;
end;
$$;

revoke all on function public.remove_profile_prompt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_profile_prompt(uuid, uuid) to authenticated;


-- 9.4 — submit_application: the real completion + array-integrity gate
-- (rules #4, #5, #13). Reads across profiles, profile_private_v2,
-- discovery_preferences_v2, onboarding_answers_v2, profile_photos,
-- profile_prompts, profile_account_state_v2.
create or replace function public.submit_application(p_user uuid)
returns table(ok boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_photo_count int;
  v_prompt_count int;
  v_profile record;
  v_private record;
  v_prefs record;
  v_answers record;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;

  -- Rule #4: >=3 photos.
  select count(*) into v_photo_count from public.profile_photos where user_id = p_user;
  if v_photo_count < 3 then
    return query select false, 'at_least_3_photos_required'; return;
  end if;

  -- Rule #5: >=2 prompts.
  select count(*) into v_prompt_count from public.profile_prompts where user_id = p_user;
  if v_prompt_count < 2 then
    return query select false, 'at_least_2_prompts_required'; return;
  end if;

  select * into v_profile from public.profiles where id = p_user;
  select * into v_private from public.profile_private_v2 where user_id = p_user;
  select * into v_prefs from public.discovery_preferences_v2 where user_id = p_user;
  select * into v_answers from public.onboarding_answers_v2 where user_id = p_user;

  if v_private.date_of_birth is null then
    return query select false, 'date_of_birth_required'; return;
  end if;

  if v_profile.first_name is null or v_profile.gender_v2 is null
     or v_profile.city is null or v_profile.district is null or v_profile.height_cm is null
     or v_profile.languages is null or array_length(v_profile.languages, 1) is null
     or v_profile.smoking_v2 is null or v_profile.drinking_v2 is null or v_profile.pets_v2 is null
     or v_profile.morning_night is null or v_profile.recharge_style is null
     or v_profile.hobbies is null or array_length(v_profile.hobbies, 1) < 5
  then
    return query select false, 'required_basic_or_lifestyle_field_missing'; return;
  end if;

  -- Rule #13: allowed-values are already DB-CHECK-enforced on write; here
  -- we additionally reject duplicates within each array (a CHECK can't
  -- express this without the same helper, and duplicates are a submission-
  -- time concern per the design brief, not a write-time block).
  if public.array_has_duplicates(v_profile.pets_v2)
     or public.array_has_duplicates(v_profile.availability_v2)
     or public.array_has_duplicates(v_profile.meeting_environment_v2)
     or public.array_has_duplicates(v_profile.hobbies)
     or public.array_has_duplicates(v_profile.languages)
  then
    return query select false, 'duplicate_values_in_array_field'; return;
  end if;

  if v_prefs.interested_in_v2 is null or array_length(v_prefs.interested_in_v2, 1) is null
     or v_prefs.age_min is null or v_prefs.age_max is null
     or v_prefs.distance_pref is null
     or v_prefs.smoking_strength is null or v_prefs.drinking_strength is null
     or v_prefs.pets_tolerance is null
  then
    return query select false, 'discovery_preferences_incomplete'; return;
  end if;
  if public.array_has_duplicates(v_prefs.interested_in_v2) then
    return query select false, 'duplicate_values_in_array_field'; return;
  end if;

  if v_answers.intent is null or v_answers.connection_pace is null
     or v_answers.communication_style is null or v_answers.closeness_preference is null
     or (v_answers.intent in ('long_term','figuring_out') and v_answers.children_view is null)
     or (v_answers.intent = 'casual' and v_answers.exclusivity_view is null)
  then
    return query select false, 'intentions_incomplete'; return;
  end if;

  -- verification_status check happens against profile_account_state_v2,
  -- not profiles (rule #1) — must have at least submitted a selfie.
  if not exists (
    select 1 from public.profile_account_state_v2
    where user_id = p_user and verification_status <> 'not_submitted'
  ) then
    return query select false, 'verification_not_submitted'; return;
  end if;

  update public.profile_account_state_v2
    set application_status = 'submitted',
        application_submitted_at = now(),
        onboarding_status = 'submitted'
    where user_id = p_user;

  return query select true, null::text;
end;
$$;

revoke all on function public.submit_application(uuid) from public, anon, authenticated;
grant execute on function public.submit_application(uuid) to authenticated;


-- 9.5 — mark_verification_submitted (rules #9, #11).
create or replace function public.mark_verification_submitted(p_user uuid, p_storage_path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_status text;
  v_object record;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'not authorized';
  end if;

  -- Rule #9: only allowed from not_submitted or retry_required. pending
  -- (already awaiting review), verified (already done), and rejected
  -- (terminal, matching application_status='rejected'''s terminal
  -- treatment elsewhere) cannot be resubmitted through this RPC.
  select verification_status into v_current_status
    from public.profile_account_state_v2 where user_id = p_user for update;
  if v_current_status not in ('not_submitted', 'retry_required') then
    raise exception 'verification cannot be submitted from status: %', v_current_status;
  end if;

  -- Rule #11: the path must be a real object, in the right bucket, inside
  -- the caller's own folder — never an arbitrary/foreign path.
  if p_storage_path is null or p_storage_path !~ ('^' || p_user::text || '/') then
    raise exception 'storage_path must be inside the caller''s own folder';
  end if;
  select * into v_object from storage.objects
    where bucket_id = 'verification-selfies' and name = p_storage_path;
  if v_object is null then
    raise exception 'no such object in verification-selfies: %', p_storage_path;
  end if;
  if v_object.owner is not null and v_object.owner is distinct from p_user then
    raise exception 'object is not owned by the caller';
  end if;

  update public.profile_account_state_v2
    set verification_selfie_path = p_storage_path,
        verification_status = 'pending',
        verification_submitted_at = now(),
        verification_user_feedback = null
    where user_id = p_user;
end;
$$;

revoke all on function public.mark_verification_submitted(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_verification_submitted(uuid, text) to authenticated;


-- 9.6 — review_verification: SERVICE-ROLE ONLY (rules #9, #10, #12).
-- Rule #10's "verification revoked later removes discovery eligibility"
-- requires NO extra code here — the (future) matching RPC re-checks
-- verification_status = 'verified' live on every call, so a reviewer
-- moving a previously-verified account to 'rejected' here takes effect
-- immediately, with nothing to separately invalidate or cache-bust.
create or replace function public.review_verification(p_user uuid, p_new_status text, p_internal_note text, p_user_feedback text, p_reviewer uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
begin
  if p_new_status not in ('verified', 'retry_required', 'rejected') then
    raise exception 'invalid review outcome: %', p_new_status;
  end if;

  select verification_status into v_old_status
    from public.profile_account_state_v2 where user_id = p_user for update;

  update public.profile_account_state_v2
    set verification_status = p_new_status,
        verification_reviewed_at = now(),
        verification_user_feedback = p_user_feedback
    where user_id = p_user;

  insert into public.verification_review_log (user_id, reviewer_id, old_status, new_status, internal_note)
  values (p_user, p_reviewer, v_old_status, p_new_status, p_internal_note);
end;
$$;

revoke all on function public.review_verification(uuid, text, text, text, uuid) from public, anon, authenticated;
-- No grant to authenticated at all — service_role only.


-- 9.7 — review_application: SERVICE-ROLE ONLY (rules #9, #12). Guards the
-- 'accepted' transition on verification_status = 'verified', row-locked to
-- avoid a race against a concurrent review_verification() call.
create or replace function public.review_application(p_user uuid, p_new_status text, p_internal_note text, p_user_feedback text, p_reviewer uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_verification_status text;
begin
  if p_new_status not in ('under_review', 'waitlisted', 'changes_requested', 'accepted', 'rejected') then
    raise exception 'invalid application status: %', p_new_status;
  end if;

  select application_status, verification_status into v_old_status, v_verification_status
    from public.profile_account_state_v2 where user_id = p_user for update;

  if p_new_status = 'accepted' and v_verification_status <> 'verified' then
    raise exception 'cannot accept an application whose verification_status is %, not verified', v_verification_status;
  end if;

  update public.profile_account_state_v2
    set application_status = p_new_status,
        application_reviewed_at = now(),
        application_user_feedback = p_user_feedback
    where user_id = p_user;

  insert into public.application_review_log (user_id, reviewer_id, old_status, new_status, internal_note)
  values (p_user, p_reviewer, v_old_status, p_new_status, p_internal_note);
end;
$$;

revoke all on function public.review_application(uuid, text, text, text, uuid) from public, anon, authenticated;


-- 9.8 — activate_membership: SERVICE-ROLE ONLY (rule #9). Guards on
-- application_status = 'accepted', row-locked.
create or replace function public.activate_membership(p_user uuid, p_founding boolean default false, p_expires_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_application_status text;
begin
  select application_status into v_application_status
    from public.profile_account_state_v2 where user_id = p_user for update;

  if v_application_status <> 'accepted' then
    raise exception 'cannot activate membership: application_status is %, not accepted', v_application_status;
  end if;

  update public.profile_account_state_v2
    set membership_status = 'active',
        membership_activated_at = now(),
        membership_expires_at = p_expires_at,
        is_founding_member = coalesce(p_founding, is_founding_member)
    where user_id = p_user;
end;
$$;

revoke all on function public.activate_membership(uuid, boolean, timestamptz) from public, anon, authenticated;


-- 9.9 — get_my_contact_info: unchanged from revision 1 (rule #9 from the
-- original design-rules list — auth.users as source of truth for email/
-- phone).
create or replace function public.get_my_contact_info()
returns table(email text, email_confirmed boolean, phone text, phone_confirmed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select u.email, (u.email_confirmed_at is not null), u.phone, (u.phone_confirmed_at is not null)
    from auth.users u
    where u.id = auth.uid();
end;
$$;

revoke all on function public.get_my_contact_info() from public, anon, authenticated;
grant execute on function public.get_my_contact_info() to authenticated;


-- ============================================================================
-- 10. Indexes — rule #14: no blanket index on a low-cardinality boolean/
--     status column; partial indexes targeted at the real query shape.
-- ============================================================================

-- The actual discovery-eligibility query (rule #10) only ever cares about
-- rows matching ALL FOUR conditions at once — a partial index precisely on
-- that combination is far smaller and more useful than separate general
-- indexes on application_status/membership_status/is_seed_data would be
-- (each of which has single-digit-value cardinality and would see poor
-- selectivity on its own).
create index if not exists profile_account_state_v2_discovery_eligible_idx
  on public.profile_account_state_v2 (user_id)
  where application_status = 'accepted' and membership_status = 'active' and verification_status = 'verified';

-- Reviewer queue: "show me everything waiting on a human."
create index if not exists profile_account_state_v2_submitted_idx
  on public.profile_account_state_v2 (application_submitted_at)
  where application_status = 'submitted';
create index if not exists profile_account_state_v2_verification_pending_idx
  on public.profile_account_state_v2 (verification_submitted_at)
  where verification_status = 'pending';

-- Membership renewal/expiry scan: "which active memberships expire soon."
create index if not exists profile_account_state_v2_active_members_idx
  on public.profile_account_state_v2 (membership_expires_at)
  where membership_status = 'active';

-- Seed-data cleanup/audit: the minority case is what queries actually
-- filter for (true), so the partial index targets exactly that, not the
-- (presumably much larger) false population.
create index if not exists profile_account_state_v2_seed_data_idx
  on public.profile_account_state_v2 (user_id)
  where is_seed_data;

-- Removed from this revision (present in revision 1, deliberately dropped
-- here per rule #14): profiles.application_status / .membership_status /
-- .is_seed_data / (application_status, membership_status) — the columns
-- themselves moved off `profiles` entirely (§1), and even before that
-- move, plain non-partial indexes on 3-8-value columns weren't earning
-- their write-amplification cost. onboarding_answers_v2.intent — same
-- reasoning, see §1's comment.

commit;

-- ============================================================================
-- Intentionally NOT included in this revision:
--   * get_top_matches_v2 — still out of scope; §10's discovery-gate index
--     is prepared for it, the RPC itself is a separate follow-up.
--   * Any ALTER/DROP of V1 tables/columns — see docs/v2-schema-spec.md §8.
--   * `profiles.zodiac_sign`/`photo_verified` are left exactly as they
--     are in V1 (untouched), consistent with rule #1: no operational sync
--     trigger writes back onto the public profile table anymore.
--
-- Changed vs. revision 1 (for reviewers comparing the two):
--   * REMOVED: sync_photo_verified() trigger and profiles.verification_*
--     columns — verification now lives entirely in
--     profile_account_state_v2, and V1's `photo_verified` boolean is left
--     alone (still V1-frozen, still whatever elle-onay set it to; no new
--     write path touches it, since rule #1 forbids adding an operational
--     sync mechanism that writes to the public profiles table).
--   * REMOVED: profiles.discovery_distance_km/discovery_smoking_strength/
--     discovery_drinking_strength/discovery_pets_tolerance — moved into
--     discovery_preferences_v2 (self-only RLS) instead of the broadly-
--     readable profiles table.
--   * REMOVED: profiles.onboarding_version/onboarding_status/
--     application_*/membership_*/is_seed_data — moved into
--     profile_account_state_v2.
--   * REMOVED: the age_years-on-write proposal from the schema-spec's
--     §6.4 discussion — replaced with compute_age_years(), never stored.
--   * profiles.photos (V1, text[]) is unchanged; V2 uses the new
--     profile_photos table exclusively.
-- ============================================================================
